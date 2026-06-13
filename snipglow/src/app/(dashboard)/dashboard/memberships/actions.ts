'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { toTitleCase } from '@/lib/utils';
import type { ActionResult, Membership, CustomerMembership, CreateMembershipInput, AssignMembershipInput } from '@/types';

// =============================================================================
// Membership Plan CRUD — Server Actions
// Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
// =============================================================================

/**
 * Create a new membership plan.
 * Requires owner role (enforced by RLS + UI guard).
 */
export async function createMembership(input: CreateMembershipInput): Promise<ActionResult<Membership>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  if (!tenantId || !branchId) {
    return { success: false, error: 'No tenant or branch context found.' };
  }

  // Validate required fields
  if (!input.name?.trim()) {
    return { success: false, error: 'Membership name is required.' };
  }
  if (input.price == null || input.price < 0) {
    return { success: false, error: 'Price must be a non-negative number.' };
  }
  if (!input.validity_days || input.validity_days < 1) {
    return { success: false, error: 'Validity must be at least 1 day.' };
  }
  if (input.discount_pct == null || input.discount_pct < 0 || input.discount_pct > 100) {
    return { success: false, error: 'Discount percentage must be between 0 and 100.' };
  }

  const { data, error } = await supabase
    .from('memberships')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      name: toTitleCase(input.name),
      description: input.description?.trim() || null,
      price: input.price,
      validity_days: input.validity_days,
      discount_pct: input.discount_pct,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: 'Failed to create membership plan. Please try again.' };
  }

  revalidatePath('/memberships');
  return { success: true, data: data as Membership };
}

/**
 * Update an existing membership plan.
 * Requires owner role (enforced by RLS + UI guard).
 */
export async function updateMembership(id: string, input: Partial<CreateMembershipInput>): Promise<ActionResult<Membership>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Validate fields if provided
  if (input.name !== undefined && !input.name.trim()) {
    return { success: false, error: 'Membership name cannot be empty.' };
  }
  if (input.price !== undefined && input.price < 0) {
    return { success: false, error: 'Price must be a non-negative number.' };
  }
  if (input.validity_days !== undefined && input.validity_days < 1) {
    return { success: false, error: 'Validity must be at least 1 day.' };
  }
  if (input.discount_pct !== undefined && (input.discount_pct < 0 || input.discount_pct > 100)) {
    return { success: false, error: 'Discount percentage must be between 0 and 100.' };
  }

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = toTitleCase(input.name);
  if (input.description !== undefined) updateData.description = input.description?.trim() || null;
  if (input.price !== undefined) updateData.price = input.price;
  if (input.validity_days !== undefined) updateData.validity_days = input.validity_days;
  if (input.discount_pct !== undefined) updateData.discount_pct = input.discount_pct;

  const { data, error } = await supabase
    .from('memberships')
    .update(updateData as any)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { success: false, error: 'Failed to update membership plan. Please try again.' };
  }

  revalidatePath('/memberships');
  return { success: true, data: data as Membership };
}

/**
 * Soft-delete a membership plan by setting is_active = false.
 * Requirements: 8.1
 */
export async function deleteMembership(id: string): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Check if membership has active customer assignments
  const { count: activeCount } = await supabase
    .from('customer_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('membership_id', id)
    .eq('status', 'active');

  // Soft-delete: set is_active = false (even if active assignments exist)
  const { error } = await supabase
    .from('memberships')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    return { success: false, error: 'Failed to delete membership plan. Please try again.' };
  }

  revalidatePath('/memberships');

  if (activeCount && activeCount > 0) {
    return {
      success: true,
      data: undefined,
    };
  }

  return { success: true, data: undefined };
}

/**
 * Assign a membership to a customer.
 * Creates customer_membership with start_date = today, end_date = today + validity_days, status = 'active'.
 * Requirements: 8.2
 */
export async function assignMembership(input: AssignMembershipInput): Promise<ActionResult<CustomerMembership>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  if (!tenantId || !branchId) {
    return { success: false, error: 'No tenant or branch context found.' };
  }

  // Fetch the membership plan to get validity_days
  const { data: membership, error: membershipError } = await supabase
    .from('memberships')
    .select('*')
    .eq('id', input.membership_id)
    .eq('is_active', true)
    .single();

  if (membershipError || !membership) {
    return { success: false, error: 'Membership plan not found or inactive.' };
  }

  // Calculate start and end dates
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + membership.validity_days);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Check if customer already has an active membership
  const { count: existingCount } = await supabase
    .from('customer_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', input.customer_id)
    .eq('status', 'active');

  if (existingCount && existingCount > 0) {
    return { success: false, error: 'Customer already has an active membership. Please wait for it to expire or cancel it first.' };
  }

  const { data, error } = await supabase
    .from('customer_memberships')
    .insert({
      customer_id: input.customer_id,
      membership_id: input.membership_id,
      tenant_id: tenantId,
      branch_id: branchId,
      start_date: startDateStr,
      end_date: endDateStr,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: 'Failed to assign membership. Please try again.' };
  }

  revalidatePath('/memberships');
  revalidatePath('/customers');
  return { success: true, data: data as CustomerMembership };
}

/**
 * Get the active membership for a customer (used by POS billing to auto-apply discount).
 * Requirements: 8.3
 */
export async function getActiveMembershipForCustomer(customerId: string): Promise<Membership | null> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Find active customer_membership
  const { data: customerMembership } = await supabase
    .from('customer_memberships')
    .select('membership_id')
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .single();

  if (!customerMembership) return null;

  // Fetch the membership plan details
  const { data: membership } = await supabase
    .from('memberships')
    .select('*')
    .eq('id', customerMembership.membership_id)
    .single();

  return (membership as Membership) ?? null;
}

/**
 * Get memberships expiring within 7 days (for follow-up reminder list).
 * Requirements: 8.6
 */
export async function getMembershipsExpiringWithin7Days(): Promise<CustomerMembership[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const today = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(today.getDate() + 7);

  const todayStr = today.toISOString().split('T')[0];
  const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('customer_memberships')
    .select('*')
    .eq('status', 'active')
    .gte('end_date', todayStr)
    .lte('end_date', sevenDaysStr)
    .order('end_date', { ascending: true });

  if (error) return [];

  return (data ?? []) as CustomerMembership[];
}

/**
 * Save custom loyalty tier thresholds to tenant settings.
 */
export async function updateLoyaltyTiers(config: {
  regular_min: number;
  silver_min: number;
  gold_min: number;
  vip_min: number;
}): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) return { success: false, error: 'No tenant context found.' };

  // Validate: thresholds must be ascending
  if (config.regular_min < 1) return { success: false, error: 'Regular must start at 1 or more visits.' };
  if (config.silver_min <= config.regular_min) return { success: false, error: 'Silver must be higher than Regular.' };
  if (config.gold_min <= config.silver_min) return { success: false, error: 'Gold must be higher than Silver.' };
  if (config.vip_min <= config.gold_min) return { success: false, error: 'VIP must be higher than Gold.' };

  const { data: tenant } = await supabase.from('tenants').select('settings').eq('id', tenantId).single();
  const currentSettings = (tenant?.settings as Record<string, unknown>) ?? {};

  const { error } = await supabase
    .from('tenants')
    .update({ settings: { ...currentSettings, loyalty_tiers: config } })
    .eq('id', tenantId);

  if (error) return { success: false, error: 'Failed to save loyalty tier settings.' };

  revalidatePath('/dashboard/memberships');
  revalidatePath('/dashboard/customers');
  return { success: true, data: undefined };
}
