-- =============================================================================
-- 031_backfill_trial_end_dates.sql
--
-- Early trial tenants were created without subscription_start / subscription_end
-- stamped, so the 15-day trial could never be enforced (they kept full access
-- past expiry). This backfills those dates from created_at so expiry is accurate
-- in admin views; the app also computes expiry defensively at read time.
--
--   subscription_start ← created_at
--   subscription_end   ← created_at + 15 days
--
-- Only fills rows on a trial that are missing the dates. Paid/active tenants and
-- rows that already have an end date are left untouched.
-- =============================================================================

UPDATE tenants
  SET subscription_start = COALESCE(subscription_start, created_at),
      subscription_end   = COALESCE(subscription_end, created_at + interval '15 days')
  WHERE subscription_status = 'trial'
    AND subscription_end IS NULL;
