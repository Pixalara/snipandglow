-- =============================================================================
-- 057_appointment_source_web_booking.sql
--
-- Allow 'web_booking' as an appointments.source value.
--
-- The public web booking page (/book/[slug]) inserts source = 'web_booking',
-- but the original inline CHECK (migration 002) only allowed
-- ('dashboard', 'whatsapp_flow'). Every web booking therefore failed the CHECK
-- on INSERT and surfaced to the customer as the generic
-- "That slot is no longer available. Please choose another time." — regardless
-- of which time slot they picked.
--
-- Widen the allowed set to include the web channel. Same approach as migration
-- 027, which widened whatsapp_customer_sessions.source. Idempotent: the DROP is
-- guarded and the constraint is re-added under its canonical name.
-- =============================================================================

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_source_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_source_check
  CHECK (source IN ('dashboard', 'whatsapp_flow', 'web_booking'));
