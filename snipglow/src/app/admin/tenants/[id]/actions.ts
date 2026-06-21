'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, logAdminAction } from '@/lib/admin/auth';
import { revalidatePath } from 'next/cache';
import { encryptToken } from '@/lib/crypto/token-encryption';
import { upsertDedicatedCredentials } from '@/lib/whatsapp/credential-store';
import { recordOnboardingEvent } from '@/lib/whatsapp/onboarding-log';

// =============================================================================
// Admin — edit a tenant's GST details (even when locked).
// Only platform admins can call this (requireAdmin guards it).
// =============================================================================

export async function adminUpdateTenantGst(
  tenantId: string,
  input: {
    gst_number: string | null;
    gst_rate: number;
    legal_name: string | null;
    trade_name: string | null;
    locked: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAdmin();

  if (!tenantId) return { success: false, error: 'Tenant ID required.' };

  const admin = createAdminClient();

  const { data: tenant } = await (admin
    .from('tenants' as any)
    .select('settings, name')
    .eq('id', tenantId)
    .single() as any);

  if (!tenant) return { success: false, error: 'Tenant not found.' };

  const currentSettings = (tenant.settings as Record<string, unknown>) ?? {};
  const hasGst = !!(input.gst_number && input.gst_number.trim());

  const updatedSettings = {
    ...currentSettings,
    gst_enabled: hasGst,
    gst_rate: hasGst ? input.gst_rate : 0,
    gst_number: input.gst_number,
    legal_name: input.legal_name,
    trade_name: input.trade_name,
    gst_locked: hasGst ? input.locked : false,
  };

  const { error } = await (admin
    .from('tenants' as any)
    .update({ settings: updatedSettings })
    .eq('id', tenantId) as any);

  if (error) {
    return { success: false, error: 'Failed to update GST details.' };
  }

  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'update_tenant_gst',
    targetType: 'tenant',
    targetId: tenantId,
    metadata: {
      tenant_name: tenant.name,
      gst_number: input.gst_number,
      gst_rate: input.gst_rate,
      locked: hasGst ? input.locked : false,
    },
  });

  revalidatePath(`/admin/tenants/${tenantId}`);
  return { success: true };
}

// =============================================================================
// Admin — manually activate a tenant's dedicated WhatsApp connection.
//
// Interim flow while self-serve Embedded Signup is unavailable (pending Meta
// Tech Provider approval). The platform team provisions the WhatsApp Cloud API
// number for a Pro/Growth tenant, then enters the resulting credentials here.
// The access token is encrypted at rest before storage; the plaintext token is
// never persisted, logged, or returned.
// =============================================================================

