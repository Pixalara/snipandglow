'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { toTitleCase } from '@/lib/utils';
import type { ActionResult, Service, CreateServiceInput, UpdateServiceInput } from '@/types';

/**
 * Create a new service in the catalog.
 * Requires owner or manager role (enforced by RLS + UI guard).
 */
export async function createService(input: CreateServiceInput): Promise<ActionResult<Service>> {
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
    return { success: false, error: 'Service name is required.' };
  }
  if (!input.category?.trim()) {
    return { success: false, error: 'Category is required.' };
  }
  if (!input.duration_minutes || input.duration_minutes < 1) {
    return { success: false, error: 'Duration must be at least 1 minute.' };
  }
  if (input.price == null || input.price < 0) {
    return { success: false, error: 'Price must be a non-negative number.' };
  }

  const { data, error } = await supabase
    .from('services')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      name: toTitleCase(input.name),
      category: toTitleCase(input.category),
      duration_minutes: input.duration_minutes,
      price: input.price,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: 'Failed to create service. Please try again.' };
  }

  revalidatePath('/dashboard/services');
  return { success: true, data: data as Service };
}

/**
 * Update an existing service.
 * Requires owner or manager role (enforced by RLS + UI guard).
 */
export async function updateService(id: string, input: UpdateServiceInput): Promise<ActionResult<Service>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Validate fields if provided
  if (input.name !== undefined && !input.name.trim()) {
    return { success: false, error: 'Service name cannot be empty.' };
  }
  if (input.category !== undefined && !input.category.trim()) {
    return { success: false, error: 'Category cannot be empty.' };
  }
  if (input.duration_minutes !== undefined && input.duration_minutes < 1) {
    return { success: false, error: 'Duration must be at least 1 minute.' };
  }
  if (input.price !== undefined && input.price < 0) {
    return { success: false, error: 'Price must be a non-negative number.' };
  }

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = toTitleCase(input.name);
  if (input.category !== undefined) updateData.category = toTitleCase(input.category);
  if (input.duration_minutes !== undefined) updateData.duration_minutes = input.duration_minutes;
  if (input.price !== undefined) updateData.price = input.price;
  if (input.is_active !== undefined) updateData.is_active = input.is_active;

  const { data, error } = await supabase
    .from('services')
    .update(updateData as any)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { success: false, error: 'Failed to update service. Please try again.' };
  }

  revalidatePath('/dashboard/services');
  return { success: true, data: data as Service };
}

/**
 * Soft-delete a service by setting is_active = false.
 *
 * We always deactivate (soft-delete) — never hard-delete — so that historical
 * invoices and past appointments that reference this service keep their data
 * intact. Deactivating simply removes it from the active catalog and from new
 * bookings, which is exactly the "delete" behaviour the UI promises.
 */
export async function softDeleteService(id: string): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('services')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    return { success: false, error: 'Failed to delete service. Please try again.' };
  }

  revalidatePath('/dashboard/services');
  return { success: true, data: undefined };
}
