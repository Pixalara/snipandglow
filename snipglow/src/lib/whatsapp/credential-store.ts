import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// WhatsApp Credential Store
// Persists dedicated WhatsApp credentials in `tenant_whatsapp_settings`,
// honoring the one-row-per-tenant constraint (unique index on tenant_id).
// All writes use the service-role admin client (bypasses RLS).
// =============================================================================

/**
 * The dedicated credential fields persisted for a tenant (Req 4.2).
 * The access token is supplied already-encrypted; this module never sees or
 * stores plaintext tokens.
 */
export interface DedicatedCredentials {
  /** AES-256-GCM encrypted access token: base64(IV ‖ ciphertext ‖ authTag). */
  accessTokenEncrypted: string;
  /** WhatsApp Business Account id. */
  wabaId: string;
  /** Meta-assigned phone number id. */
  phoneNumberId: string;
  /** Human-readable display phone number. */
  displayPhoneNumber: string;
}

/**
 * The shape of a `tenant_whatsapp_settings` row as read back by this store.
 * Fields are nullable to reflect partially-onboarded / shared rows.
 */
export interface WhatsAppSettingsRow {
  tenant_id: string;
  mode: 'shared' | 'dedicated' | null;
  booking_slug: string | null;
  waba_id: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  access_token_encrypted: string | null;
  display_name: string | null;
  display_name_status: string | null;
  webhook_status: string | null;
  onboarding_status: string | null;
  onboarding_error: string | null;
  onboarding_updated_at: string | null;
}

const TABLE = 'tenant_whatsapp_settings';

/**
 * Read the WhatsApp settings row for a tenant.
 * Returns `null` when no row exists.
 */
export async function getSettings(
  tenantId: string
): Promise<WhatsAppSettingsRow | null> {
  if (!tenantId) return null;

  const admin = createAdminClient();
  const { data } = await (admin
    .from(TABLE as any)
    .select(
      'tenant_id, mode, booking_slug, waba_id, phone_number_id, display_phone_number, access_token_encrypted, display_name, display_name_status, webhook_status, onboarding_status, onboarding_error, onboarding_updated_at'
    )
    .eq('tenant_id', tenantId)
    .maybeSingle() as any);

  return (data as WhatsAppSettingsRow) ?? null;
}

/**
 * Persist dedicated credentials for a tenant.
 *
 * Honors the one-row-per-tenant invariant (Req 4.3, 4.5): if a settings row
 * already exists for the tenant the existing row is UPDATED; otherwise a new
 * row is INSERTed. Persists all four credential fields (Req 4.2).
 *
 * The access token is expected to be already encrypted by the caller; this
 * store never handles plaintext tokens.
 */
export async function upsertDedicatedCredentials(
  tenantId: string,
  credentials: DedicatedCredentials
): Promise<WhatsAppSettingsRow> {
  if (!tenantId) {
    throw new Error('upsertDedicatedCredentials: tenantId is required');
  }

  const admin = createAdminClient();

  const values = {
    access_token_encrypted: credentials.accessTokenEncrypted,
    waba_id: credentials.wabaId,
    phone_number_id: credentials.phoneNumberId,
    display_phone_number: credentials.displayPhoneNumber,
  };

  // Determine whether a row already exists for this tenant so we update in
  // place rather than create a duplicate (one row per tenant).
  const existing = await getSettings(tenantId);

  if (existing) {
    const { data, error } = await (admin
      .from(TABLE as any)
      .update(values)
      .eq('tenant_id', tenantId)
      .select(
        'tenant_id, mode, booking_slug, waba_id, phone_number_id, display_phone_number, access_token_encrypted, display_name, display_name_status, webhook_status, onboarding_status, onboarding_error, onboarding_updated_at'
      )
      .single() as any);

    if (error) {
      throw new Error(`upsertDedicatedCredentials: failed to update settings: ${error.message}`);
    }
    return data as WhatsAppSettingsRow;
  }

  const { data, error } = await (admin
    .from(TABLE as any)
    .insert({ tenant_id: tenantId, ...values })
    .select(
      'tenant_id, mode, booking_slug, waba_id, phone_number_id, display_phone_number, access_token_encrypted, display_name, display_name_status, webhook_status, onboarding_status, onboarding_error, onboarding_updated_at'
    )
    .single() as any);

  if (error) {
    throw new Error(`upsertDedicatedCredentials: failed to insert settings: ${error.message}`);
  }
  return data as WhatsAppSettingsRow;
}

/**
 * A WhatsApp manual-setup request row (interim flow while Embedded Signup /
 * Tech Provider approval is pending).
 */
export interface SetupRequestRow {
  id: string;
  tenant_id: string;
  contact_phone: string;
  contact_name: string | null;
  notes: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

const SETUP_REQUESTS_TABLE = 'whatsapp_setup_requests';

/**
 * Create a manual WhatsApp setup request for a tenant. Used by the owner-facing
 * "Request Setup" flow when self-serve Embedded Signup is not yet available.
 */
export async function createSetupRequest(
  tenantId: string,
  input: { contactPhone: string; contactName?: string | null; notes?: string | null }
): Promise<SetupRequestRow> {
  if (!tenantId) {
    throw new Error('createSetupRequest: tenantId is required');
  }

  const admin = createAdminClient();
  const { data, error } = await (admin
    .from(SETUP_REQUESTS_TABLE as any)
    .insert({
      tenant_id: tenantId,
      contact_phone: input.contactPhone,
      contact_name: input.contactName ?? null,
      notes: input.notes ?? null,
      status: 'pending',
    })
    .select('id, tenant_id, contact_phone, contact_name, notes, status, created_at, updated_at')
    .single() as any);

  if (error) {
    throw new Error(`createSetupRequest: failed to create request: ${error.message}`);
  }
  return data as SetupRequestRow;
}

/**
 * Read the most recent setup request for a tenant, or `null` when none exists.
 */
export async function getLatestSetupRequest(
  tenantId: string
): Promise<SetupRequestRow | null> {
  if (!tenantId) return null;

  const admin = createAdminClient();
  const { data } = await (admin
    .from(SETUP_REQUESTS_TABLE as any)
    .select('id, tenant_id, contact_phone, contact_name, notes, status, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as any);

  return (data as SetupRequestRow) ?? null;
}

/**
 * Clear a tenant's stored dedicated credentials (Req 8.4).
 *
 * Nulls out `access_token_encrypted`, `phone_number_id`, and
 * `display_phone_number` for the tenant's existing row. Does not alter
 * `mode`, `webhook_status`, or `onboarding_status` — the disconnect server
 * action owns those transitions as part of its atomic update.
 *
 * No-op when the tenant has no settings row.
 */
export async function clearDedicatedCredentials(
  tenantId: string
): Promise<void> {
  if (!tenantId) {
    throw new Error('clearDedicatedCredentials: tenantId is required');
  }

  const admin = createAdminClient();
  const { error } = await (admin
    .from(TABLE as any)
    .update({
      access_token_encrypted: null,
      phone_number_id: null,
      display_phone_number: null,
    })
    .eq('tenant_id', tenantId) as any);

  if (error) {
    throw new Error(`clearDedicatedCredentials: failed to clear credentials: ${error.message}`);
  }
}
