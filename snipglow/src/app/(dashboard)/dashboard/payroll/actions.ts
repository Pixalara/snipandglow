'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type { ActionResult, Payroll, UpsertPayrollInput, MarkPayrollPaidInput } from '@/types';

/**
 * Create or update a payroll record for an employee in a given month.
 * Uses admin client to bypass RLS.
 */
export async function upsertPayroll(input: UpsertPayrollInput): Promise<ActionResult<Payroll>> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  const role = user.user_metadata?.role;

  if (!tenantId || !branchId) {
    return { success: false, error: 'No tenant or branch context found.' };
  }
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can manage payroll.' };
  }

  if (!input.employee_id) {
    return { success: false, error: 'Employee is required.' };
  }
  if (!input.month) {
    return { success: false, error: 'Month is required.' };
  }
  if (input.base_salary < 0) {
    return { success: false, error: 'Base salary cannot be negative.' };
  }

  const bonus = input.bonus ?? 0;
  const deductions = input.deductions ?? 0;
  const netSalary = input.base_salary + bonus - deductions;

  // Check if a record already exists for this employee + month
  const { data: existing } = await admin
    .from('payroll' as any)
    .select('id')
    .eq('employee_id', input.employee_id)
    .eq('month', input.month)
    .single();

  if (existing) {
    // Update existing record
    const { data, error } = await admin
      .from('payroll' as any)
      .update({
        base_salary: input.base_salary,
        bonus,
        deductions,
        net_salary: netSalary,
        notes: input.notes?.trim() || null,
      })
      .eq('id', (existing as any).id)
      .select()
      .single();

    if (error) {
      console.error('Payroll update error:', error);
      return { success: false, error: 'Failed to update payroll record. Please try again.' };
    }

    revalidatePath('/dashboard/payroll');
    return { success: true, data: data as unknown as Payroll };
  }

  // Create new record
  const { data, error } = await admin
    .from('payroll' as any)
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      employee_id: input.employee_id,
      month: input.month,
      base_salary: input.base_salary,
      bonus,
      deductions,
      net_salary: netSalary,
      payment_status: 'pending',
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Payroll creation error:', error);
    return { success: false, error: 'Failed to create payroll record. Please try again.' };
  }

  revalidatePath('/dashboard/payroll');
  return { success: true, data: data as unknown as Payroll };
}

/**
 * Mark a payroll record as paid.
 */
export async function markPayrollPaid(input: MarkPayrollPaidInput): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const role = user.user_metadata?.role;
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can manage payroll.' };
  }

  if (!input.payroll_id) {
    return { success: false, error: 'Payroll record is required.' };
  }
  if (!input.payment_method) {
    return { success: false, error: 'Payment method is required.' };
  }
  if (!input.paid_date) {
    return { success: false, error: 'Payment date is required.' };
  }

  const { error } = await admin
    .from('payroll' as any)
    .update({
      payment_status: 'paid',
      payment_method: input.payment_method,
      paid_date: input.paid_date,
    })
    .eq('id', input.payroll_id);

  if (error) {
    console.error('Mark paid error:', error);
    return { success: false, error: 'Failed to mark as paid. Please try again.' };
  }

  revalidatePath('/dashboard/payroll');
  return { success: true, data: undefined };
}

/**
 * Delete a payroll record (only if pending).
 */
export async function deletePayroll(id: string): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const role = user.user_metadata?.role;
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can manage payroll.' };
  }

  // Only allow deleting pending records
  const { data: record } = await admin
    .from('payroll' as any)
    .select('payment_status')
    .eq('id', id)
    .single();

  if ((record as any)?.payment_status === 'paid') {
    return { success: false, error: 'Cannot delete a paid payroll record.' };
  }

  const { error } = await admin
    .from('payroll' as any)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Payroll delete error:', error);
    return { success: false, error: 'Failed to delete payroll record. Please try again.' };
  }

  revalidatePath('/dashboard/payroll');
  return { success: true, data: undefined };
}
