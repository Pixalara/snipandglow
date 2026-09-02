-- =============================================================================
-- Migration 049: Staff attendance (daily login/logout + hourly wages)
--
-- Lets the owner record when each staff member started and finished on a given
-- day, and have the hours and the amount payable worked out for them.
--
-- WHY EACH CHANGE:
--
--  1. employees.hourly_rate    — the staff member's CURRENT rate. Until now the
--                                only money-per-employee data in the system was
--                                payroll.base_salary, a figure the owner typed in
--                                by hand each month with nothing behind it. This
--                                is the input that makes the monthly total
--                                derivable instead of guessed.
--
--  2. staff_attendance         — one row per employee per day. `status` records
--                                WHY a day wasn't worked (absent / leave /
--                                week off) instead of leaving a blank that is
--                                impossible to interpret a month later.
--
--  3. hourly_rate ON THE ROW   — snapshotted at save time, deliberately NOT read
--                                back from employees at report time. A mid-month
--                                raise must apply from its day forward and must
--                                not silently rewrite what the owner already
--                                paid for earlier days.
--
--  4. UNIQUE(employee_id, work_date)
--                              — one attendance record per person per day, so a
--                                double-submit updates rather than duplicating.
--                                Note payroll deliberately has NO equivalent
--                                constraint on (employee_id, month) and relies
--                                on application code; this table does not repeat
--                                that mistake.
--
-- Hours and pay are NOT stored. They are derived by src/lib/attendance.ts, which
-- is unit tested, and which handles the two cases a generated column would get
-- wrong: shifts that run past midnight (a salon closing at 01:00 records
-- logout < login), and deriving the amount from exact minutes rather than from a
-- rounded hours figure.
--
-- ACCESS: owner-only, matching how payroll is treated everywhere else in the
-- product (page guard, server actions, RLS, and the permissions matrix). Wage
-- data should not be visible to managers or staff.
--
-- Additive only — no existing table or column is modified apart from adding one
-- nullable-by-default column to employees.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Current hourly rate per employee
-- ---------------------------------------------------------------------------
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE employees
  DROP CONSTRAINT IF EXISTS employees_hourly_rate_nonneg;
ALTER TABLE employees
  ADD CONSTRAINT employees_hourly_rate_nonneg CHECK (hourly_rate >= 0);

COMMENT ON COLUMN employees.hourly_rate IS
  'Current wage per hour in rupees. Snapshotted onto staff_attendance rows at save time so historic days keep the rate that actually applied.';

-- ---------------------------------------------------------------------------
-- 2. staff_attendance
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

  /** The calendar day being recorded, in the salon's local (IST) calendar. */
  work_date DATE NOT NULL,

  /** Why the day was or wasn't worked. Only present/half_day are payable. */
  status TEXT NOT NULL DEFAULT 'present'
    CHECK (status IN ('present', 'half_day', 'absent', 'leave', 'week_off')),

  /** NULL until the owner records them. A logout at or before the login means
      the shift crossed midnight — see src/lib/attendance.ts. */
  login_time TIME,
  logout_time TIME,

  /** Unpaid break, deducted from the shift length. */
  break_minutes INT NOT NULL DEFAULT 0,

  /** Rate that applied on THIS day (see note 3 in the header). */
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT staff_attendance_break_nonneg CHECK (break_minutes >= 0),
  CONSTRAINT staff_attendance_break_sane CHECK (break_minutes <= 24 * 60),
  CONSTRAINT staff_attendance_rate_nonneg CHECK (hourly_rate >= 0),
  -- One record per person per day.
  CONSTRAINT staff_attendance_employee_date_unique UNIQUE (employee_id, work_date)
);

-- Indexes match the two ways this table is read: the day view (everyone on one
-- date) and the month view (one person across a range).
CREATE INDEX IF NOT EXISTS idx_staff_attendance_tenant_date
  ON staff_attendance(tenant_id, work_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_employee_date
  ON staff_attendance(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_branch
  ON staff_attendance(branch_id);

COMMENT ON TABLE staff_attendance IS
  'One row per employee per day: shift times, unpaid break, and the hourly rate that applied. Hours and pay are derived in src/lib/attendance.ts, not stored.';

-- ---------------------------------------------------------------------------
-- 3. RLS — owner-only, mirroring payroll (migration 010)
-- ---------------------------------------------------------------------------
ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_attendance_select" ON staff_attendance;
CREATE POLICY "staff_attendance_select" ON staff_attendance FOR SELECT
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner');

DROP POLICY IF EXISTS "staff_attendance_insert" ON staff_attendance;
CREATE POLICY "staff_attendance_insert" ON staff_attendance FOR INSERT
  WITH CHECK (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner');

DROP POLICY IF EXISTS "staff_attendance_update" ON staff_attendance;
CREATE POLICY "staff_attendance_update" ON staff_attendance FOR UPDATE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner');

DROP POLICY IF EXISTS "staff_attendance_delete" ON staff_attendance;
CREATE POLICY "staff_attendance_delete" ON staff_attendance FOR DELETE
  USING (tenant_id = auth_tenant_id() AND auth_user_role() = 'owner');

-- ---------------------------------------------------------------------------
-- 4. Audit trail
-- ---------------------------------------------------------------------------
-- Wage records should be as auditable as invoices and payroll changes. Reuses
-- audit_log_trigger() from migration 004.
DROP TRIGGER IF EXISTS audit_staff_attendance ON staff_attendance;
CREATE TRIGGER audit_staff_attendance
  AFTER INSERT OR UPDATE OR DELETE ON staff_attendance
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
