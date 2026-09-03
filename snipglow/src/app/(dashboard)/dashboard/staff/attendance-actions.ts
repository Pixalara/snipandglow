'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import {
  ATTENDANCE_STATUSES,
  calculateAttendanceDay,
  sumAttendance,
  minutesToTime,
  parseTimeToMinutes,
  monthRange,
  previousDay,
  type AttendanceStatus,
} from '@/lib/attendance';
import type {
  ActionResult,
  AttendanceDayRow,
  AttendanceMonthSummary,
  SaveAttendanceRow,
  UserRole,
} from '@/types';

// =============================================================================
// Staff attendance — server actions.
//
// OWNER-ONLY throughout, matching how payroll is treated everywhere else in the
// product: these rows are wage data.
//
// Hours and pay are never stored. They are derived from the stored times by
// `src/lib/attendance.ts`, which is unit tested and handles overnight shifts and
// minute-accurate rounding. Storing them would let the two drift apart.
//
// Requires migration 049_staff_attendance.sql.
// =============================================================================

/** Shape of a stored attendance row as we read it back. */
interface StoredRow {
  employee_id: string;
  work_date: string;
  status: AttendanceStatus;
  login_time: string | null;
  logout_time: string | null;
  break_minutes: number;
  hourly_rate: number;
}

interface EmployeeLite {
  id: string;
  name: string;
  role: UserRole;
  hourly_rate: number;
}

/** Resolve the caller and enforce owner-only access. */
async function requireOwner(): Promise<
  | { ok: true; tenantId: string; branchId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id as string | undefined;
  const branchId = user.user_metadata?.branch_id as string | undefined;
  const role = user.user_metadata?.role as string | undefined;

  if (!tenantId || !branchId) return { ok: false, error: 'No tenant or branch context found.' };
  if (role !== 'owner') return { ok: false, error: 'Only owners can manage staff attendance.' };

  return { ok: true, tenantId, branchId };
}

/** Active staff for the tenant, name-ordered, with their current rate. */
async function loadActiveEmployees(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string
): Promise<EmployeeLite[]> {
  const { data } = await (admin
    .from('employees')
    .select('id, name, role, hourly_rate')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name') as unknown as Promise<{ data: EmployeeLite[] | null }>);

  return (data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    role: e.role,
    hourly_rate: Number(e.hourly_rate) || 0,
  }));
}

const isValidDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
const isValidMonth = (v: string) => /^\d{4}-\d{2}$/.test(v);

export interface AttendanceDayResponse {
  date: string;
  rows: AttendanceDayRow[];
  /** True when no staff member has an hourly rate set yet. */
  needsRates: boolean;
}

/**
 * Every active staff member with their record for one date.
 *
 * Staff without a record yet come back as an unsaved row prefilled from their
 * current rate, so the owner sees one line per person and just fills in times.
 */
export async function getAttendanceForDay(date: string): Promise<AttendanceDayResponse> {
  const empty: AttendanceDayResponse = { date, rows: [], needsRates: false };

  const auth = await requireOwner();
  if (!auth.ok || !isValidDate(date)) return empty;

  const admin = createAdminClient();
  const employees = await loadActiveEmployees(admin, auth.tenantId);
  if (employees.length === 0) return empty;

  const { data: stored } = await (admin
    .from('staff_attendance' as never)
    .select('employee_id, work_date, status, login_time, logout_time, break_minutes, hourly_rate')
    .eq('tenant_id', auth.tenantId)
    .eq('work_date', date) as unknown as Promise<{ data: StoredRow[] | null }>);

  const byEmployee = new Map<string, StoredRow>();
  for (const row of stored ?? []) byEmployee.set(row.employee_id, row);

  const rows: AttendanceDayRow[] = employees.map((emp) => {
    const record = byEmployee.get(emp.id);
    return {
      employee_id: emp.id,
      employee_name: emp.name,
      role: emp.role,
      // An existing row keeps the rate that was snapshotted for that day.
      hourly_rate: record ? Number(record.hourly_rate) || 0 : emp.hourly_rate,
      status: record?.status ?? 'present',
      // Postgres returns TIME as `HH:MM:SS`; inputs need `HH:MM`.
      login_time: record ? minutesToTime(parseTimeToMinutes(record.login_time)) : '',
      logout_time: record ? minutesToTime(parseTimeToMinutes(record.logout_time)) : '',
      break_minutes: record ? Number(record.break_minutes) || 0 : 0,
      recorded: !!record,
    };
  });

  return {
    date,
    rows,
    needsRates: employees.every((e) => e.hourly_rate <= 0),
  };
}

