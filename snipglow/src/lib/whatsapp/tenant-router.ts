import { createAdminClient } from '@/lib/supabase/admin';
import { isSharedNumber, parseBookingSlug, getPlatformCredentials } from './config';
import type { WhatsAppCredentials } from './config';

// =============================================================================
// WhatsApp Tenant Router
// Resolves which tenant a message belongs to based on:
// - Shared mode: booking slug in message text OR active customer session
// - Dedicated mode: phone_number_id lookup in tenant_whatsapp_settings
// =============================================================================

export interface TenantContext {
  tenantId: string;
  branchId: string;
  mode: 'shared' | 'dedicated';
  salonName: string;
  credentials: WhatsAppCredentials;
}

/**
 * Resolve tenant from incoming webhook message.
 * Returns tenant context or null if cannot be resolved.
 */
export async function resolveTenant(
  phoneNumberId: string,
  customerPhone: string,
  messageText: string
): Promise<TenantContext | null> {
  const admin = createAdminClient();

  // ─── DEDICATED MODE ─────────────────────────────────────────────────────────
  if (!isSharedNumber(phoneNumberId)) {
    // Look up tenant by their dedicated phone_number_id
    const { data: settings } = await (admin
      .from('tenant_whatsapp_settings' as any)
      .select('tenant_id, access_token_encrypted, phone_number_id, waba_id')
      .eq('phone_number_id', phoneNumberId)
      .eq('mode', 'dedicated')
      .single() as any);

    if (!settings) return null;

    // Get tenant details
    const { data: tenant } = await admin
      .from('tenants')
      .select('id, name')
      .eq('id', settings.tenant_id)
      .single();

    if (!tenant) return null;

    // Get default branch
    const { data: branch } = await admin
      .from('branches')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('is_default', true)
      .single();

    // TODO: Decrypt access_token_encrypted for dedicated mode
    // For now, dedicated mode uses platform credentials as placeholder
    const credentials = getPlatformCredentials();
    if (!credentials) return null;

    return {
      tenantId: tenant.id,
      branchId: branch?.id ?? '',
      mode: 'dedicated',
      salonName: tenant.name,
      credentials,
    };
  }

  // ─── SHARED MODE ────────────────────────────────────────────────────────────
  const credentials = getPlatformCredentials();
  if (!credentials) return null;

  // 1. Try to detect tenant from booking slug in message text
  const slug = parseBookingSlug(messageText);
  if (slug) {
    // Match by salon name (from friendly message)
    if (slug.startsWith('salon_name:')) {
      const salonName = slug.replace('salon_name:', '').trim();
      console.log('[Router] Looking up salon by name:', salonName);

      // Try exact case-insensitive match
      const { data: matches } = await (admin
        .from('tenants' as any)
        .select('id, name')
        .ilike('name', salonName)
        .limit(1) as any);

      let tenantByName = matches?.[0] || null;

      if (!tenantByName) {
        // Try with wildcard
        const { data: fuzzyMatches } = await (admin
          .from('tenants' as any)
          .select('id, name')
          .ilike('name', `%${salonName}%`)
          .limit(1) as any);
        tenantByName = fuzzyMatches?.[0] || null;
      }

      console.log('[Router] Found tenant:', tenantByName?.name || 'NONE');

      if (tenantByName) {
        const tenant = await getTenantDetails(admin, tenantByName.id);
        if (tenant) {
          await upsertSession(admin, tenantByName.id, customerPhone, 'qr', salonName);
          return { ...tenant, mode: 'shared', credentials };
        }
      }
    }

    // First try exact slug match in tenant_whatsapp_settings
    const { data: settings } = await (admin
      .from('tenant_whatsapp_settings' as any)
      .select('tenant_id')
      .eq('booking_slug', slug)
      .single() as any);

    if (settings) {
      const tenant = await getTenantDetails(admin, settings.tenant_id);
      if (tenant) {
        await upsertSession(admin, settings.tenant_id, customerPhone, 'qr', slug);
        return { ...tenant, mode: 'shared', credentials };
      }
    }

    // Try matching by tenant_code (short code like "sng001")
    const tenantCodeFormatted = slug.replace(/^(sng)(\d+).*$/, 'SNG-$2').toUpperCase();
    if (tenantCodeFormatted.startsWith('SNG-')) {
      const { data: tenantByCode } = await (admin
        .from('tenants' as any)
        .select('id')
        .eq('tenant_code', tenantCodeFormatted)
        .single() as any);

      if (tenantByCode) {
        // Get their booking slug from settings
        const { data: settingsByCode } = await (admin
          .from('tenant_whatsapp_settings' as any)
          .select('booking_slug')
          .eq('tenant_id', tenantByCode.id)
          .single() as any);

        const tenant = await getTenantDetails(admin, tenantByCode.id);
        if (tenant) {
          const actualSlug = settingsByCode?.booking_slug || slug;
          await upsertSession(admin, tenantByCode.id, customerPhone, 'qr', actualSlug);
          return { ...tenant, mode: 'shared', credentials };
        }
      }
    }
  }

  // 2. Check existing active session for this customer
  const { data: session } = await (admin
    .from('whatsapp_customer_sessions' as any)
    .select('tenant_id')
    .eq('customer_phone', customerPhone)
    .gt('expires_at', new Date().toISOString())
    .order('last_message_at', { ascending: false })
    .limit(1)
    .single() as any);

  if (session) {
    const tenant = await getTenantDetails(admin, session.tenant_id);
    if (tenant) {
      // Refresh session expiry
      await refreshSession(admin, customerPhone, session.tenant_id);
      return { ...tenant, mode: 'shared', credentials };
    }
  }

  // 3. Cannot resolve tenant — return null (webhook will send fallback)
  return null;
}

