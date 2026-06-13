'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { isAdminEmail } from '@/lib/admin/auth';
import { toTitleCase } from '@/lib/utils';
import type { ActionResult } from '@/types';

/**
 * Update tenant GST settings.
 *
 * GST details are LOCKED once saved (gst_locked = true): a tenant cannot edit
 * them afterwards because they're legally binding tax registration details.
 * Only a platform admin (PLATFORM_ADMIN_EMAILS) may edit a locked GST profile.
 * India: hair salons & beauty spas attract 5% GST on services by default.
 */
export async function updateGstSettings(input: {
  gst_number: string | null;
  gst_rate: number;
  gst_enabled: boolean;
  legal_name?: string | null;
  trade_name?: string | null;
}): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) return { success: false, error: 'No tenant context found.' };

  const isPlatformAdmin = isAdminEmail(user.email);

  // Get current settings
  const { data: tenant } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .single();

  const currentSettings = (tenant?.settings as Record<string, unknown>) ?? {};
  const alreadyLocked = (currentSettings.gst_locked as boolean) ?? false;

  // Once locked, only a platform admin can change GST details.
  if (alreadyLocked && !isPlatformAdmin) {
    return {
      success: false,
      error: 'GST details are locked and can only be changed by SnipandGlow support. Please contact us to update them.',
    };
  }

  const hasGst = !!(input.gst_number && input.gst_number.trim());

  // When a tenant (non-admin) saves valid GST details for the first time, lock them.
  // Admins can save without locking further (they retain edit ability anyway).
  const shouldLock = hasGst && (alreadyLocked || !isPlatformAdmin);

  // Merge GST settings
  const updatedSettings = {
    ...currentSettings,
    gst_enabled: input.gst_enabled,
    gst_rate: input.gst_rate,
    gst_number: input.gst_number,
    legal_name: input.legal_name ?? (currentSettings.legal_name as string) ?? null,
    trade_name: input.trade_name ?? (currentSettings.trade_name as string) ?? null,
    gst_locked: shouldLock,
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
      name: toTitleCase(input.salon_name),
      owner_name: toTitleCase(input.owner_name),
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

/**
 * Update tenant default discount settings.
 */
export async function updateDiscountSettings(input: {
  discount_enabled: boolean;
  discount_value: number;
}): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) return { success: false, error: 'No tenant context found.' };

  const { data: tenant } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .single();

  const currentSettings = (tenant?.settings as Record<string, unknown>) ?? {};

  const updatedSettings = {
    ...currentSettings,
    discount_enabled: input.discount_enabled,
    discount_value: input.discount_value,
  };

  const { error } = await supabase
    .from('tenants')
    .update({ settings: updatedSettings })
    .eq('id', tenantId);

  if (error) {
    return { success: false, error: 'Failed to update discount settings.' };
  }

  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard/billing');
  return { success: true, data: undefined };
}

/**
 * Update Google Review link in tenant settings.
 */
export async function updateGoogleReviewLink(link: string): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) return { success: false, error: 'No tenant context found.' };

  // Validate URL if provided
  if (link.trim() && !link.trim().startsWith('http')) {
    return { success: false, error: 'Please enter a valid URL starting with https://' };
  }

  // Get current settings
  const { data: tenant } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .single();

  const currentSettings = (tenant?.settings as Record<string, unknown>) ?? {};

  const updatedSettings = {
    ...currentSettings,
    google_review_link: link.trim() || null,
  };

  const { error } = await supabase
    .from('tenants')
    .update({ settings: updatedSettings })
    .eq('id', tenantId);

  if (error) {
    return { success: false, error: 'Failed to update Google Review link.' };
  }

  revalidatePath('/dashboard/settings');
  return { success: true, data: undefined };
}

/**
 * Update branch operating hours.
 */
export async function updateOperatingHours(hours: Record<string, { open: string; close: string } | null>): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const branchId = user.user_metadata?.branch_id;
  if (!branchId) return { success: false, error: 'No branch context found.' };

  const { error } = await supabase
    .from('branches')
    .update({ operating_hours: hours })
    .eq('id', branchId);

  if (error) {
    return { success: false, error: 'Failed to update operating hours.' };
  }

  revalidatePath('/dashboard/settings');
  return { success: true, data: undefined };
}

/**
 * Update blocked dates in tenant settings.
 */
export async function updateBlockedDates(dates: string[]): Promise<ActionResult<void>> {
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

  const updatedSettings = {
    ...currentSettings,
    blocked_dates: dates,
  };

  const { error } = await supabase
    .from('tenants')
    .update({ settings: updatedSettings })
    .eq('id', tenantId);

  if (error) {
    return { success: false, error: 'Failed to update blocked dates.' };
  }

  revalidatePath('/dashboard/settings');
  return { success: true, data: undefined };
}

/**
 * Update blocked time slots in tenant settings.
 * Format: [{ date: "2026-05-22", slots: ["09:00", "09:30", "10:00"] }]
 */
export async function updateBlockedSlots(blockedSlots: Array<{ date: string; slots: string[] }>): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) return { success: false, error: 'No tenant context found.' };

  // Get current settings
  const { data: tenant, error: fetchError } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .single();

  if (fetchError) {
    console.error('[updateBlockedSlots] Fetch error:', fetchError);
    return { success: false, error: 'Failed to fetch current settings.' };
  }

  const currentSettings = (tenant?.settings as Record<string, unknown>) ?? {};

  // Filter out past dates
  const today = new Date().toISOString().split('T')[0];
  const filtered = blockedSlots.filter((b) => b.date >= today && b.slots.length > 0);

  const updatedSettings = {
    ...currentSettings,
    blocked_slots: filtered,
  };

  console.log('[updateBlockedSlots] Saving:', JSON.stringify(updatedSettings.blocked_slots));

  const { error } = await supabase
    .from('tenants')
    .update({ settings: updatedSettings })
    .eq('id', tenantId);

  if (error) {
    console.error('[updateBlockedSlots] Update error:', error);
    return { success: false, error: 'Failed to update blocked slots.' };
  }

  revalidatePath('/dashboard/settings');
  return { success: true, data: undefined };
}

/**
 * Update booking capacity settings.
 * max_appointments_per_slot: how many appointments can be booked at the same time
 * slot_duration_minutes: 30 or 60 minutes per slot
 */
export async function updateBookingCapacity(input: {
  max_appointments_per_slot: number;
  slot_duration_minutes: number;
}): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) return { success: false, error: 'No tenant context found.' };

  if (input.max_appointments_per_slot < 1 || input.max_appointments_per_slot > 20) {
    return { success: false, error: 'Max appointments per slot must be between 1 and 20.' };
  }

  if (![30, 60].includes(input.slot_duration_minutes)) {
    return { success: false, error: 'Slot duration must be 30 or 60 minutes.' };
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .single();

  const currentSettings = (tenant?.settings as Record<string, unknown>) ?? {};

  const updatedSettings = {
    ...currentSettings,
    max_appointments_per_slot: input.max_appointments_per_slot,
    slot_duration_minutes: input.slot_duration_minutes,
  };

  const { error } = await supabase
    .from('tenants')
    .update({ settings: updatedSettings })
    .eq('id', tenantId);

  if (error) {
    return { success: false, error: 'Failed to update booking capacity.' };
  }

  revalidatePath('/dashboard/settings');
  return { success: true, data: undefined };
}
