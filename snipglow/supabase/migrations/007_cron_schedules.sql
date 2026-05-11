-- Migration: 007_cron_schedules
-- Description: Set up pg_cron schedules for automated jobs
-- Requirements: 9.1, 9.2, 10.5, 15.6
-- NOTE: These must be run in the Supabase SQL editor after enabling the pg_cron extension.
--       They are stored here for documentation and reproducibility.

-- =============================================================================
-- ENABLE pg_cron EXTENSION (if not already enabled)
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================================================================
-- 1. APPOINTMENT REMINDERS
-- Daily at 8:00 AM IST (2:30 AM UTC)
-- Sends WhatsApp reminders for next-day appointments
-- =============================================================================
SELECT cron.schedule(
  'appointment-reminders',
  '30 2 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.edge_base_url') || '/appointment-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_key'),
      'Content-Type', 'application/json'
    )
  )
  $$
);

-- =============================================================================
-- 2. FOLLOW-UP TRIGGER
-- Daily at 10:00 AM IST (4:30 AM UTC)
-- Sends WhatsApp follow-up to customers inactive for 30+ days
-- =============================================================================
SELECT cron.schedule(
  'follow-up-trigger',
  '30 4 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.edge_base_url') || '/follow-up-trigger',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_key'),
      'Content-Type', 'application/json'
    )
  )
  $$
);

-- =============================================================================
-- 3. DAILY ANALYTICS AGGREGATION
-- Daily at 2:00 AM IST (8:30 PM UTC previous day)
-- Computes daily analytics snapshots per branch
-- =============================================================================
SELECT cron.schedule(
  'daily-analytics',
  '30 20 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.edge_base_url') || '/aggregate-analytics',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_key'),
      'Content-Type', 'application/json'
    )
  )
  $$
);

-- =============================================================================
-- 4. MEMBERSHIP EXPIRY CHECK
-- Daily at 6:00 AM IST (12:30 AM UTC)
-- Marks expired memberships and generates reminder list
-- =============================================================================
SELECT cron.schedule(
  'membership-expiry-check',
  '30 0 * * *',
  $$
  UPDATE customer_memberships
  SET status = 'expired'
  WHERE status = 'active' AND end_date < CURRENT_DATE;
  $$
);
