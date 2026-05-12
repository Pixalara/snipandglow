'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { isValidIndianPhone, formatPhoneE164 } from '@/lib/utils';
import type { ActionResult, Lead, Customer, CreateLeadInput, UpdateLeadInput } from '@/types';

// Note: The 'leads' table is created via migration 011 but not yet in generated types.
// We use type assertions for Supabase queries on this table.

/**
 * Create a new lead.
 * Requires owner or manager role.
 */
export async function createLead(input: CreateLeadInput): Promise<ActionResult<Lead>> {
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
    return { success: false, error: 'Only owners and managers can add leads.' };
  }

  // Validate required fields
  if (!input.name?.trim()) {
    return { success: false, error: 'Name is required.' };
  }
  if (!input.phone?.trim()) {
    return { success: false, error: 'Phone is required.' };
  }
  if (!isValidIndianPhone(input.phone)) {
    return { success: false, error: 'Please enter a valid 10-digit Indian mobile number (starting with 6-9).' };
  }

  const formattedPhone = formatPhoneE164(input.phone);

  const { data, error } = await (admin as any)
    .from('leads')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      name: input.name.trim(),
      phone: formattedPhone,
      email: input.email?.trim() || null,
      source: input.source || 'walk_in',
      status: 'new',
      notes: input.notes?.trim() || null,
      interested_services: input.interested_services ?? [],
      follow_up_date: input.follow_up_date || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Lead creation error:', error);
    return { success: false, error: 'Failed to create lead. Please try again.' };
  }

  revalidatePath('/dashboard/leads');
  return { success: true, data: data as unknown as Lead };
}

/**
 * Update an existing lead.
 * Requires owner or manager role.
 */
export async function updateLead(
  id: string,
  input: UpdateLeadInput
): Promise<ActionResult<Lead>> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const role = user.user_metadata?.role;
  if (role !== 'owner' && role !== 'manager') {
    return { success: false, error: 'Only owners and managers can edit leads.' };
  }

  // Validate phone if provided
  if (input.phone && !isValidIndianPhone(input.phone)) {
    return { success: false, error: 'Please enter a valid 10-digit Indian mobile number.' };
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.phone !== undefined) updateData.phone = formatPhoneE164(input.phone);
  if (input.email !== undefined) updateData.email = input.email?.trim() || null;
  if (input.source !== undefined) updateData.source = input.source;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.notes !== undefined) updateData.notes = input.notes?.trim() || null;
  if (input.interested_services !== undefined) updateData.interested_services = input.interested_services;
  if (input.follow_up_date !== undefined) updateData.follow_up_date = input.follow_up_date || null;

  const { data, error } = await (admin as any)
    .from('leads')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Lead update error:', error);
    return { success: false, error: 'Failed to update lead. Please try again.' };
  }

  revalidatePath('/dashboard/leads');
  return { success: true, data: data as unknown as Lead };
}

/**
 * Delete a lead.
 * Requires owner role.
 */
export async function deleteLead(id: string): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const role = user.user_metadata?.role;
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can delete leads.' };
  }

  const { error } = await (admin as any)
    .from('leads')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Lead delete error:', error);
    return { success: false, error: 'Failed to delete lead. Please try again.' };
  }

  revalidatePath('/dashboard/leads');
  return { success: true, data: undefined };
}

/**
 * Convert a lead to a customer.
 * Creates a new customer record from the lead data and marks the lead as converted.
 * Requires owner or manager role.
 */
export async function convertLeadToCustomer(leadId: string): Promise<ActionResult<Customer>> {
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
    return { success: false, error: 'Only owners and managers can convert leads.' };
  }

  // Fetch the lead
  const { data: lead, error: leadError } = await (admin as any)
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (leadError || !lead) {
    return { success: false, error: 'Lead not found.' };
  }

  if (lead.status === 'converted') {
    return { success: false, error: 'This lead has already been converted.' };
  }

  // Create customer from lead data
  const { data: customer, error: customerError } = await admin
    .from('customers')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email || null,
    } as any)
    .select()
    .single();

  if (customerError) {
    console.error('Customer creation from lead error:', customerError);
    if (customerError.code === '23505') {
      return { success: false, error: 'A customer with this phone number already exists.' };
    }
    return { success: false, error: 'Failed to create customer. Please try again.' };
  }

  // Update lead status to converted
  const { error: updateError } = await (admin as any)
    .from('leads')
    .update({
      status: 'converted',
      converted_customer_id: (customer as any).id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  if (updateError) {
    console.error('Lead conversion update error:', updateError);
    // Customer was created but lead update failed — still return success
  }

  revalidatePath('/dashboard/leads');
  revalidatePath('/dashboard/customers');
  return { success: true, data: customer as unknown as Customer };
}