/**
 * The previous day's entries, shaped for prefilling the form.
 *
 * Most salons run the same shift every day, so re-typing eight identical rows is
 * the single most tedious part of recording attendance. This returns yesterday's
 * pattern for the client to apply — it writes nothing until the owner saves.
 */
export async function getPreviousDayPattern(date: string): Promise<AttendanceDayResponse> {
  if (!isValidDate(date)) return { date, rows: [], needsRates: false };
  const prev = previousDay(date);
  const result = await getAttendanceForDay(prev);
  // Only rows that were actually recorded are worth copying forward.
  return { ...result, date: prev, rows: result.rows.filter((r) => r.recorded) };
}

export interface AttendanceMonthResponse {
  month: string;
  summaries: AttendanceMonthSummary[];
  totals: { hours: number; amount: number; daysWorked: number };
}

/** Per-staff totals for a month, plus whether payroll has been raised yet. */
export async function getAttendanceForMonth(month: string): Promise<AttendanceMonthResponse> {
  const empty: AttendanceMonthResponse = {
    month,
    summaries: [],
    totals: { hours: 0, amount: 0, daysWorked: 0 },
  };

  const auth = await requireOwner();
  if (!auth.ok || !isValidMonth(month)) return empty;

  const range = monthRange(month);
  if (!range) return empty;

  const admin = createAdminClient();
  const employees = await loadActiveEmployees(admin, auth.tenantId);
  if (employees.length === 0) return empty;

  const [attendanceRes, payrollRes] = await Promise.all([
    (admin
      .from('staff_attendance' as never)
      .select('employee_id, work_date, status, login_time, logout_time, break_minutes, hourly_rate')
      .eq('tenant_id', auth.tenantId)
      .gte('work_date', range.start)
      .lte('work_date', range.end) as unknown as Promise<{ data: StoredRow[] | null }>),
    (admin
      .from('payroll' as never)
      .select('employee_id, payment_status')
      .eq('tenant_id', auth.tenantId)
      .eq('month', month) as unknown as Promise<{
      data: { employee_id: string; payment_status: string }[] | null;
    }>),
  ]);

  const byEmployee = new Map<string, StoredRow[]>();
  for (const row of attendanceRes.data ?? []) {
    const list = byEmployee.get(row.employee_id) ?? [];
    list.push(row);
    byEmployee.set(row.employee_id, list);
  }

  const payrollByEmployee = new Map<string, string>();
  for (const p of payrollRes.data ?? []) payrollByEmployee.set(p.employee_id, p.payment_status);

  const summaries: AttendanceMonthSummary[] = employees.map((emp) => {
    const days = byEmployee.get(emp.id) ?? [];
    const totals = sumAttendance(
      days.map((d) => ({
        status: d.status,
        login_time: d.login_time,
        logout_time: d.logout_time,
        break_minutes: Number(d.break_minutes) || 0,
        hourly_rate: Number(d.hourly_rate) || 0,
      }))
    );
    const payrollStatus = payrollByEmployee.get(emp.id);
    return {
      employee_id: emp.id,
      employee_name: emp.name,
      role: emp.role,
      hourly_rate: emp.hourly_rate,
      daysWorked: totals.daysWorked,
      daysAbsent: totals.daysAbsent,
      daysLeave: totals.daysLeave,
      daysWeekOff: totals.daysWeekOff,
      totalHours: totals.totalHours,
      totalAmount: totals.totalAmount,
      payrollExists: payrollStatus !== undefined,
      payrollPaid: payrollStatus === 'paid',
    };
  });

  return {
    month,
    summaries,
    totals: {
      hours: Math.round(summaries.reduce((s, r) => s + r.totalHours, 0) * 100) / 100,
      amount: summaries.reduce((s, r) => s + r.totalAmount, 0),
      daysWorked: summaries.reduce((s, r) => s + r.daysWorked, 0),
    },
  };
}

