import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PayrollClient, type PayrollRow } from './payroll-client';
import { BadgeDollarSign } from 'lucide-react';
import type { Employee, UserRole } from '@/types';

// =============================================================================
// Payroll Page — Server Component (Owner Only)
// =============================================================================

export default async function PayrollPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // Only owners can access payroll
  if (role !== 'owner') {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-destructive">Access denied. Only owners can manage payroll.</p>
      </div>
    );
  }

  // Fetch all employees using admin client to bypass RLS
  const admin = createAdminClient();

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) redirect('/onboarding');

  const { data: employees, error: employeesError } = await admin
    .from('employees')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true });

  if (employeesError) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border border-green-200/50 dark:border-green-800/30 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
              <BadgeDollarSign className="size-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Payroll</h1>
              <p className="text-sm text-destructive">Failed to load data</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fetch all payroll records
  const { data: payrollRecords, error: payrollError } = await admin
    .from('payroll' as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('month', { ascending: false });

  if (payrollError) {
    // Table might not exist yet — show empty state
    const currentMonth = new Date().toISOString().slice(0, 7);
    return (
      <PayrollClient
        payrollRecords={[]}
        employees={(employees ?? []) as Employee[]}
        currentMonth={currentMonth}
        role={role}
      />
    );
  }

  // Build employee name map
  const employeeMap: Record<string, string> = {};
  for (const emp of (employees ?? [])) {
    employeeMap[emp.id] = emp.name;
  }
  // Also map auth_user_id to name for cases where employee_id is actually the auth user id
  for (const emp of (employees ?? [])) {
    if (emp.auth_user_id) {
      employeeMap[emp.auth_user_id] = emp.name;
    }
  }

  const currentMonth = new Date().toISOString().slice(0, 7);

  const rows: PayrollRow[] = (payrollRecords ?? []).map((rec: any) => ({
    id: rec.id,
    employee_id: rec.employee_id,
    employee_name: employeeMap[rec.employee_id] ?? 'Unknown',
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

  return (
    <PayrollClient
      payrollRecords={rows}
      employees={(employees ?? []) as Employee[]}
      currentMonth={currentMonth}
      role={role}
    />
  );
}
