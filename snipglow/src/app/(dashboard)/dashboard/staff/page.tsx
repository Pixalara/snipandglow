import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { istCurrentMonth } from '@/lib/attendance';
import { StaffWorkspace, parseStaffTab } from './staff-workspace';
import type { PayrollRow } from './payroll-client';
import type { Employee, Branch, UserRole } from '@/types';

// =============================================================================
// Staff & Payroll — Server Component (Owner Only)
//
// One page for the whole pay cycle: team roster, attendance, payroll and
// payslips. Previously this was two routes, which meant an owner recording hours
// had to leave the module to pay them.
//
// Two Supabase clients on purpose. Employees and branches are read through the
// RLS-scoped client, which is how the staff page always read them. Payroll is
// read through the admin client with an explicit tenant filter, which is how the
// payroll page always read it. Both paths are proven, so the merge does not
// change either one.
// =============================================================================

interface StaffPageProps {
  searchParams: Promise<{ tab?: string }>;
}

/** Shape of a payroll row as it comes back from the database. */
interface PayrollRecord {
  id: string;
  employee_id: string;
  month: string;
  base_salary: number;
  bonus: number | null;
  deductions: number | null;
  net_salary: number;
  payment_status: string | null;
  paid_date: string | null;
  payment_method: string | null;
  notes: string | null;
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // One gate covers every tab — attendance, payroll and payslips were each
  // owner-only before the merge, and the roster was too.
  if (role !== 'owner') {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-destructive">
          Access denied. Only owners can manage staff and payroll.
        </p>
      </div>
    );
  }

  const tenantId = user.user_metadata?.tenant_id as string | undefined;
  if (!tenantId) redirect('/onboarding');

  // ── Roster and branches (RLS-scoped) ─────────────────────────────────────
  const [employeesRes, branchesRes] = await Promise.all([
    supabase.from('employees').select('*').order('name', { ascending: true }),
    supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ]);

  if (employeesRes.error) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-destructive">Failed to load employees. Please try again.</p>
      </div>
    );
  }
  if (branchesRes.error) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-destructive">Failed to load branches. Please try again.</p>
      </div>
    );
  }

  const employees = (employeesRes.data ?? []) as Employee[];

  // ── Payroll (admin client, explicit tenant scope) ────────────────────────
  const { data: payrollRecords, error: payrollError } = await (createAdminClient()
    .from('payroll' as never)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('month', { ascending: false }) as unknown as Promise<{
    data: PayrollRecord[] | null;
    error: { message: string } | null;
  }>);

  // Names are keyed by BOTH the employee id and the auth user id, because some
  // older payroll rows stored the auth user id in employee_id.
  const employeeNames: Record<string, string> = {};
  for (const emp of employees) {
    employeeNames[emp.id] = emp.name;
    if (emp.auth_user_id) employeeNames[emp.auth_user_id] = emp.name;
  }

  // A missing payroll table degrades to an empty tab rather than taking down the
  // roster and attendance with it.
  const rows: PayrollRow[] = payrollError
    ? []
    : (payrollRecords ?? []).map((rec) => ({
        id: rec.id,
        employee_id: rec.employee_id,
        employee_name: employeeNames[rec.employee_id] ?? 'Unknown',
        month: rec.month,
        base_salary: rec.base_salary,
        bonus: rec.bonus ?? 0,
        deductions: rec.deductions ?? 0,
        net_salary: rec.net_salary,
        payment_status: rec.payment_status ?? 'pending',
        paid_date: rec.paid_date,
        payment_method: rec.payment_method,
        notes: rec.notes,
      }));

  if (payrollError) {
    console.error('[staff] payroll query failed:', payrollError.message);
  }

  return (
    <StaffWorkspace
      employees={employees}
      branches={(branchesRes.data ?? []) as Branch[]}
      payrollRecords={rows}
      // IST, not the server's UTC. `new Date().toISOString().slice(0,7)` would
      // report the previous month for the first 5.5 hours of every month in
      // India, so the payroll month picker would open on the wrong month.
      currentMonth={istCurrentMonth()}
      role={role}
      initialTab={parseStaffTab(params.tab)}
    />
  );
}