/** Day-by-day entries for one staff member in a month, for the expanded view. */
export async function getEmployeeMonthDays(
  employeeId: string,
  month: string
): Promise<AttendanceDayRow[]> {
  const auth = await requireOwner();
  if (!auth.ok || !isValidMonth(month) || !employeeId) return [];

  const range = monthRange(month);
  if (!range) return [];

  const admin = createAdminClient();

  const { data: emp } = await (admin
    .from('employees')
    .select('id, name, role, hourly_rate')
    .eq('id', employeeId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle() as unknown as Promise<{ data: EmployeeLite | null }>);

  if (!emp) return [];

  const { data: stored } = await (admin
    .from('staff_attendance' as never)
    .select('employee_id, work_date, status, login_time, logout_time, break_minutes, hourly_rate')
    .eq('tenant_id', auth.tenantId)
    .eq('employee_id', employeeId)
    .gte('work_date', range.start)
    .lte('work_date', range.end)
    .order('work_date') as unknown as Promise<{ data: StoredRow[] | null }>);

  return (stored ?? []).map((record) => ({
    employee_id: employeeId,
    employee_name: emp.name,
    role: emp.role,
    hourly_rate: Number(record.hourly_rate) || 0,
    status: record.status,
    login_time: minutesToTime(parseTimeToMinutes(record.login_time)),
    logout_time: minutesToTime(parseTimeToMinutes(record.logout_time)),
    break_minutes: Number(record.break_minutes) || 0,
    recorded: true,
    // Carried per row so the expanded view can label each line with its date.
    work_date: record.work_date,
  }));
}

export interface SaveAttendanceResult {
  saved: number;
  totalAmount: number;
}

/**
 * Create or update attendance entries.
 *
 * One action serves both directions — many employees for one date (the day view)
 * and many dates for one employee (the month view) — because each row carries its
 * own `work_date`.
 *
 * The write is a single `upsert` on the `(employee_id, work_date)` unique
 * constraint from migration 049, so a double-submit updates rather than
 * duplicating, and all rows land in one statement.
 */
export async function saveAttendance(
  rows: SaveAttendanceRow[]
): Promise<ActionResult<SaveAttendanceResult>> {
  const auth = await requireOwner();
  if (!auth.ok) return { success: false, error: auth.error };

  if (!Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: 'Nothing to save.' };
  }
  if (rows.length > 500) {
    return { success: false, error: 'Too many entries in one save. Please save in smaller batches.' };
  }

  // ── Validate before touching the database ────────────────────────────────
  for (const row of rows) {
    if (!row.employee_id) return { success: false, error: 'A staff member is missing.' };
    if (!isValidDate(row.work_date)) {
      return { success: false, error: `Invalid date: ${row.work_date}` };
    }
    if (!ATTENDANCE_STATUSES.includes(row.status)) {
      return { success: false, error: `Invalid attendance status: ${row.status}` };
    }
    const breakMinutes = Number(row.break_minutes ?? 0);
    if (!Number.isFinite(breakMinutes) || breakMinutes < 0 || breakMinutes > 24 * 60) {
      return { success: false, error: 'Break minutes must be between 0 and 1440.' };
    }
    for (const t of [row.login_time, row.logout_time]) {
      if (t && parseTimeToMinutes(t) === null) {
        return { success: false, error: `Invalid time: ${t}` };
      }
    }
  }

  const admin = createAdminClient();

  // Only staff belonging to this tenant, so a crafted employee_id can't write
  // into someone else's salon (the admin client bypasses RLS).
  const employees = await loadActiveEmployees(admin, auth.tenantId);
  const rateByEmployee = new Map(employees.map((e) => [e.id, e.hourly_rate]));

  const unknown = rows.find((r) => !rateByEmployee.has(r.employee_id));
  if (unknown) {
    return { success: false, error: 'One of the selected staff members is not active in this salon.' };
  }

  // Preserve the rate already snapshotted on an existing row. Editing a past day
  // must not silently re-price it at today's rate.
  const dates = [...new Set(rows.map((r) => r.work_date))];
  const { data: existing } = await (admin
    .from('staff_attendance' as never)
    .select('employee_id, work_date, hourly_rate')
    .eq('tenant_id', auth.tenantId)
    .in('work_date', dates) as unknown as Promise<{
    data: { employee_id: string; work_date: string; hourly_rate: number }[] | null;
  }>);

  const existingRate = new Map<string, number>();
  for (const e of existing ?? []) {
    existingRate.set(`${e.employee_id}|${e.work_date}`, Number(e.hourly_rate) || 0);
  }

  const nowIso = new Date().toISOString();
  const payload = rows.map((row) => {
    const key = `${row.employee_id}|${row.work_date}`;
    const priorRate = existingRate.get(key);
    // Keep the historic rate; fall back to the employee's current rate for a new
    // row, or when the old row never had one.
    const rate = priorRate && priorRate > 0 ? priorRate : rateByEmployee.get(row.employee_id) ?? 0;

    // Times are only meaningful for a day that was actually worked.
    const payable = row.status === 'present' || row.status === 'half_day';

    return {
      tenant_id: auth.tenantId,
      branch_id: auth.branchId,
      employee_id: row.employee_id,
      work_date: row.work_date,
      status: row.status,
      login_time: payable ? row.login_time || null : null,
      logout_time: payable ? row.logout_time || null : null,
      break_minutes: payable ? Math.round(Number(row.break_minutes) || 0) : 0,
      hourly_rate: rate,
      updated_at: nowIso,
    };
  });

  const { error } = await (admin
    .from('staff_attendance' as never)
    .upsert(payload as never, { onConflict: 'employee_id,work_date' }) as unknown as Promise<{
    error: { message: string } | null;
  }>);

  if (error) {
    console.error('[attendance] save failed:', error);
    // The table only exists once migration 049 has been applied.
    if (/relation .*staff_attendance.* does not exist/i.test(error.message)) {
      return {
        success: false,
        error: 'Attendance is not set up yet. Please apply the latest database migration.',
      };
    }
    return { success: false, error: 'Failed to save attendance. Please try again.' };
  }

  // Report back what the owner just committed to paying.
  const totalAmount = payload.reduce(
    (sum, p) =>
      sum +
      calculateAttendanceDay({
        status: p.status as AttendanceStatus,
        login_time: p.login_time,
        logout_time: p.logout_time,
        break_minutes: p.break_minutes,
        hourly_rate: p.hourly_rate,
      }).amount,
    0
  );

  // One call now that attendance and payroll are tabs on the same route.
  revalidatePath('/dashboard/staff');
  return { success: true, data: { saved: payload.length, totalAmount } };
}