export async function adminActivateDedicatedWhatsApp(
  tenantId: string,
  input: {
    accessToken: string;
    wabaId: string;
    phoneNumberId: string;
    displayPhoneNumber: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAdmin();

  if (!tenantId) return { success: false, error: 'Tenant ID required.' };

  const accessToken = (input.accessToken ?? '').trim();
  const wabaId = (input.wabaId ?? '').trim();
  const phoneNumberId = (input.phoneNumberId ?? '').trim();
  const displayPhoneNumber = (input.displayPhoneNumber ?? '').trim();

  if (!accessToken || !wabaId || !phoneNumberId || !displayPhoneNumber) {
    return {
      success: false,
      error: 'Access token, WABA ID, phone number ID, and display phone number are all required.',
    };
  }

  const admin = createAdminClient();

  // Confirm the tenant exists (and capture name for the audit log).
  const { data: tenant } = await (admin
    .from('tenants' as any)
    .select('name')
    .eq('id', tenantId)
    .single() as any);

  if (!tenant) return { success: false, error: 'Tenant not found.' };

  // Encrypt the access token before it ever touches the database (Req 4.1, 4.7).
  let accessTokenEncrypted: string;
  try {
    accessTokenEncrypted = encryptToken(accessToken);
  } catch {
    return {
      success: false,
      error: 'Server is not configured for token encryption (missing TOKEN_ENCRYPTION_KEY).',
    };
  }

  // Persist the encrypted token + WABA fields (one row per tenant).
  try {
    await upsertDedicatedCredentials(tenantId, {
      accessTokenEncrypted,
      wabaId,
      phoneNumberId,
      displayPhoneNumber,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return { success: false, error: `Failed to store credentials: ${message}` };
  }

  // Flip the tenant to a fully connected dedicated state in a single update.
  const { error: statusError } = await (admin
    .from('tenant_whatsapp_settings' as any)
    .update({
      mode: 'dedicated',
      onboarding_status: 'connected',
      webhook_status: 'active',
      onboarding_error: null,
      onboarding_updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId) as any);

  if (statusError) {
    return { success: false, error: `Failed to activate: ${statusError.message}` };
  }

  // Mark any open manual setup request as completed (best-effort).
  try {
    await (admin
      .from('whatsapp_setup_requests' as any)
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'in_progress']) as any);
  } catch (err) {
    console.error('[adminActivateDedicatedWhatsApp] Failed to close setup request:', err);
  }

  await recordOnboardingEvent(tenantId, 'connected', 'admin_manual_activation');

  // Audit log — never include the access token (token-free metadata only).
  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'activate_dedicated_whatsapp',
    targetType: 'tenant',
    targetId: tenantId,
    metadata: {
      tenant_name: tenant.name,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      display_phone_number: displayPhoneNumber,
    },
  });

  revalidatePath(`/admin/tenants/${tenantId}`);
  return { success: true };
}

// =============================================================================
// Admin — change a tenant's subscription plan tier.
//
// The DB CHECK constraint on tenants.plan_tier allows only 'starter', 'pro',
// and 'enterprise' (migration 001). Marketing names map as:
//   Essentials → starter · Pro → pro · Growth → enterprise
// =============================================================================

const ALLOWED_PLAN_TIERS = ['starter', 'pro', 'enterprise'] as const;
type AllowedPlanTier = (typeof ALLOWED_PLAN_TIERS)[number];

export async function adminUpdateTenantPlan(
  tenantId: string,
  planTier: string,
  billingCycle: string = 'yearly'
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAdmin();

  if (!tenantId) return { success: false, error: 'Tenant ID required.' };

  if (!ALLOWED_PLAN_TIERS.includes(planTier as AllowedPlanTier)) {
    return { success: false, error: 'Invalid plan tier.' };
  }

  const cycle = billingCycle === 'monthly' ? 'monthly' : 'yearly';

  const admin = createAdminClient();

  const { data: tenant } = await (admin
    .from('tenants' as any)
    .select('name, plan_tier, settings')
    .eq('id', tenantId)
    .single() as any);

  if (!tenant) return { success: false, error: 'Tenant not found.' };

  const previousPlan = (tenant as any).plan_tier ?? 'starter';
  const currentSettings = ((tenant as any).settings as Record<string, unknown>) ?? {};
  const previousCycle = (currentSettings.billing_cycle as string) ?? 'yearly';

  const { error } = await (admin
    .from('tenants' as any)
    .update({ plan_tier: planTier, settings: { ...currentSettings, billing_cycle: cycle } })
    .eq('id', tenantId) as any);

  if (error) {
    return { success: false, error: `Failed to update plan: ${error.message}` };
  }

  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'update_tenant_plan',
    targetType: 'tenant',
    targetId: tenantId,
    metadata: {
      tenant_name: (tenant as any).name,
      previous_plan: previousPlan,
      new_plan: planTier,
      previous_cycle: previousCycle,
      new_cycle: cycle,
    },
  });

  revalidatePath(`/admin/tenants/${tenantId}`);
  return { success: true };
}

// =============================================================================
// Admin — activate / extend a tenant's subscription.
//
// Used when payment is taken offline (interim, until Razorpay is live) or to
// extend a paid plan. Sets subscription_status = 'active' and pushes
// subscription_end forward by the given number of months from the later of
// "now" or the current end date (so extending early doesn't lose paid days).
// This clears the computed-expiry lock immediately.
// =============================================================================

