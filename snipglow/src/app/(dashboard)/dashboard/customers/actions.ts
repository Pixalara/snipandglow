'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { normalizePhone, toTitleCase, isValidDateOfBirth } from '@/lib/utils';
import { istCurrentMonth } from '@/lib/attendance';
import type { ActionResult, Customer, CreateCustomerInput, UpdateCustomerInput, Membership } from '@/types';

/** Shown when a phone can't be understood. Names the international case, since
 *  an Indian mobile "just works" and only foreign numbers need the hint. */
const PHONE_ERROR =
  'Please enter a valid phone number. For an international number, include the country code, e.g. +44 7911 123456.';

/**
 * Create a new customer with phone validation.
 * Phone must be a valid 10-digit Indian mobile number.
 * Stores phone in E.164 format (+91XXXXXXXXXX).
 */
export async function createCustomer(input: CreateCustomerInput): Promise<ActionResult<Customer>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Validate + canonicalise phone. normalizePhone accepts an Indian mobile or an
  // international number carrying a country code, and returns E.164 or null.
  const formattedPhone = normalizePhone(input.phone);
  if (!formattedPhone) {
    return { success: false, error: PHONE_ERROR };
  }

  // Validate date of birth if provided
  if (input.date_of_birth && !isValidDateOfBirth(input.date_of_birth)) {
    return { success: false, error: 'Please enter a valid date of birth (between 1950 and today).' };
  }

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  if (!tenantId || !branchId) {
    return { success: false, error: 'No tenant or branch context found.' };
  }

  const { data, error } = await supabase
    .from('customers')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      name: toTitleCase(input.name),
      phone: formattedPhone,
      email: input.email?.trim() || null,
      gender: input.gender || null,
      date_of_birth: input.date_of_birth || null,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation (duplicate phone)
    if (error.code === '23505') {
      return { success: false, error: 'A customer with this phone number already exists.' };
    }
    return { success: false, error: 'Failed to create customer. Please try again.' };
  }

  revalidatePath('/dashboard/customers');
  return { success: true, data: data as Customer };
}

/**
 * Update an existing customer.
 */
export async function updateCustomer(id: string, input: UpdateCustomerInput): Promise<ActionResult<Customer>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Validate + canonicalise phone if provided.
  let normalizedPhone: string | undefined;
  if (input.phone !== undefined) {
    const normalized = normalizePhone(input.phone);
    if (!normalized) {
      return { success: false, error: PHONE_ERROR };
    }
    normalizedPhone = normalized;
  }

  // Validate date of birth if a non-null value is provided
  if (input.date_of_birth && !isValidDateOfBirth(input.date_of_birth)) {
    return { success: false, error: 'Please enter a valid date of birth (between 1950 and today).' };
  }

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = toTitleCase(input.name);
  if (normalizedPhone !== undefined) updateData.phone = normalizedPhone;
  if (input.email !== undefined) updateData.email = input.email?.trim() || null;
  if (input.gender !== undefined) updateData.gender = input.gender || null;
  if (input.date_of_birth !== undefined) updateData.date_of_birth = input.date_of_birth || null;
  if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null;

  const { data, error } = await supabase
    .from('customers')
    .update(updateData as any)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'A customer with this phone number already exists.' };
    }
    return { success: false, error: 'Failed to update customer. Please try again.' };
  }

  revalidatePath('/dashboard/customers');
  revalidatePath(`/dashboard/customers/${id}`);
  return { success: true, data: data as Customer };
}

/**
 * Delete a customer (soft delete by checking dependencies first).
 * If the customer has appointments or invoices, deletion is blocked.
 */
export async function deleteCustomer(id: string): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Check for dependencies
  const [apptRes, invRes] = await Promise.all([
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('customer_id', id),
    supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('customer_id', id),
  ]);

  const apptCount = apptRes.count ?? 0;
  const invCount = invRes.count ?? 0;

  if (apptCount > 0 || invCount > 0) {
    return {
      success: false,
      error: `Cannot delete customer. They have ${apptCount} appointment(s) and ${invCount} invoice(s). Delete those first or contact support.`,
    };
  }

  // Delete customer memberships first (CASCADE may not be set)
  await supabase.from('customer_memberships').delete().eq('customer_id', id);

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);

  if (error) {
    return { success: false, error: 'Failed to delete customer. Please try again.' };
  }

  revalidatePath('/dashboard/customers');
  return { success: true, data: undefined };
}

/**
 * Search customers by name or phone.
 * Returns up to 10 results for autocomplete/search.
 */
