'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type { ActionResult, Expense, CreateExpenseInput, UpdateExpenseInput } from '@/types';

// Note: The 'expenses' table is created via migration 010 but not yet in generated types.
// We use type assertions for Supabase queries on this table.

/**
 * Create a new expense record.
 * Requires owner or manager role.
 */
export async function createExpense(input: CreateExpenseInput): Promise<ActionResult<Expense>> {
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
  if (role !== 'owner' && role !== 'manager') {
    return { success: false, error: 'Only owners and managers can add expenses.' };
  }

  // Validate required fields
  if (!input.category) {
    return { success: false, error: 'Category is required.' };
  }
  if (!input.description?.trim()) {
    return { success: false, error: 'Description is required.' };
  }
  if (!input.amount || input.amount <= 0) {
    return { success: false, error: 'Amount must be greater than zero.' };
  }
  if (!input.expense_date) {
    return { success: false, error: 'Expense date is required.' };
  }

  // Get employee ID for created_by
  const { data: employee } = await supabase
    .from('employees')
    .select('id')
    .eq('auth_user_id', user.id)
    .single();

  const { data, error } = await admin
    .from('expenses')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      category: input.category,
      description: input.description.trim(),
      amount: input.amount,
      expense_date: input.expense_date,
      payment_method: input.payment_method || 'cash',
      receipt_note: input.receipt_note?.trim() || null,
      created_by: employee?.id || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Expense creation error:', error);
    return { success: false, error: 'Failed to create expense. Please try again.' };
  }

  revalidatePath('/dashboard/expenses');
  return { success: true, data: data as Expense };
}

/**
 * Update an existing expense.
 * Requires owner role.
 */
export async function updateExpense(
  id: string,
  input: UpdateExpenseInput
): Promise<ActionResult<Expense>> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const role = user.user_metadata?.role;
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can edit expenses.' };
  }

  if (input.description !== undefined && !input.description.trim()) {
    return { success: false, error: 'Description cannot be empty.' };
  }
  if (input.amount !== undefined && input.amount <= 0) {
    return { success: false, error: 'Amount must be greater than zero.' };
  }

  const updateData: Record<string, unknown> = {};
  if (input.category !== undefined) updateData.category = input.category;
  if (input.description !== undefined) updateData.description = input.description.trim();
  if (input.amount !== undefined) updateData.amount = input.amount;
  if (input.expense_date !== undefined) updateData.expense_date = input.expense_date;
  if (input.payment_method !== undefined) updateData.payment_method = input.payment_method;
  if (input.receipt_note !== undefined) updateData.receipt_note = input.receipt_note?.trim() || null;

  const { data, error } = await admin
    .from('expenses')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Expense update error:', error);
    return { success: false, error: 'Failed to update expense. Please try again.' };
  }

  revalidatePath('/dashboard/expenses');
  return { success: true, data: data as Expense };
}

/**
 * Delete an expense record.
 * Requires owner role.
 */
export async function deleteExpense(id: string): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const role = user.user_metadata?.role;
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can delete expenses.' };
  }

  const { error } = await admin
    .from('expenses')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Expense delete error:', error);
    return { success: false, error: 'Failed to delete expense. Please try again.' };
  }

  revalidatePath('/dashboard/expenses');
  return { success: true, data: undefined };
}
