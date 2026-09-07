-- =============================================================================
-- Migration 052: attribute invoices to the membership that discounted them
--
-- WHY
-- ---
-- A membership discount has always been stored on an invoice exactly like a
-- manual, ad-hoc discount: a per-line discount_pct/discount_amount and a blended
-- invoices.discount_pct, with nothing recording that the discount came FROM a
-- membership. So "how many times did this customer use their membership", "how
-- much did it save them", and "which services did they use it on" were not
-- answerable from the data — the membership discount was indistinguishable from
-- a receptionist typing 10% into a line.
--
-- This adds the missing link: invoices.customer_membership_id points at the
-- customer_memberships row that was active when the bill was raised. From then
-- on the billing code stamps it whenever a member's bill actually received a
-- discount, and the customer page can report real usage.
--
-- ON DELETE SET NULL: deleting a membership assignment must not delete the
-- customer's paid invoices — the bill still happened. It simply loses the
-- attribution and drops out of the usage figures, which is the correct outcome.
--
-- SAFETY: additive. One nullable column, one partial index, and a one-time
-- best-effort backfill that only ever fills rows currently NULL. Re-running is
-- harmless.
-- =============================================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS customer_membership_id UUID
    REFERENCES customer_memberships(id) ON DELETE SET NULL;

COMMENT ON COLUMN invoices.customer_membership_id IS
  'The customer_memberships row active when this bill was raised, set only when a membership discount was actually applied. Powers the membership-usage view on the customer page. NULL for non-member bills and bills a member received no discount on.';

-- Partial index: usage queries filter on "attributed to a membership", and the
-- vast majority of invoices are not, so indexing only the non-null rows keeps it
-- small.
CREATE INDEX IF NOT EXISTS idx_invoices_customer_membership
  ON invoices(customer_membership_id)
  WHERE customer_membership_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Best-effort backfill for existing bills
-- ---------------------------------------------------------------------------
-- Historical invoices carry no membership link, so without this the usage view
-- would read zero for every customer until new bills accrue — which would look
-- broken to an owner opening the page today.
--
-- This is a HEURISTIC, and deliberately a conservative one. It attributes a past
-- invoice to a membership only when BOTH hold:
--   1. the bill actually carried a discount (discount_amount > 0), and
--   2. the customer held a membership whose [start_date, end_date] window
--      covered the day the bill was raised.
-- When a customer had more than one membership spanning that day (rare — plans
-- are normally assigned back to back), the one with the latest start_date wins.
--
-- It can still mis-attribute the occasional purely-manual discount that happened
-- to fall inside a membership window. That is accepted: the alternative is
-- showing nothing for existing members, and the billing UI defaults a member's
-- line discount to their plan rate, so in practice a discounted member bill did
-- use the membership. Only rows still NULL are touched, so this cannot overwrite
-- anything stamped by the application.
UPDATE invoices inv
SET customer_membership_id = (
  SELECT m.id
  FROM customer_memberships m
  WHERE m.customer_id = inv.customer_id
    AND inv.created_at::date BETWEEN m.start_date AND m.end_date
  ORDER BY m.start_date DESC
  LIMIT 1
)
WHERE inv.customer_membership_id IS NULL
  AND inv.discount_amount > 0
  -- Only touch rows that actually match, so the correlated subquery never
  -- writes a NULL and the update stays minimal.
  AND EXISTS (
    SELECT 1
    FROM customer_memberships m
    WHERE m.customer_id = inv.customer_id
      AND inv.created_at::date BETWEEN m.start_date AND m.end_date
  );