export async function searchCustomers(query: string): Promise<Customer[]> {
  if (!query.trim()) return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from('customers')
    .select('*')
    .or(`name.ilike.%${query.trim()}%,phone.ilike.%${query.trim()}%`)
    .order('name')
    .limit(10);

  return (data ?? []) as Customer[];
}


/**
 * Get all active membership plans for the current tenant/branch.
 */
export async function getAvailableMemberships(): Promise<Membership[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  if (!tenantId || !branchId) return [];

  const admin = createAdminClient();

  const { data } = await admin
    .from('memberships')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  return (data ?? []) as Membership[];
}

/**
 * Get the current active membership for a customer.
 * Returns membership_id if active, null otherwise.
 */
export async function getCustomerMembership(customerId: string): Promise<{ membershipId: string; membershipName: string; discountPct: number } | null> {
  const admin = createAdminClient();

  const today = new Date().toISOString().split('T')[0];

  const { data } = await admin
    .from('customer_memberships')
    .select('membership_id, memberships(name, discount_pct)')
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .gte('end_date', today)
    .limit(1)
    .maybeSingle() as any;

  if (!data) return null;

  const membership = data.memberships as { name: string; discount_pct: number } | null;
  return {
    membershipId: data.membership_id,
    membershipName: membership?.name ?? 'Unknown',
    discountPct: membership?.discount_pct ?? 0,
  };
}

/**
 * Assign or change a customer's membership.
 * If membershipId is empty/null, removes the active membership.
 */
export async function assignCustomerMembership(
  customerId: string,
  membershipId: string | null
): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  if (!tenantId || !branchId) {
    return { success: false, error: 'No tenant or branch context found.' };
  }

  const admin = createAdminClient();

  // First, expire any existing active membership for this customer
  const today = new Date().toISOString().split('T')[0];
  await admin
    .from('customer_memberships')
    .update({ status: 'expired' } as any)
    .eq('customer_id', customerId)
    .eq('status', 'active');

  // If no new membership selected, just return
  if (!membershipId) {
    revalidatePath('/dashboard/customers');
    return { success: true, data: undefined };
  }

  // Fetch the membership plan to get validity_days
  const { data: membership } = await admin
    .from('memberships')
    .select('validity_days')
    .eq('id', membershipId)
    .eq('is_active', true)
    .single();

  if (!membership) {
    return { success: false, error: 'Membership plan not found or inactive.' };
  }

  // Create new customer_membership
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + membership.validity_days);

  const { error } = await admin
    .from('customer_memberships')
    .insert({
      customer_id: customerId,
      membership_id: membershipId,
      tenant_id: tenantId,
      branch_id: branchId,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      status: 'active',
    } as any);

  if (error) {
    return { success: false, error: 'Failed to assign membership. Please try again.' };
  }

  revalidatePath('/dashboard/customers');
  return { success: true, data: undefined };
}

/**
 * Create a customer and optionally assign a membership.
 */
export async function createCustomerWithMembership(
  input: CreateCustomerInput,
  membershipId?: string
): Promise<ActionResult<Customer>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Validate + canonicalise phone.
  const formattedPhone = normalizePhone(input.phone);
  if (!formattedPhone) {
    return { success: false, error: PHONE_ERROR };
  }

  // Validate date of birth if provided
  if (input.date_of_birth && !isValidDateOfBirth(input.date_of_birth)) {
    return { success: false, error: 'Please enter a valid date of birth (between 1950 and today).' };
  }

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  if (!tenantId || !branchId) {
    return { success: false, error: 'No tenant or branch context found.' };
  }

  const admin = createAdminClient();

  // Create customer
  const { data, error } = await admin
    .from('customers')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      name: toTitleCase(input.name),
      phone: formattedPhone,
      email: input.email?.trim() || null,
      gender: input.gender || null,
      date_of_birth: input.date_of_birth || null,
      notes: input.notes?.trim() || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'A customer with this phone number already exists.' };
    }
    return { success: false, error: 'Failed to create customer. Please try again.' };
  }

  // Assign membership if selected
  if (membershipId && data) {
    const { data: membership } = await admin
      .from('memberships')
      .select('validity_days')
      .eq('id', membershipId)
      .eq('is_active', true)
      .single();

    if (membership) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + membership.validity_days);

      await admin
        .from('customer_memberships')
        .insert({
          customer_id: data.id,
          membership_id: membershipId,
          tenant_id: tenantId,
          branch_id: branchId,
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          status: 'active',
        } as any);
    }
  }

  revalidatePath('/dashboard/customers');
  return { success: true, data: data as Customer };
}

