'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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

  const admin = createAdminClient();

  // ── Staff login provisioning ──────────────────────────────────────────────
  // When the owner provides a password, we create a real Supabase auth account
  // (email + password) so the staff member can log in on the same login screen.
  // The account is gated: the owner must verify the email + phone before the
  // staff member can actually sign in (enforced at login time).
  const wantsLogin = !!input.password;
  let authUserId: string | null = null;

  if (wantsLogin) {
    const email = input.email?.trim().toLowerCase();
    if (!email) {
      return { success: false, error: 'Email is required to give this staff member login access.' };
    }
    if (input.password!.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters.' };
    }

    // Reject if this email already has an auth account (avoid hijacking).
    const { data: existingList } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const clash = existingList?.users?.find((u: any) => (u.email || '').toLowerCase() === email);
    if (clash) {
      return { success: false, error: 'An account with this email already exists. Use a different email.' };
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true, // owner-provisioned; we gate login via verification flags
      user_metadata: {
        name: input.name.trim(),
        phone: input.phone.trim(),
        tenant_id: tenantId,
        branch_id: input.branch_id,
        role: input.role,
        signup_method: 'staff_password',
      },
    });

    if (createErr || !created?.user) {
      console.error('Staff auth account creation error:', createErr);
      return { success: false, error: 'Failed to create staff login. Please try again.' };
    }
    authUserId = created.user.id;
  }

  const { data, error } = await admin
    .from('employees')
    .insert({
      tenant_id: tenantId,
      branch_id: input.branch_id,
      auth_user_id: authUserId,
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email?.trim().toLowerCase() || null,
      role: input.role,
      specializations: input.specializations ?? [],
      is_active: true,
      login_method: wantsLogin ? 'password' : 'otp',
      // New password-based staff start UNVERIFIED — owner must verify before login.
      email_verified_by_owner: !wantsLogin,
      phone_verified_by_owner: !wantsLogin,
    } as any)
    .select()
    .single();

  if (error) {
    console.error('Employee creation error:', error);
    // Roll back the orphaned auth account if the employee row failed.
    if (authUserId) {
      await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    }
    return { success: false, error: 'Failed to create employee. Please try again.' };
  }

  revalidatePath('/dashboard/staff');
  return { success: true, data: data as Employee };
}

/**
 * Owner verifies a staff member's email and/or WhatsApp/phone. Both must be
 * verified before a password-based staff member can log in (security gate).
 * Requires owner role.
 */
export async function setEmployeeVerification(
  employeeId: string,
  updates: { email_verified?: boolean; phone_verified?: boolean }
): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  const role = user.user_metadata?.role;
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can verify staff.' };
  }

  const admin = createAdminClient();

  // Scope to the owner's tenant so one owner can't verify another salon's staff.
  const patch: Record<string, unknown> = {};
  if (updates.email_verified !== undefined) patch.email_verified_by_owner = updates.email_verified;
  if (updates.phone_verified !== undefined) patch.phone_verified_by_owner = updates.phone_verified;
  if (Object.keys(patch).length === 0) {
    return { success: false, error: 'Nothing to update.' };
  }

  const { error } = await (admin
    .from('employees')
    .update(patch as any)
    .eq('id', employeeId)
    .eq('tenant_id', tenantId) as any);

  if (error) {
    return { success: false, error: 'Failed to update verification. Please try again.' };
  }

  revalidatePath('/dashboard/staff');
  return { success: true, data: undefined };
}

/**
 * Owner resets a staff member's login password.
 * Requires owner role. Only applies to password-based staff accounts.
 */
export async function resetEmployeePassword(
  employeeId: string,
  newPassword: string
): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  const role = user.user_metadata?.role;
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can reset staff passwords.' };
  }
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters.' };
  }

  const admin = createAdminClient();
  const { data: emp } = await (admin
    .from('employees')
    .select('auth_user_id, login_method')
    .eq('id', employeeId)
    .eq('tenant_id', tenantId)
    .single() as any);

  if (!emp?.auth_user_id || emp.login_method !== 'password') {
    return { success: false, error: 'This staff member does not have a password login.' };
  }

  const { error } = await admin.auth.admin.updateUserById(emp.auth_user_id, {
    password: newPassword,
  });

  if (error) {
    return { success: false, error: 'Failed to reset password. Please try again.' };
  }

  revalidatePath('/dashboard/staff');
  return { success: true, data: undefined };
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
