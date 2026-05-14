'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { isValidIndianPhone, formatPhoneE164 } from '@/lib/utils';
import type { ActionResult, Customer, CreateCustomerInput, UpdateCustomerInput, Membership } from '@/types';

/**
 * Create a new customer with phone validation.
 * Phone must be a valid 10-digit Indian mobile number.
 * Stores phone in E.164 format (+91XXXXXXXXXX).
 */
export async function createCustomer(input: CreateCustomerInput): Promise<ActionResult<Customer>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Validate phone
  if (!isValidIndianPhone(input.phone)) {
    return { success: false, error: 'Please enter a valid 10-digit Indian mobile number (starting with 6-9).' };
  }

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  if (!tenantId || !branchId) {
    return { success: false, error: 'No tenant or branch context found.' };
  }

  const formattedPhone = formatPhoneE164(input.phone);

  const { data, error } = await supabase
    .from('customers')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      name: input.name.trim(),
      phone: formattedPhone,
      email: input.email?.trim() || null,
      gender: input.gender || null,
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

  // Validate phone if provided
  if (input.phone && !isValidIndianPhone(input.phone)) {
    return { success: false, error: 'Please enter a valid 10-digit Indian mobile number.' };
  }

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.phone !== undefined) updateData.phone = formatPhoneE164(input.phone);
  if (input.email !== undefined) updateData.email = input.email?.trim() || null;
  if (input.gender !== undefined) updateData.gender = input.gender || null;
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

  const { data } = await supabase
    .from('memberships')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  return (data ?? []) as Membership[];
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

  // Validate phone
  if (!isValidIndianPhone(input.phone)) {
    return { success: false, error: 'Please enter a valid 10-digit Indian mobile number (starting with 6-9).' };
  }

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  if (!tenantId || !branchId) {
    return { success: false, error: 'No tenant or branch context found.' };
  }

  const formattedPhone = formatPhoneE164(input.phone);
  const admin = createAdminClient();

  // Create customer
  const { data, error } = await admin
    .from('customers')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      name: input.name.trim(),
      phone: formattedPhone,
      email: input.email?.trim() || null,
      gender: input.gender || null,
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
