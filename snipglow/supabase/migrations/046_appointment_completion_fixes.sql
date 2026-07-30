-- =============================================================================
-- 046_appointment_completion_fixes.sql
--
-- BUG 1 — appointments never flipped to 'completed':
--   The app writes `appointments.completed_at` (both the manual "Mark complete"
--   action and the complete-and-bill flow), but that column was never created.
--   Postgres rejected the whole UPDATE ("column completed_at does not exist"),
--   so the status silently stayed 'booked'. Adding the column fixes both paths.
--
-- BUG 2 — duplicate bills:
--   Because the status stayed 'booked', staff could hit "Complete & Bill" again
--   and generate another invoice for the SAME appointment. A partial unique
--   index makes that impossible at the database level.
--
-- Safe to re-run. The unique index is created only if no duplicates exist yet;
-- if duplicates are present it is skipped with a notice so this migration never
-- fails midway (clean them up, then re-run this file to enforce the constraint).
-- =============================================================================

-- 1. The missing column ---------------------------------------------------------
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. Backfill: any appointment that already has a paid invoice IS completed. ----
UPDATE appointments a
SET status = 'completed',
    completed_at = COALESCE(a.completed_at, i.created_at)
FROM invoices i
WHERE i.appointment_id = a.id
  AND a.status IN ('booked', 'confirmed');

-- 3. One invoice per appointment (prevents duplicate bills) ---------------------
DO $$
DECLARE
  dupes INT;
BEGIN
  SELECT COUNT(*) INTO dupes
  FROM (
    SELECT appointment_id
    FROM invoices
    WHERE appointment_id IS NOT NULL
    GROUP BY appointment_id
    HAVING COUNT(*) > 1
  ) d;

  IF dupes = 0 THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_appointment_unique
      ON invoices(appointment_id)
      WHERE appointment_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'Skipped unique index: % appointment(s) already have duplicate invoices. Delete the extra invoices, then re-run this migration.', dupes;
  END IF;
END $$;
