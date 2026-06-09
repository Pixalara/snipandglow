-- =============================================================================
-- 032_trial_expiry_alert.sql
--
-- Dedup flag for the "trial expires tomorrow" WhatsApp alert, so the daily cron
-- sends it at most once per tenant per trial window. Reset to false whenever the
-- subscription is renewed/extended (a new window starts), so a future expiry can
-- alert again.
-- =============================================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS trial_expiry_alert_sent BOOLEAN NOT NULL DEFAULT false;
