-- =============================================================================
-- Migration 050: one payroll record per employee per month
--
-- WHY:
--
-- `payroll` has had no uniqueness guarantee on (employee_id, month) since it was
-- created in migration 010. Nothing stopped two rows existing for the same person
-- in the same month, and `upsertPayroll` compensated in application code with a
-- read-then-insert-or-update:
--
--     select id from payroll where employee_id = ? and month = ?   -- .single()
--     if found -> update, else -> insert
--
-- That has two problems.
--
--  1. IT RACES. Two concurrent writers both see no row and both insert. The
--     obvious way in is the product itself: "Send to payroll" on the Attendance
--     tab and "Add Salary" on the Payroll tab both write the same
--     (employee, month) pair, and a double-click on either does it too.
--
--  2. IT POISONS THE RECORD. The existence check reads with `.single()`, which
--     errors when the result is not exactly one row. So the moment a duplicate
--     exists, that employee's payroll for that month can never be edited again —
--     every subsequent save fails — and the Payroll tab lists them twice with
--     conflicting figures. A salon owner would see two different net salaries
--     for one person and have no way to fix either.
--
-- Migration 049 called this out explicitly when adding
-- `staff_attendance_employee_date_unique` and deliberately did not repeat the
-- mistake. This migration closes it on `payroll` too.
--
-- The unique index this creates also serves `upsertPayroll`'s existence lookup,
-- which filters on exactly (employee_id, month).
--
-- SAFETY: additive. No column or row is modified. The DO block below refuses to
-- proceed if duplicates already exist, so this fails loudly with a useful
-- message rather than half-applying — and re-running it is harmless.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Refuse to run against data the constraint cannot describe
-- ---------------------------------------------------------------------------
-- Adding a UNIQUE constraint over existing duplicates fails with a bare
-- "could not create unique index" and no indication of which rows are at fault.
-- This raises something actionable instead.
DO $$
DECLARE
  duplicate_pairs INT;
  sample TEXT;
BEGIN
  SELECT COUNT(*) INTO duplicate_pairs
  FROM (
    SELECT employee_id, month
    FROM payroll
    GROUP BY employee_id, month
    HAVING COUNT(*) > 1
  ) AS dupes;

  IF duplicate_pairs > 0 THEN
    SELECT string_agg(employee_id || ' / ' || month, ', ')
      INTO sample
    FROM (
      SELECT employee_id::TEXT AS employee_id, month
      FROM payroll
      GROUP BY employee_id, month
      HAVING COUNT(*) > 1
      LIMIT 5
    ) AS preview;

    RAISE EXCEPTION
      'Cannot add payroll_employee_month_unique: % employee/month pair(s) already have duplicate payroll rows (e.g. %). Reconcile these first — keep the paid row, or the most recently created one — then re-run this migration.',
      duplicate_pairs, sample;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. The constraint
-- ---------------------------------------------------------------------------
-- Dropped first so the migration is idempotent.
ALTER TABLE payroll
  DROP CONSTRAINT IF EXISTS payroll_employee_month_unique;

ALTER TABLE payroll
  ADD CONSTRAINT payroll_employee_month_unique UNIQUE (employee_id, month);

COMMENT ON CONSTRAINT payroll_employee_month_unique ON payroll IS
  'One salary record per employee per month. Turns a concurrent double-write into a rejected insert instead of a duplicate row that can never be edited.';