export async function adminActivateSubscription(
  tenantId: string,
  months: number = 1
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAdmin();
  if (!tenantId) return { success: false, error: 'Tenant ID required.' };

  const m = Number.isFinite(months) && months > 0 ? Math.min(60, Math.floor(months)) : 1;

  const admin = createAdminClient();

  const { data: tenant } = await (admin
    .from('tenants' as any)
    .select('name, subscription_status, subscription_start, subscription_end')
    .eq('id', tenantId)
    .single() as any);

  if (!tenant) return { success: false, error: 'Tenant not found.' };

  const now = new Date();
  const currentEnd = (tenant as any).subscription_end ? new Date((tenant as any).subscription_end) : null;
  // Extend from the later of now or the current (future) end date.
  const base = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  const newEnd = new Date(base);
  newEnd.setMonth(newEnd.getMonth() + m);

  // Stamp a start date if the tenant never had one.
  const start = (tenant as any).subscription_start || now.toISOString();

  const { error } = await (admin
    .from('tenants' as any)
    .update({
      subscription_status: 'active',
      subscription_start: start,
      subscription_end: newEnd.toISOString(),
      // Reset so a future expiry can alert again.
      trial_expiry_alert_sent: false,
    } as any)
    .eq('id', tenantId) as any);

  if (error) {
    return { success: false, error: `Failed to activate subscription: ${error.message}` };
  }

  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'activate_subscription',
    targetType: 'tenant',
    targetId: tenantId,
    metadata: {
      tenant_name: (tenant as any).name,
      months: m,
      previous_status: (tenant as any).subscription_status,
      new_end: newEnd.toISOString(),
    },
  });

  revalidatePath(`/admin/tenants/${tenantId}`);
  return { success: true };
}

// =============================================================================
// Admin — set a tenant's subscription/trial expiry to an EXACT date.
//
// Lets admins give a trial more time (future date) OR prepone the expiry to a
// past/near date to verify that an expired account is correctly locked out of
// dashboard features. Setting subscription_end is enough: getSubscriptionState
// computes "expired" from this date at read time.
// =============================================================================

export async function adminSetSubscriptionEnd(
  tenantId: string,
  endDate: string // 'YYYY-MM-DD'
): Promise<{ success: boolean; error?: string }> {
  const user = await requireAdmin();
  if (!tenantId) return { success: false, error: 'Tenant ID required.' };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { success: false, error: 'Please provide a valid date.' };
  }
  // Store end-of-day IST (18:30 UTC of the prior day → next day) so the chosen
  // calendar day counts as fully available. Use 23:59:59 IST = 18:29:59Z.
  const parsed = new Date(`${endDate}T23:59:59+05:30`);
  if (isNaN(parsed.getTime())) {
    return { success: false, error: 'Please provide a valid date.' };
  }

  const admin = createAdminClient();

  const { data: tenant } = await (admin
    .from('tenants' as any)
    .select('name, subscription_status, subscription_start, subscription_end')
    .eq('id', tenantId)
    .single() as any);

  if (!tenant) return { success: false, error: 'Tenant not found.' };

  // Stamp a start date if the tenant never had one.
  const start = (tenant as any).subscription_start || new Date().toISOString();

  const { error } = await (admin
    .from('tenants' as any)
    .update({
      subscription_end: parsed.toISOString(),
      subscription_start: start,
      // Allow the trial-expiry alert to fire again for the new date.
      trial_expiry_alert_sent: false,
    } as any)
    .eq('id', tenantId) as any);

  if (error) {
    return { success: false, error: `Failed to update expiry date: ${error.message}` };
  }

  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'set_subscription_end',
    targetType: 'tenant',
    targetId: tenantId,
    metadata: {
      tenant_name: (tenant as any).name,
      previous_end: (tenant as any).subscription_end,
      new_end: parsed.toISOString(),
    },
  });

  revalidatePath(`/admin/tenants/${tenantId}`);
  return { success: true };
}
