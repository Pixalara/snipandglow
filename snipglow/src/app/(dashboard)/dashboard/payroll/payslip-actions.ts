'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  calculateAttendanceDay,
  daysInMonth,
  formatMonthLabel,
  monthRange,
  sumAttendance,
  type AttendanceStatus,
} from '@/lib/attendance';
import type { ActionResult, UserRole } from '@/types';

// =============================================================================
// Payslip document — everything one printed payslip needs, in one read.
//
// The pay figures come from the `payroll` row, because that is what the owner
// committed to paying. The timesheet comes from `staff_attendance` over the
// calendar month, and exists to JUSTIFY that figure: days worked, hours worked,
// and the rate those hours were priced at.
//
// The two can legitimately disagree — an owner may type a base salary by hand,
// or edit attendance after raising payroll — so both are returned and the
// document reports the difference rather than quietly showing one and implying
// the other. A payslip that shows "176 hours at ₹350" next to a base salary of
// ₹50,000 with no explanation looks like a bug to the person being paid.
//
// Owner-only, matching every other payroll read and write.
// =============================================================================

/**
 * Hours worked at one particular rate.
 *
 * A month is not necessarily a single rate: `staff_attendance` snapshots the
 * rate onto each day, so a mid-month raise leaves two bands. Showing them
 * separately is both honest and what a timesheet-based payslip should look like.
 */
export interface PayslipRateBand {
  hourly_rate: number;
  days: number;
  hours: number;
  amount: number;
}

export interface PayslipDocument {
  payslip_number: string;
  generated_at: string;

  salon: {
    name: string;
    legal_name: string | null;
    trade_name: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    gst_number: string | null;
  };

  employee: {
    name: string;
    role: string;
    phone: string | null;
    email: string | null;
    /** Short human-readable reference, derived from the employee id. */
    code: string;
    /** Rate on the employee record today. May differ from the bands below. */
    current_hourly_rate: number;
  };

  /** Always the full calendar month: 1st to the last day. */
  period: {
    month: string;
    label: string;
    start: string;
    end: string;
    calendar_days: number;
  };

  attendance: {
    /** False when no attendance was recorded for this month at all. */
    recorded: boolean;
    days_recorded: number;
    days_worked: number;
    days_absent: number;
    days_leave: number;
    days_week_off: number;
    /** Calendar days with no entry either way. */
    days_unrecorded: number;
    total_hours: number;
    total_minutes: number;
    /** Weighted average across the bands, for a single headline figure. */
    effective_hourly_rate: number;
    /** The wage the timesheet implies. */
    amount: number;
    rate_bands: PayslipRateBand[];
  };

  earnings: {
    base_salary: number;
    bonus: number;
    deductions: number;
    net_salary: number;
    /** True when base salary does not match the timesheet total. */
    differs_from_attendance: boolean;
  };

  payment: {
    status: string;
    method: string | null;
    paid_date: string | null;
  };

  notes: string | null;
}

interface PayrollRecord {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  employee_id: string;
  month: string;
  base_salary: number | null;
  bonus: number | null;
  deductions: number | null;
  net_salary: number | null;
  payment_status: string | null;
  payment_method: string | null;
  paid_date: string | null;
  notes: string | null;
}

interface AttendanceRecord {
  work_date: string;
  status: AttendanceStatus;
  login_time: string | null;
  logout_time: string | null;
  break_minutes: number;
  hourly_rate: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Everything needed to render one payslip.
 *
 * Returns a friendly error rather than throwing, so the modal can show it.
 */
export async function getPayslipDocument(
  payrollId: string
): Promise<ActionResult<PayslipDocument>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id as string | undefined;
  const role = user.user_metadata?.role as string | undefined;