/**
 * Get tenant name and default branch.
 */
async function getTenantDetails(admin: any, tenantId: string): Promise<{ tenantId: string; branchId: string; salonName: string } | null> {
  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name')
    .eq('id', tenantId)
    .single();

  if (!tenant) return null;

  const { data: branch } = await admin
    .from('branches')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .single();

  return {
    tenantId: tenant.id,
    branchId: branch?.id ?? '',
    salonName: tenant.name,
  };
}

/**
 * Create or update a customer session for shared mode.
 */
async function upsertSession(
  admin: any,
  tenantId: string,
  customerPhone: string,
  source: string,
  slug: string
) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  // Delete old sessions for this phone+tenant
  await (admin
    .from('whatsapp_customer_sessions' as any)
    .delete()
    .eq('customer_phone', customerPhone)
    .eq('tenant_id', tenantId) as any);

  // Insert new session
  await (admin
    .from('whatsapp_customer_sessions' as any)
    .insert({
      tenant_id: tenantId,
      customer_phone: customerPhone,
      mode: 'shared',
      source,
      current_state: 'welcome',
      booking_slug: slug,
      last_message_at: new Date().toISOString(),
      expires_at: expiresAt,
    }) as any);
}

/**
 * Refresh session expiry on new message.
 */
async function refreshSession(admin: any, customerPhone: string, tenantId: string) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  await (admin
    .from('whatsapp_customer_sessions' as any)
    .update({ last_message_at: new Date().toISOString(), expires_at: expiresAt })
    .eq('customer_phone', customerPhone)
    .eq('tenant_id', tenantId) as any);
}

/**
 * Get credentials for a specific tenant.
 * Dedicated mode: uses tenant's own token. Shared mode: uses platform token.
 */
export async function getCredentialsForTenant(tenantId: string): Promise<WhatsAppCredentials | null> {
  const admin = createAdminClient();

  const { data: settings } = await (admin
    .from('tenant_whatsapp_settings' as any)
    .select('mode, phone_number_id, waba_id, access_token_encrypted')
    .eq('tenant_id', tenantId)
    .single() as any);

  if (settings?.mode === 'dedicated' && settings.access_token_encrypted) {
    // TODO: Decrypt token
    // return { accessToken: decrypt(settings.access_token_encrypted), phoneNumberId: settings.phone_number_id, businessAccountId: settings.waba_id };
  }

  // Default: use platform credentials
  return getPlatformCredentials();
}
