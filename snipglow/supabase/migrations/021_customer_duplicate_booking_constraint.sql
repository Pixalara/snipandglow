-- Migration 021: Prevent same customer from booking the same overlapping slot twice
-- =============================================================================
-- A customer should not be able to have two active appointments that overlap
-- on the same date at the same tenant. This is a DB-level safety net on top
-- of the application-layer check.
-- =============================================================================

-- Add exclusion constraint: same customer cannot have overlapping appointments
-- at the same tenant on the same date (excluding cancelled)
ALTER TABLE appointments
  ADD CONSTRAINT no_customer_duplicate_booking
  EXCLUDE USING gist (
    customer_id WITH =,
    tenant_id WITH =,
    appointment_date WITH =,
    tsrange(
      (appointment_date + start_time)::timestamp,
      (appointment_date + end_time)::timestamp
    ) WITH &&
  ) WHERE (status != 'cancelled');