  if (!tenantId) return { success: false, error: 'No tenant context found.' };
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can view payslips.' };
  }
  if (!payrollId) return { success: false, error: 'Payroll record is required.' };

  const admin = createAdminClient();

  // ── The payroll row ──────────────────────────────────────────────────────
  const { data: payroll } = await (admin
    .from('payroll' as never)
    .select(
      'id, tenant_id, branch_id, employee_id, month, base_salary, bonus, deductions, net_salary, payment_status, payment_method, paid_date, notes'
    )
    .eq('id', payrollId)
    .eq('tenant_id', tenantId)
    .maybeSingle() as unknown as Promise<{ data: PayrollRecord | null }>);

  if (!payroll) {
    return { success: false, error: 'That payroll record could not be found.' };
  }

  const range = monthRange(payroll.month);
  if (!range) {
    return { success: false, error: `This record has an invalid month: ${payroll.month}` };
  }

  // ── Everything else, in parallel ─────────────────────────────────────────
  const [employeeRes, tenantRes, branchRes, attendanceRes] = await Promise.all([
    admin
      .from('employees')
      .select('id, name, role, phone, email, hourly_rate')
      .eq('id', payroll.employee_id)
      .maybeSingle() as unknown as Promise<{
      data: {
        id: string;
        name: string;
        role: UserRole;
        phone: string | null;
        email: string | null;
        hourly_rate: number | null;
      } | null;
    }>,
    admin
      .from('tenants')
      .select('name, phone, settings')
      .eq('id', tenantId)
      .maybeSingle() as unknown as Promise<{
      data: { name: string; phone: string | null; settings: Record<string, unknown> | null } | null;
    }>,
    payroll.branch_id
      ? (admin
          .from('branches')
          .select('name, address, phone')
          .eq('id', payroll.branch_id)
          .maybeSingle() as unknown as Promise<{
          data: { name: string; address: string | null; phone: string | null } | null;
        }>)
      : Promise.resolve({ data: null }),
    admin
      .from('staff_attendance' as never)
      .select('work_date, status, login_time, logout_time, break_minutes, hourly_rate')
      .eq('tenant_id', tenantId)
      .eq('employee_id', payroll.employee_id)
      .gte('work_date', range.start)
      .lte('work_date', range.end)
      .order('work_date') as unknown as Promise<{ data: AttendanceRecord[] | null }>,
  ]);

  const employee = employeeRes.data;
  if (!employee) {
    return { success: false, error: 'The staff member for this record no longer exists.' };
  }

  // ── Timesheet ────────────────────────────────────────────────────────────
  const attendanceRows = attendanceRes.data ?? [];

  const totals = sumAttendance(
    attendanceRows.map((row) => ({
      status: row.status,
      login_time: row.login_time,
      logout_time: row.logout_time,
      break_minutes: Number(row.break_minutes) || 0,
      hourly_rate: Number(row.hourly_rate) || 0,
    }))
  );

  // Group the worked days by the rate they were priced at, so a mid-month raise
  // shows as two lines instead of being averaged into something unrecognisable.
  const bandMap = new Map<number, { days: number; minutes: number; amount: number }>();
  for (const row of attendanceRows) {
    const day = calculateAttendanceDay({
      status: row.status,
      login_time: row.login_time,
      logout_time: row.logout_time,
      break_minutes: Number(row.break_minutes) || 0,
      hourly_rate: Number(row.hourly_rate) || 0,
    });
    if (day.minutes <= 0) continue;

    const rate = Number(row.hourly_rate) || 0;
    const band = bandMap.get(rate) ?? { days: 0, minutes: 0, amount: 0 };
    band.days += 1;
    band.minutes += day.minutes;
    band.amount += day.amount;
    bandMap.set(rate, band);
  }

  const rateBands: PayslipRateBand[] = [...bandMap.entries()]
    .map(([hourly_rate, band]) => ({
      hourly_rate,
      days: band.days,
      hours: round2(band.minutes / 60),
      amount: band.amount,
    }))
    .sort((a, b) => b.hourly_rate - a.hourly_rate);

  const calendarDays = daysInMonth(payroll.month).length;
  const baseSalary = Number(payroll.base_salary) || 0;
  const bonus = Number(payroll.bonus) || 0;
  const deductions = Number(payroll.deductions) || 0;

  const settings = tenantRes.data?.settings ?? {};
  const branch = branchRes.data;

  return {
    success: true,
    data: {
      // Deterministic and unique: the same record always produces the same
      // reference, so a reissued payslip is recognisably the same document.
      payslip_number: `PS-${payroll.month.replace('-', '')}-${payroll.id.slice(0, 6).toUpperCase()}`,
      generated_at: new Date().toISOString(),

      salon: {
        name: (tenantRes.data?.name as string) ?? 'Salon',
        legal_name: (settings.legal_name as string) ?? null,
        trade_name: (settings.trade_name as string) ?? null,
        address: branch?.address ?? null,
        phone: branch?.phone ?? tenantRes.data?.phone ?? null,
        email: (settings.email as string) ?? null,
        gst_number: (settings.gst_number as string) ?? null,
      },

      employee: {
        name: employee.name,
        role: employee.role,
        phone: employee.phone,
        email: employee.email,
        code: employee.id.slice(0, 8).toUpperCase(),
        current_hourly_rate: Number(employee.hourly_rate) || 0,
      },

      period: {
        month: payroll.month,
        label: formatMonthLabel(payroll.month),
        start: range.start,
        end: range.end,
        calendar_days: calendarDays,
      },

      attendance: {
        recorded: attendanceRows.length > 0,
        days_recorded: attendanceRows.length,
        days_worked: totals.daysWorked,
        days_absent: totals.daysAbsent,
        days_leave: totals.daysLeave,
        days_week_off: totals.daysWeekOff,
        days_unrecorded: Math.max(0, calendarDays - attendanceRows.length),
        total_hours: totals.totalHours,
        total_minutes: totals.totalMinutes,
        // Derived from minutes so it agrees with the amount, which is also
        // minute-based. Zero hours yields zero rather than NaN.
        effective_hourly_rate:
          totals.totalMinutes > 0 ? round2(totals.totalAmount / (totals.totalMinutes / 60)) : 0,
        amount: totals.totalAmount,
        rate_bands: rateBands,
      },

      earnings: {
        base_salary: baseSalary,
        bonus,
        deductions,
        // Recomputed rather than trusted: the stored net_salary is written by
        // two different actions, and the payslip is the document staff keep.
        net_salary: baseSalary + bonus - deductions,
        differs_from_attendance:
          attendanceRows.length > 0 && Math.round(baseSalary) !== Math.round(totals.totalAmount),
      },

      payment: {
        status: payroll.payment_status ?? 'pending',
        method: payroll.payment_method,
        paid_date: payroll.paid_date,
      },

      notes: payroll.notes,
    },
  };
}
