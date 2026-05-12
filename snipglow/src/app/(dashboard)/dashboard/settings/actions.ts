'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/types';

/**
 * Update tenant GST settings.
 */
export async function updateGstSettings(input: {
  gst_number: string | null;
  gst_rate: number;
  gst_enabled: boolean;
}): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) return { success: false, error: 'No tenant context found.' };

  // Get current settings
  const { data: tenant } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .single();

  const currentSettings = (tenant?.settings as Record<string, unknown>) ?? {};

  // Merge GST settings
  const updatedSettings = {
    ...currentSettings,
    gst_enabled: input.gst_enabled,
    gst_rate: input.gst_rate,
    gst_number: input.gst_number,
  };

  const { error } = await supabase
    .from('tenants')
    .update({ settings: updatedSettings })
    .eq('id', tenantId);

  if (error) {
    return { success: false, error: 'Failed to update GST settings.' };
  }

  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard/billing');
  return { success: true, data: undefined };
}

/**
 * Update salon profile (tenant name, owner name, phone, branch address).
 */
export async function updateSalonProfile(input: {
  salon_name: string;
  owner_name: string;
  phone: string;
  address: string;
}): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  if (!tenantId) return { success: false, error: 'No tenant context found.' };

  // Update tenant
  const { error: tenantError } = await supabase
    .from('tenants')
    .update({
      name: input.salon_name,
      owner_name: input.owner_name,
      phone: input.phone,
    })
    .eq('id', tenantId);

  if (tenantError) {
    return { success: false, error: 'Failed to update salon profile.' };
  }

  // Update branch address if branch exists
  if (branchId && input.address) {
    await supabase
      .from('branches')
      .update({ address: input.address })
      .eq('id', branchId);
  }

  revalidatePath('/dashboard/settings');
  return { success: true, data: undefined };
}