/** Set a staff member's current hourly rate. Applies to days saved from now on. */
export async function setEmployeeHourlyRate(
  employeeId: string,
  hourlyRate: number
): Promise<ActionResult<void>> {
  const auth = await requireOwner();
  if (!auth.ok) return { success: false, error: auth.error };

  if (!employeeId) return { success: false, error: 'Staff member is required.' };

  const rate = Math.round(Number(hourlyRate));
  if (!Number.isFinite(rate) || rate < 0) {
    return { success: false, error: 'Enter a valid hourly rate.' };
  }
  if (rate > 100000) {
    return { success: false, error: 'That hourly rate looks too high. Please check the amount.' };
  }

  const admin = createAdminClient();
  const { error } = await (admin
    .from('employees')
    .update({ hourly_rate: rate } as never)
    .eq('id', employeeId)
    .eq('tenant_id', auth.tenantId) as unknown as Promise<{ error: { message: string } | null }>);

  if (error) {
    console.error('[attendance] rate update failed:', error);
    return { success: false, error: 'Failed to update the hourly rate. Please try again.' };
  }

  revalidatePath('/dashboard/staff');
  return { success: true, data: undefined };
}

/**
 * Push a month's calculated wages into payroll as the base salary.
 *
 * This is the point of the whole feature: payroll's `base_salary` was previously
 * a number the owner typed in from memory each month. Now it comes from recorded
 * hours. Writes the same shape as `upsertPayroll` so the existing payroll screen,
 * its bonus/deduction fields and its "mark paid" flow keep working unchanged.
 */
