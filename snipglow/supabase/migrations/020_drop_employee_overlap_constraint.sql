-- Migration 020: Drop employee overlap constraint
-- =============================================================================
-- The no_employee_overlap constraint prevents the same employee from having
-- two overlapping appointments. This blocks multi-capacity salons where the
-- owner wants to allow e.g. 2 bookings per slot even with 1 employee.
-- Capacity is now enforced at the application layer via max_appointments_per_slot
-- in tenant settings.
-- =============================================================================

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS no_employee_overlap;
