'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ActionResult, Branch, CreateBranchInput, OperatingHours } from '@/types';

/** Branch stats for the performance comparison */
export interface BranchStats {
  branch_id: string;
  appointment_count: number;
  customer_count: number;
  revenue: number;
}

/**
 * Fetch branch performance stats (appointments, customers, revenue).
 */
export async function getBranchStats(): Promise<ActionResult<BranchStats[]>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const role = user.user_metadata?.role;
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can view branch stats.' };
  }

  // Get branches
  const { data: branches } = await supabase
    .from('branches')
    .select('id')
    .eq('is_active', true);

  if (!branches || branches.length === 0) {
    return { success: true, data: [] };
  }

  const stats: BranchStats[] = [];

  for (const branch of branches) {
    // Count appointments
    const { count: appointmentCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branch.id);

    // Count customers
    const { count: customerCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branch.id);

    // Sum revenue from invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('total')
      .eq('branch_id', branch.id);

    const revenue = (invoices ?? []).reduce((sum, inv) => sum + (inv.total ?? 0), 0);

    stats.push({
      branch_id: branch.id,
      appointment_count: appointmentCount ?? 0,
      customer_count: customerCount ?? 0,
      revenue,
    });
  }

  return { success: true, data: stats };
}

/**
 * Update branch operating hours.
 * Requires owner role.
 */
export async function updateBranchHours(
  branchId: string,
  operatingHours: OperatingHours
): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const role = user.user_metadata?.role;
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can update branch hours.' };
  }

  const { error } = await supabase
    .from('branches')
    .update({ operating_hours: operatingHours })
    .eq('id', branchId);

  if (error) {
    return { success: false, error: 'Failed to update operating hours. Please try again.' };
  }

  revalidatePath('/dashboard/branches');
  return { success: true, data: undefined };
}

/**
 * Create a new branch.
 * Requires owner role (enforced by RLS + UI guard).
 */
export async function createBranch(input: CreateBranchInput): Promise<ActionResult<Branch>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  const role = user.user_metadata?.role;
  if (!tenantId) {
    return { success: false, error: 'No tenant context found.' };
  }
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can manage branches.' };
  }

  // Validate required fields
  if (!input.name?.trim()) {
    return { success: false, error: 'Branch name is required.' };
  }

  // Default operating hours if not provided
  const defaultHours = {
    mon: { open: '09:00', close: '21:00' },
    tue: { open: '09:00', close: '21:00' },
    wed: { open: '09:00', close: '21:00' },
    thu: { open: '09:00', close: '21:00' },
    fri: { open: '09:00', close: '21:00' },
    sat: { open: '09:00', close: '21:00' },
    sun: { open: '10:00', close: '18:00' },
  };

  const { data, error } = await supabase
    .from('branches')
    .insert({
      tenant_id: tenantId,
      name: input.name.trim(),
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      operating_hours: input.operating_hours ?? defaultHours,
      is_default: false,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: 'Failed to create branch. Please try again.' };
  }

  revalidatePath('/branches');
  return { success: true, data: data as Branch };
}

/**
 * Update an existing branch.
 * Requires owner role (enforced by RLS + UI guard).
 */
export async function updateBranch(
  id: string,
  input: Partial<CreateBranchInput>
): Promise<ActionResult<Branch>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const role = user.user_metadata?.role;
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can manage branches.' };
  }

  // Validate fields if provided
  if (input.name !== undefined && !input.name.trim()) {
    return { success: false, error: 'Branch name cannot be empty.' };
  }

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.address !== undefined) updateData.address = input.address?.trim() || null;
  if (input.phone !== undefined) updateData.phone = input.phone?.trim() || null;
  if (input.operating_hours !== undefined) updateData.operating_hours = input.operating_hours;

  const { data, error } = await supabase
    .from('branches')
    .update(updateData as any)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { success: false, error: 'Failed to update branch. Please try again.' };
  }

  revalidatePath('/branches');
  return { success: true, data: data as Branch };
}

/**
 * Deactivate a branch by setting is_active = false.
 */
export async function deactivateBranch(id: string): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const role = user.user_metadata?.role;
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can deactivate branches.' };
  }

  // Prevent deactivating the default branch
  const { data: branch } = await supabase
    .from('branches')
    .select('is_default')
    .eq('id', id)
    .single();

  if (branch?.is_default) {
    return { success: false, error: 'Cannot deactivate the default branch.' };
  }

  const { error } = await supabase
    .from('branches')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    return { success: false, error: 'Failed to deactivate branch. Please try again.' };
  }

  revalidatePath('/branches');
  return { success: true, data: undefined };
}
