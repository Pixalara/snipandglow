'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ActionResult, Employee, CreateEmployeeInput, UserRole } from '@/types';

/**
 * Create a new employee.
 * Requires owner role (enforced by RLS + UI guard).
 */
export async function createEmployee(input: CreateEmployeeInput): Promise<ActionResult<Employee>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  const role = user.user_metadata?.role;
  if (!tenantId) {
    return { success: false, error: 'No tenant context found.' };
  }
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can manage staff.' };
  }

  // Validate required fields
  if (!input.name?.trim()) {
    return { success: false, error: 'Employee name is required.' };
  }
  if (!input.phone?.trim()) {
    return { success: false, error: 'Phone number is required.' };
  }
  if (!input.role) {
    return { success: false, error: 'Role is required.' };
  }
  if (!input.branch_id) {
    return { success: false, error: 'Branch assignment is required.' };
  }

  const { data, error } = await supabase
    .from('employees')
    .insert({
      tenant_id: tenantId,
      branch_id: input.branch_id,
      auth_user_id: '', // Will be linked when employee logs in
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      role: input.role,
      specializations: input.specializations ?? [],
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: 'Failed to create employee. Please try again.' };
  }

  revalidatePath('/staff');
  return { success: true, data: data as Employee };
}

/**
 * Update an existing employee.
 * Requires owner role (enforced by RLS + UI guard).
 */
export async function updateEmployee(
  id: string,
  input: Partial<CreateEmployeeInput>
): Promise<ActionResult<Employee>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const role = user.user_metadata?.role;
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can manage staff.' };
  }

  // Validate fields if provided
  if (input.name !== undefined && !input.name.trim()) {
    return { success: false, error: 'Employee name cannot be empty.' };
  }
  if (input.phone !== undefined && !input.phone.trim()) {
    return { success: false, error: 'Phone number cannot be empty.' };
  }

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.phone !== undefined) updateData.phone = input.phone.trim();
  if (input.email !== undefined) updateData.email = input.email?.trim() || null;
  if (input.role !== undefined) updateData.role = input.role;
  if (input.branch_id !== undefined) updateData.branch_id = input.branch_id;
  if (input.specializations !== undefined) updateData.specializations = input.specializations;

  const { data, error } = await supabase
    .from('employees')
    .update(updateData as any)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { success: false, error: 'Failed to update employee. Please try again.' };
  }

  revalidatePath('/staff');
  return { success: true, data: data as Employee };
}

/**
 * Deactivate an employee by setting is_active = false.
 * This revokes their login access without deleting the record.
 */
export async function deactivateEmployee(id: string): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const role = user.user_metadata?.role;
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can deactivate staff.' };
  }

  const { error } = await supabase
    .from('employees')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    return { success: false, error: 'Failed to deactivate employee. Please try again.' };
  }

  revalidatePath('/staff');
  return { success: true, data: undefined };
}

/**
 * Change an employee's role.
 * Requires owner role. Cannot change own role.
 */
export async function changeEmployeeRole(
  employeeId: string,
  newRole: UserRole
): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const currentRole = user.user_metadata?.role;
  if (currentRole !== 'owner') {
    return { success: false, error: 'Only owners can change employee roles.' };
  }

  // Validate role
  const validRoles: UserRole[] = ['owner', 'manager', 'staff'];
  if (!validRoles.includes(newRole)) {
    return { success: false, error: 'Invalid role specified.' };
  }

  // Prevent changing own role
  const { data: employee } = await supabase
    .from('employees')
    .select('auth_user_id')
    .eq('id', employeeId)
    .single();

  if (employee?.auth_user_id === user.id) {
    return { success: false, error: 'You cannot change your own role.' };
  }

  const { error } = await supabase
    .from('employees')
    .update({ role: newRole })
    .eq('id', employeeId);

  if (error) {
    return { success: false, error: 'Failed to change role. Please try again.' };
  }

  revalidatePath('/dashboard/staff');
  return { success: true, data: undefined };
}