export async function pushMonthToPayroll(
  employeeId: string,
  month: string
): Promise<ActionResult<{ amount: number }>> {
  const auth = await requireOwner();
  if (!auth.ok) return { success: false, error: auth.error };

  if (!employeeId) return { success: false, error: 'Staff member is required.' };
  if (!isValidMonth(month)) return { success: false, error: 'Month must be in YYYY-MM format.' };

  const summary = await getAttendanceForMonth(month);
  const row = summary.summaries.find((s) => s.employee_id === employeeId);

  if (!row) {
    return { success: false, error: 'That staff member has no attendance for this month.' };
  }
  if (row.totalAmount <= 0) {
    return { success: false, error: 'No payable hours recorded for this month yet.' };
  }
  if (row.payrollPaid) {
    return {
      success: false,
      error: 'Payroll for this month is already marked paid. Edit it on the Payroll page instead.',
    };
  }

  const admin = createAdminClient();

  const { data: existing } = await (admin
    .from('payroll' as never)
    .select('id, bonus, deductions, notes')
    .eq('tenant_id', auth.tenantId)
    .eq('employee_id', employeeId)
    .eq('month', month)
    .maybeSingle() as unknown as Promise<{
    data: {
      id: string;
      bonus: number | null;
      deductions: number | null;
      notes: string | null;
    } | null;
  }>);

  const NOTE_PREFIX = 'From attendance:';
  const note = `${NOTE_PREFIX} ${row.daysWorked} day${row.daysWorked === 1 ? '' : 's'}, ${row.totalHours}h`;

  if (existing) {
    // Keep any bonus/deductions the owner already entered by hand.
    const bonus = Number(existing.bonus) || 0;
    const deductions = Number(existing.deductions) || 0;
    // Only touch the note when it is blank or one we wrote ourselves — a note the
    // owner typed is theirs, and overwriting it would lose information.
    const priorNote = existing.notes?.trim() ?? '';
    const nextNote = !priorNote || priorNote.startsWith(NOTE_PREFIX) ? note : priorNote;

    const { error } = await (admin
      .from('payroll' as never)
      .update({
        base_salary: row.totalAmount,
        net_salary: row.totalAmount + bonus - deductions,
        notes: nextNote,
      } as never)
      .eq('id', existing.id) as unknown as Promise<{ error: { message: string } | null }>);

    if (error) {
      console.error('[attendance] payroll update failed:', error);
      return { success: false, error: 'Failed to update payroll. Please try again.' };
    }
  } else {
    const { error } = await (admin.from('payroll' as never).insert({
      tenant_id: auth.tenantId,
      branch_id: auth.branchId,
      employee_id: employeeId,
      month,
      base_salary: row.totalAmount,
      bonus: 0,
      deductions: 0,
      net_salary: row.totalAmount,
      payment_status: 'pending',
      notes: note,
    } as never) as unknown as Promise<{
      error: { message: string; code?: string } | null;
    }>);

    if (error) {
      console.error('[attendance] payroll insert failed:', error);
      // 23505 is Postgres' unique violation, guarding
      // payroll_employee_month_unique from migration 050. Reaching here means a
      // payroll row for this employee and month appeared between the existence
      // check above and this insert — most likely the owner also pressed Add
      // Salary on the Payroll tab. Nothing is broken; the figures just need a
      // reload before pushing again.
      if (error.code === '23505') {
        return {
          success: false,
          error: 'A payroll record for this month was just created elsewhere. Reload and try again.',
        };
      }
      return { success: false, error: 'Failed to create the payroll record. Please try again.' };
    }
  }

  // One call now that attendance and payroll are tabs on the same route.
  revalidatePath('/dashboard/staff');
  return { success: true, data: { amount: row.totalAmount } };
}
