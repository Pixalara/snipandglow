-- =============================================================================
-- Migration 053: sell memberships (a membership is a paid product)
--
-- WHY
-- ---
-- Assigning a membership just inserted a customer_memberships row — the plan was
-- handed out for free, with no bill, even though memberships.price is what the
-- customer is meant to pay for it. This makes a membership a SOLD item, the way
-- a wallet top-up already is: pick a plan, take payment, raise a bill, and only
-- then activate the plan.
--
-- Two schema changes support that:
--
--  1. invoice_type gains 'membership', so a plan sale is its own kind of invoice
--     — distinct from a service bill and from a wallet top-up. It is added to the
--     existing CHECK, which currently allows only 'service' and 'wallet_recharge'
--     (migration 042).
--
--  2. The customer-stats trigger is taught about it. A membership sale IS
--     revenue (unlike a wallet deposit, which is a liability until spent), so it
--     counts towards total_spent and updates last_visit_at — but it is NOT a
--     service visit, so it must not increment total_visits, which drives the
--     loyalty tier. Buying a plan shouldn't nudge someone toward Gold.
--
-- Revenue reporting needs no change: analytics and the billing page already
-- include everything except 'wallet_recharge', so 'membership' is counted as
-- revenue automatically.
--
-- SAFETY: additive and idempotent. The CHECK is widened (never narrowed, so no
-- existing row can violate it), and the trigger function is replaced in place.
-- =============================================================================

-- 1. Allow the new invoice type ------------------------------------------------
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_type_check;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_invoice_type_check
  CHECK (invoice_type IN ('service', 'wallet_recharge', 'membership'));

-- 2. Count a membership sale as spend + revenue, but not as a visit ------------
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- A wallet recharge is a prepaid deposit, not a visit or a sale.
  IF NEW.invoice_type = 'wallet_recharge' THEN
    RETURN NEW;
  END IF;

  -- A membership sale is money spent, but not a service visit — so it lifts
  -- total_spent and last_visit_at without touching the visit-based loyalty tier.
  IF NEW.invoice_type = 'membership' THEN
    UPDATE customers
    SET total_spent = total_spent + NEW.total,
        last_visit_at = NEW.created_at
    WHERE id = NEW.customer_id;
    RETURN NEW;
  END IF;

  -- A normal service/product sale.
  UPDATE customers
  SET
    total_visits = total_visits + 1,
    total_spent = total_spent + NEW.total,
    last_visit_at = NEW.created_at
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