/**
 * Fetch loyalty tier config for the current tenant.
 * Called client-side to always get fresh config.
 */
export async function getLoyaltyConfig(): Promise<{ regular_min: number; silver_min: number; gold_min: number; vip_min: number }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { regular_min: 1, silver_min: 5, gold_min: 10, vip_min: 25 };

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) return { regular_min: 1, silver_min: 5, gold_min: 10, vip_min: 25 };

  const { data: tenant } = await supabase.from('tenants').select('settings').eq('id', tenantId).single();
  const saved = (tenant?.settings as any)?.loyalty_tiers;
  return {
    regular_min: saved?.regular_min ?? 1,
    silver_min: saved?.silver_min ?? 5,
    gold_min: saved?.gold_min ?? 10,
    vip_min: saved?.vip_min ?? 25,
  };
}

// =============================================================================
// Membership usage
//
// "How often did this customer use their membership, how much has it saved them,
// and on which services?" — answerable only because invoices now carry
// customer_membership_id (migration 052). A bill counts as membership usage when
// it was attributed to a membership, which the billing code does only when the
// bill actually carried a discount.
// =============================================================================

/** One service the customer had discounted under their membership. */
export interface MembershipServiceUsage {
  name: string;
  /** How many billed lines of this service were discounted under the plan. */
  count: number;
  /** Total rupees discounted on those lines. */
  saved: number;
}

export interface MembershipUsageSummary {
  /** Attributed bills, all time. */
  visits: number;
  /** Total saved across all attributed bills (services + products). */
  savedLifetime: number;
  /** Attributed bills in the current calendar month (IST). */
  visitsThisMonth: number;
  savedThisMonth: number;
  /** created_at of the most recent attributed bill, or null. */
  lastUsedAt: string | null;
  /** Services discounted under the plan, richest saving first. */
  services: MembershipServiceUsage[];
}

const EMPTY_USAGE: MembershipUsageSummary = {
  visits: 0,
  savedLifetime: 0,
  visitsThisMonth: 0,
  savedThisMonth: 0,
  lastUsedAt: null,
  services: [],
};

/**
 * Usage figures for a customer's membership, derived from the invoices that
 * carried a membership discount. Owner/manager reads via the admin client, like
 * the other customer-page analytics.
 */
export async function getCustomerMembershipUsage(
  customerId: string
): Promise<MembershipUsageSummary> {
  if (!customerId) return EMPTY_USAGE;

  const admin = createAdminClient();

  // Bills attributed to a membership for this customer.
  const { data: invoiceData } = await (admin as any)
    .from('invoices')
    .select('id, discount_amount, created_at')
    .eq('customer_id', customerId)
    .not('customer_membership_id', 'is', null)
    .order('created_at', { ascending: false });

  const invoices = (invoiceData ?? []) as {
    id: string;
    discount_amount: number | null;
    created_at: string | null;
  }[];
  if (invoices.length === 0) return EMPTY_USAGE;

  // Bucket into lifetime and the current IST month. Derived in JS from each
  // timestamp's IST calendar date, rather than a UTC SQL range, so the month
  // boundary is the salon's local one.
  const currentMonth = istCurrentMonth();
  const istMonthOf = (iso: string | null): string =>
    iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7) : '';

  let savedLifetime = 0;
  let savedThisMonth = 0;
  let visitsThisMonth = 0;
  for (const inv of invoices) {
    const amount = Number(inv.discount_amount) || 0;
    savedLifetime += amount;
    if (istMonthOf(inv.created_at) === currentMonth) {
      visitsThisMonth += 1;
      savedThisMonth += amount;
    }
  }

  // Per-service breakdown from the service lines of those bills.
  const { data: itemData } = await (admin as any)
    .from('invoice_items')
    .select('service_name, discount_amount, item_type')
    .in('invoice_id', invoices.map((i) => i.id))
    .eq('item_type', 'service');

  const byService = new Map<string, { count: number; saved: number }>();
  for (const item of (itemData ?? []) as { service_name: string; discount_amount: number | null }[]) {
    const key = item.service_name || 'Service';
    const current = byService.get(key) ?? { count: 0, saved: 0 };
    current.count += 1;
    current.saved += Number(item.discount_amount) || 0;
    byService.set(key, current);
  }
  const services = [...byService.entries()]
    .map(([name, v]) => ({ name, count: v.count, saved: v.saved }))
    .sort((a, b) => b.saved - a.saved);

  return {
    visits: invoices.length,
    savedLifetime,
    savedThisMonth,
    visitsThisMonth,
    lastUsedAt: invoices[0]?.created_at ?? null,
    services,
  };
}
