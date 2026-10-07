'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getSettings,
  upsertDedicatedCredentials,
  createSetupRequest,
  getLatestSetupRequest,
  type SetupRequestRow,
} from '@/lib/whatsapp/credential-store';
import {
  toOnboardingStateResponse,
  type OnboardingStateResponse,
  type TenantWhatsAppSettingsRow,
} from '@/lib/whatsapp/redaction';
import {
  controlsFor,
  retryTransition,
  type OnboardingControls,
  type OnboardingStatus,
} from '@/lib/whatsapp/onboarding-status';
import {
  validateAuthCode,
  exchangeCodeForToken,
} from '@/lib/whatsapp/token-exchange';
import { encryptToken } from '@/lib/crypto/token-encryption';
import { subscribeWaba } from '@/lib/whatsapp/webhook-subscription';
import { recordOnboardingEvent } from '@/lib/whatsapp/onboarding-log';
import { notifyAdminOfSetupRequest } from '@/lib/whatsapp/setup-request-alert';
import { getDedicatedCredentialsForTenant } from '@/lib/whatsapp/tenant-router';
import {
  createTemplate,
  fetchTemplateDefinitions,
  normalizeTemplateName,
  type TemplateCategory,
  type TemplateStatus,
  type MetaTemplateFull,
} from '@/lib/whatsapp/template-management';
import {
  listTenantTemplates,
  upsertSubmittedTemplate,
  updateTemplateStatus,
  getTenantTemplateById,
  deleteTenantTemplate,
  type TemplateRow,
  type SubmittedTemplateInput,
  type StoredCarouselCard,
  type StoredCarouselButton,
} from '@/lib/whatsapp/template-store';
import {
  createCarouselTemplate,
  validateCarouselDefinition,
  CAROUSEL_MAX_CARDS,
  type CarouselButtonDef,
  type CarouselTemplateDefinition,
} from '@/lib/whatsapp/carousel-management';
import { sendMessage } from '@/lib/whatsapp/templates';
import { getMetaAppId, type WhatsAppCredentials } from '@/lib/whatsapp/config';
import { uploadResumableImage } from '@/lib/whatsapp/media-upload';
import {
  uploadMarketingImage as storeMarketingImage,
  MARKETING_IMAGE_MAX_BYTES,
} from '@/lib/storage/upload-marketing-image';
import { planIncludesDedicatedWhatsApp } from '@/lib/subscription';
import { processCampaignBatch, type CampaignProgress } from '@/lib/whatsapp/campaign-runner';

// =============================================================================
// Dedicated WhatsApp Onboarding — auth guard + state read
// =============================================================================

/**
 * Authorization failure raised by the dedicated-onboarding guard.
 *
 * The `reason` is a stable, token-free code that callers may surface or map to
 * an action-specific error result. It never contains credentials.
 */
class AuthorizationError extends Error {
  readonly reason: 'not_authenticated' | 'not_owner' | 'not_pro';

  constructor(reason: 'not_authenticated' | 'not_owner' | 'not_pro') {
    super(reason);
    this.name = 'AuthorizationError';
    this.reason = reason;
  }
}

/**
 * Shared guard for every dedicated WhatsApp onboarding server action.
 *
 * Verifies, in order, that:
 *   1. a user is authenticated (SSR `createClient()` auth),
 *   2. that user holds the `owner` role for a tenant (Req 1.7), and
 *   3. the tenant is on the Pro plan (Req 1.5, 1.6).
 *
 * Throws {@link AuthorizationError} when any check fails — rejecting the request
 * before any token exchange or credential write can occur. On success returns the
 * caller's `tenantId` for the action to operate on.
 */
async function assertProOwner(): Promise<{ tenantId: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new AuthorizationError('not_authenticated');

  const tenantId = user.user_metadata?.tenant_id;
  const role = user.user_metadata?.role;
  if (!tenantId || role !== 'owner') {
    throw new AuthorizationError('not_owner'); // Req 1.7
  }

  const admin = createAdminClient();
  const { data: tenant } = await (admin
    .from('tenants' as any)
    .select('plan_tier')
    .eq('id', tenantId)
    .single() as any);

  // Marketing/dedicated WhatsApp is a Pro OR Growth (enterprise) capability.
  if (!planIncludesDedicatedWhatsApp((tenant as any)?.plan_tier)) {
    throw new AuthorizationError('not_pro'); // Req 1.5, 1.6
  }

  return { tenantId };
}

/**
 * The owner-facing onboarding state, combining the redacted settings projection
 * with the derived UI control flags for the current status.
 *
 * Never includes the access token (plaintext or encrypted) — Req 4.7.
 */
export interface OnboardingState extends OnboardingStateResponse {
  controls: OnboardingControls;
}

/**
 * Read the current dedicated WhatsApp onboarding state for the requesting owner's
 * tenant.
 *
 * Authorizes via {@link assertProOwner}, then reads the tenant's settings row,
 * maps it through the redaction-safe view mapper, and attaches the derived UI
 * controls for the current status. When no settings row exists the state defaults
 * to `not_started` / `shared` (Req 7.1, 10.4, 10.5).
 */
export async function getOnboardingState(): Promise<OnboardingState> {
  const { tenantId } = await assertProOwner();

  const row = await getSettings(tenantId);
  const redacted = toOnboardingStateResponse(row as TenantWhatsAppSettingsRow | null);

  return {
    ...redacted,
    controls: controlsFor(redacted.status as OnboardingStatus),
  };
}

// =============================================================================
// Dedicated WhatsApp Onboarding — connect orchestration
// =============================================================================

/** Discriminated outcome of {@link submitAuthCode}. Never carries the token (Req 4.7). */
export type SubmitAuthCodeResult =
  | { ok: true; state: OnboardingState }
  | { ok: false; reason: string; state: OnboardingState };

/**
 * Persist the onboarding status (and optional related fields) for a tenant using
 * the service-role admin client, stamping `onboarding_updated_at`. The encrypted
 * token, when present, is written via {@link upsertDedicatedCredentials}; this
 * helper only ever touches status/mode/webhook/error columns — never a plaintext
 * token (Req 4.7, 10.3).
 */
async function writeOnboardingStatus(
  tenantId: string,
  fields: {
    onboarding_status: OnboardingStatus;
    mode?: 'shared' | 'dedicated';
    webhook_status?: 'active' | 'inactive';
    onboarding_error?: string | null;
  },
): Promise<void> {
  const admin = createAdminClient();

  const update: Record<string, unknown> = {
    onboarding_status: fields.onboarding_status,
    onboarding_updated_at: new Date().toISOString(),
  };
  if (fields.mode !== undefined) update.mode = fields.mode;
  if (fields.webhook_status !== undefined) update.webhook_status = fields.webhook_status;
  if (fields.onboarding_error !== undefined) update.onboarding_error = fields.onboarding_error;

  // Ensure a row exists for the tenant so the status write always lands on one
  // row (one-row-per-tenant). Update in place when present, else insert.
  const existing = await getSettings(tenantId);
  if (existing) {
    await (admin
      .from('tenant_whatsapp_settings' as any)
      .update(update)
      .eq('tenant_id', tenantId) as any);
  } else {
    await (admin
      .from('tenant_whatsapp_settings' as any)
      .insert({ tenant_id: tenantId, ...update }) as any);
  }
}

/** Build the redacted onboarding state for the tenant from its current settings row. */
async function readState(tenantId: string): Promise<OnboardingState> {
  const row = await getSettings(tenantId);
  const redacted = toOnboardingStateResponse(row as TenantWhatsAppSettingsRow | null);
  return {
    ...redacted,
    controls: controlsFor(redacted.status as OnboardingStatus),
  };
}

/**
 * Orchestrate the full dedicated WhatsApp connect sequence for a Pro plan owner.
 *
 * Sequence (design "End-to-End Connect Sequence"):
 *   1. {@link assertProOwner} — reject non-Pro/non-owner before any exchange (Req 1.5–1.7).
 *   2. Set `onboarding_status=in_progress` + event (Req 2.4).
 *   3. {@link validateAuthCode} — never call the Graph API on an invalid code (Req 3.4).
 *   4. {@link exchangeCodeForToken} — exchange code → token + WABA details (Req 3.1, 3.2).
 *      On error: `status=failed`, token-free `onboarding_error` + event; return redacted (Req 3.3).
 *   5. {@link encryptToken} the access token (Req 4.1).
 *   6. {@link upsertDedicatedCredentials} — persist encrypted token + WABA fields (Req 4.2).
 *   7. {@link subscribeWaba} — subscribe the WABA to the platform webhook (Req 5.1).
 *      On success: `mode=dedicated`, `webhook_status=active`, `status=connected` (Req 5.2, 5.3).
 *      On failure: `webhook_status=inactive`, `status=failed`, `mode` stays `shared` (Req 5.4).
 *   8. Append an onboarding event and return a redacted result (Req 10.1, 4.7).
 *
 * The access token is held only in local variables; it never appears in the
 * returned object, `onboarding_error`, an event `reason`, or any log (Req 4.7, 10.3).
 */
export async function submitAuthCode(code: string): Promise<SubmitAuthCodeResult> {
  let tenantId: string;
  try {
    ({ tenantId } = await assertProOwner());
  } catch (err) {
    const reason = err instanceof AuthorizationError ? err.reason : 'not_authorized';
    return {
      ok: false,
      reason,
      // No tenant context available — return a default redacted state.
      state: {
        status: 'not_started',
        mode: 'shared',
        displayPhoneNumber: null,
        webhookStatus: null,
        errorReason: null,
        controls: controlsFor('not_started'),
      },
    };
  }

  // 2. Move into the in_progress state (Req 2.4).
  await writeOnboardingStatus(tenantId, { onboarding_status: 'in_progress' });
  await recordOnboardingEvent(tenantId, 'in_progress');

  // 3. Validate the authorization code before touching the Graph API (Req 3.4).
  const validation = validateAuthCode(code);
  if (!validation.ok) {
    const reason = `Invalid authorization code: ${validation.reason}`;
    await writeOnboardingStatus(tenantId, {
      onboarding_status: 'failed',
      onboarding_error: reason,
    });
    await recordOnboardingEvent(tenantId, 'failed', reason);
    return { ok: false, reason, state: await readState(tenantId) };
  }

  // 4. Exchange the code for a token + WABA details (Req 3.1, 3.2).
  const exchange = await exchangeCodeForToken(code);
  if (!exchange.ok || !exchange.accessToken || !exchange.waba) {
    const reason = exchange.errorReason ?? 'Token exchange failed';
    await writeOnboardingStatus(tenantId, {
      onboarding_status: 'failed',
      onboarding_error: reason,
    });
    await recordOnboardingEvent(tenantId, 'failed', reason);
    return { ok: false, reason, state: await readState(tenantId) };
  }

  const { accessToken, waba } = exchange;

  // 5. Encrypt the token for storage at rest (Req 4.1).
  const accessTokenEncrypted = encryptToken(accessToken);

  // 6. Persist the encrypted token + WABA fields (Req 4.2, one row per tenant 4.3/4.5).
  try {
    await upsertDedicatedCredentials(tenantId, {
      accessTokenEncrypted,
      wabaId: waba.wabaId,
      phoneNumberId: waba.phoneNumberId,
      displayPhoneNumber: waba.displayPhoneNumber,
    });
  } catch (err) {
    const reason =
      err instanceof Error ? `Failed to store credentials: ${err.message}` : 'Failed to store credentials';
    await writeOnboardingStatus(tenantId, {
      onboarding_status: 'failed',
      onboarding_error: reason,
    });
    await recordOnboardingEvent(tenantId, 'failed', reason);
    return { ok: false, reason, state: await readState(tenantId) };
  }

  // 7. Subscribe the WABA to the platform webhook (Req 5.1).
  const subscription = await subscribeWaba(waba.wabaId, accessToken);

  if (!subscription.ok) {
    // Webhook failure: keep mode=shared, mark inactive + failed (Req 5.4).
    const reason = subscription.errorReason ?? 'Webhook subscription failed';
    await writeOnboardingStatus(tenantId, {
      onboarding_status: 'failed',
      webhook_status: 'inactive',
      onboarding_error: reason,
    });
    await recordOnboardingEvent(tenantId, 'failed', reason);
    return { ok: false, reason, state: await readState(tenantId) };
  }

  // 8. Full success: mode=dedicated, webhook active, connected (Req 5.2, 5.3).
  await writeOnboardingStatus(tenantId, {
    onboarding_status: 'connected',
    mode: 'dedicated',
    webhook_status: 'active',
    onboarding_error: null,
  });
  await recordOnboardingEvent(tenantId, 'connected');

  return { ok: true, state: await readState(tenantId) };
}

// =============================================================================
// Dedicated WhatsApp Onboarding — retry
// =============================================================================

/** Discriminated outcome of {@link retryOnboarding}. Never carries the token (Req 4.7). */
export type RetryOnboardingResult =
  | { ok: true; state: OnboardingState }
  | { ok: false; reason: string; state: OnboardingState };

/**
 * Retry a previously failed dedicated WhatsApp onboarding attempt for a Pro plan owner.
 *
 * Behavior (design "Onboarding State Machine"; Req 7.5):
 *   1. {@link assertProOwner} — reject non-Pro/non-owner before any state change (Req 1.5–1.7).
 *   2. Read the tenant's current settings via {@link getSettings}.
 *   3. A retry is legal **only** from the `failed` state (`failed → in_progress`). When the
 *      current status is anything else, reject with a redacted result and perform no transition.
 *   4. Otherwise transition to `in_progress`, **preserving valid prior progress** — the already
 *      fetched/stored `waba_id`, `phone_number_id`, `display_phone_number`, and
 *      `access_token_encrypted` are NOT cleared so the flow can restart from the failed step.
 *      Only `onboarding_status` is flipped and `onboarding_error` is cleared.
 *   5. Append an onboarding event and return a redacted state (Req 10.1, 4.7).
 *
 * The transition legality + progress preservation is delegated to
 * {@link retryTransition}; this action persists the result with the existing
 * {@link writeOnboardingStatus} + {@link recordOnboardingEvent} + {@link readState} helpers.
 */
export async function retryOnboarding(): Promise<RetryOnboardingResult> {
  let tenantId: string;
  try {
    ({ tenantId } = await assertProOwner());
  } catch (err) {
    const reason = err instanceof AuthorizationError ? err.reason : 'not_authorized';
    return {
      ok: false,
      reason,
      // No tenant context available — return a default redacted state.
      state: {
        status: 'not_started',
        mode: 'shared',
        displayPhoneNumber: null,
        webhookStatus: null,
        errorReason: null,
        controls: controlsFor('not_started'),
      },
    };
  }

  // Read current settings and evaluate retry legality (retry only from `failed`).
  const row = await getSettings(tenantId);
  const currentStatus = (row?.onboarding_status as OnboardingStatus | null) ?? 'not_started';

  const transition = retryTransition(currentStatus, {
    wabaId: row?.waba_id ?? null,
    phoneNumberId: row?.phone_number_id ?? null,
    displayPhoneNumber: row?.display_phone_number ?? null,
    accessTokenEncrypted: row?.access_token_encrypted ?? null,
  });

  if (!transition.ok) {
    // Not allowed from the current status — do NOT transition (Req 7.5).
    const reason = `Retry not allowed from status '${currentStatus}'`;
    return { ok: false, reason, state: await readState(tenantId) };
  }

  // Transition to in_progress, preserving valid prior progress. Only the status
  // flips and the prior error is cleared; the already-fetched WABA/credential
  // fields are left untouched so onboarding can restart from the failed step.
  await writeOnboardingStatus(tenantId, {
    onboarding_status: 'in_progress',
    onboarding_error: null,
  });
  await recordOnboardingEvent(tenantId, 'in_progress', 'retry');

  return { ok: true, state: await readState(tenantId) };
}

// =============================================================================
// Dedicated WhatsApp Onboarding — disconnect
// =============================================================================

/** Discriminated outcome of {@link disconnectDedicated}. Never carries the token (Req 4.7). */
export type DisconnectResult =
  | { ok: true; state: OnboardingState }
  | { ok: false; reason: string; state: OnboardingState };

/**
 * Disconnect a tenant's dedicated WhatsApp connection, atomically reverting to the
 * shared platform number and clearing all stored dedicated credentials (Req 8.2–8.5).
 *
 * Behavior (design "Atomicity for disconnect (Req 8.2/8.3)"):
 *   1. {@link assertProOwner} — reject non-Pro/non-owner before any state change (Req 1.5–1.7).
 *   2. Perform a SINGLE Postgres `UPDATE` on the tenant's `tenant_whatsapp_settings`
 *      row that simultaneously sets `mode=shared`, `onboarding_status=disconnected`,
 *      `webhook_status=inactive` AND nulls `access_token_encrypted`, `phone_number_id`,
 *      and `display_phone_number` (plus stamps `onboarding_updated_at`). Because this is
 *      one statement, it is atomic in Postgres — all six fields change or none do, so no
 *      partial state is ever observable (Req 8.3, 8.4).
 *   3. Verify the affected-row count via `.select()`. If no row was updated (e.g. the
 *      tenant has no settings row), surface an error without having applied a partial
 *      mutation (Req 8.3) — the single-statement update guarantees nothing changed.
 *   4. Append a `disconnected` onboarding event and return a redacted state (Req 10.1, 4.7).
 *
 * The credential fields are nulled in the same statement that flips the status fields,
 * so this action deliberately does NOT use the multi-step `writeOnboardingStatus` +
 * `clearDedicatedCredentials` helpers — combining them would not be atomic.
 */
export async function disconnectDedicated(): Promise<DisconnectResult> {
  let tenantId: string;
  try {
    ({ tenantId } = await assertProOwner());
  } catch (err) {
    const reason = err instanceof AuthorizationError ? err.reason : 'not_authorized';
    return {
      ok: false,
      reason,
      // No tenant context available — return a default redacted state.
      state: {
        status: 'not_started',
        mode: 'shared',
        displayPhoneNumber: null,
        webhookStatus: null,
        errorReason: null,
        controls: controlsFor('not_started'),
      },
    };
  }

  const admin = createAdminClient();

  // Single atomic UPDATE: revert mode/status/webhook AND clear all dedicated
  // credentials in one statement (Req 8.2–8.4). `.select()` returns the affected
  // rows so we can verify exactly one row was updated.
  const { data, error } = await (admin
    .from('tenant_whatsapp_settings' as any)
    .update({
      mode: 'shared',
      onboarding_status: 'disconnected',
      webhook_status: 'inactive',
      access_token_encrypted: null,
      phone_number_id: null,
      display_phone_number: null,
      onboarding_updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .select('tenant_id') as any);

  if (error) {
    // The update failed entirely — no partial state was applied (Req 8.3).
    const reason = error.message ? `Disconnect failed: ${error.message}` : 'Disconnect failed';
    return { ok: false, reason, state: await readState(tenantId) };
  }

  const affected = Array.isArray(data) ? data.length : data ? 1 : 0;
  if (affected === 0) {
    // No row matched — nothing was changed, so there is no partial state (Req 8.3).
    const reason = 'Disconnect failed: no dedicated WhatsApp settings to disconnect';
    return { ok: false, reason, state: await readState(tenantId) };
  }

  await recordOnboardingEvent(tenantId, 'disconnected');

  return { ok: true, state: await readState(tenantId) };
}

// =============================================================================
// Dedicated WhatsApp Onboarding — manual setup request (interim flow)
//
// While self-serve Embedded Signup is unavailable (pending Meta Tech Provider
// approval), a Pro/Growth owner can request a manual WhatsApp API setup. The
// platform team provisions the number and activates the tenant from the admin
// panel. These actions are Pro+owner gated, same as the rest of onboarding.
// =============================================================================

/** Redacted view of a setup request returned to the owner. */
export interface SetupRequestView {
  id: string;
  contactPhone: string;
  contactName: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
}

/** Discriminated outcome of {@link requestWhatsAppSetup}. */
export type RequestSetupResult =
  | { ok: true; request: SetupRequestView }
  | { ok: false; reason: string };

function toSetupRequestView(row: SetupRequestRow): SetupRequestView {
  return {
    id: row.id,
    contactPhone: row.contact_phone,
    contactName: row.contact_name,
    status: row.status,
    createdAt: row.created_at,
  };
}

/** Basic phone validation: digits, spaces, +, -, parentheses; 8–15 digits. */
function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * Read the latest manual setup request for the requesting owner's tenant.
 * Returns `null` when none exists. Pro+owner gated.
 */
export async function getSetupRequest(): Promise<SetupRequestView | null> {
  const { tenantId } = await assertProOwner();
  const row = await getLatestSetupRequest(tenantId);
  return row ? toSetupRequestView(row) : null;
}

/**
 * Create a manual WhatsApp setup request for the requesting owner's tenant.
 *
 * Guarded by {@link assertProOwner}. Validates the contact phone, then records a
 * `pending` request the platform team works through. If an open request
 * (`pending` / `in_progress`) already exists, it is returned as-is to avoid
 * duplicates. Never initiates any Graph API call.
 */
export async function requestWhatsAppSetup(input: {
  contactPhone: string;
  contactName?: string | null;
  notes?: string | null;
}): Promise<RequestSetupResult> {
  let tenantId: string;
  try {
    ({ tenantId } = await assertProOwner());
  } catch (err) {
    const reason = err instanceof AuthorizationError ? err.reason : 'not_authorized';
    return { ok: false, reason };
  }

  const contactPhone = (input.contactPhone ?? '').trim();
  if (!isValidPhone(contactPhone)) {
    return { ok: false, reason: 'Please enter a valid WhatsApp phone number.' };
  }

  // Avoid duplicate open requests — return the existing one if still active.
  const existing = await getLatestSetupRequest(tenantId);
  if (existing && (existing.status === 'pending' || existing.status === 'in_progress')) {
    return { ok: true, request: toSetupRequestView(existing) };
  }

  try {
    const row = await createSetupRequest(tenantId, {
      contactPhone,
      contactName: (input.contactName ?? '').trim() || null,
      notes: (input.notes ?? '').trim() || null,
    });
    await recordOnboardingEvent(tenantId, 'in_progress', 'manual_setup_requested');

    // Best-effort admin alert (email via Web3Forms). Never blocks the request.
    try {
      const admin = createAdminClient();
      const { data: tenant } = await (admin
        .from('tenants' as any)
        .select('name, tenant_code')
        .eq('id', tenantId)
        .single() as any);
      await notifyAdminOfSetupRequest({
        salonName: (tenant as any)?.name ?? 'Unknown salon',
        tenantCode: (tenant as any)?.tenant_code ?? null,
        tenantId,
        contactPhone: row.contact_phone,
        contactName: row.contact_name,
        notes: row.notes,
      });
    } catch (err) {
      console.error('[requestWhatsAppSetup] admin alert failed:', err);
    }

    return { ok: true, request: toSetupRequestView(row) };
  } catch (err) {
    const reason =
      err instanceof Error ? `Failed to submit request: ${err.message}` : 'Failed to submit request';
    return { ok: false, reason };
  }
}

// =============================================================================
// WhatsApp Logs Server Action
// =============================================================================

export interface WhatsAppLogRow {
  id: string;
  phone: string;
  direction: 'inbound' | 'outbound';
  template_name: string | null;
  status: string;
  created_at: string;
  description: string;
}

function formatPhoneDisplay(phone: string): string {
  if (!phone) return '—';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return `+${cleaned}`;
}

function getDescription(log: any): string {
  const meta = log.metadata || {};
  const direction = log.direction;
  const template = log.template_name;
  const customerName = meta.customer_name || '';
  const messageText = meta.message_text || '';
  const buttonReplyId = meta.button_reply_id || '';

  if (direction === 'outbound') {
    switch (template) {
      case 'booking_confirmation':
      case 'booking_confirmation_v2': return `Booking confirmation sent to ${customerName || 'customer'}`;
      case 'appointment_reminder':
      case 'appointment_reminder_v1': return `Appointment reminder sent to ${customerName || 'customer'}`;
      case 'appointment_rescheduled_v1': return `Reschedule confirmation sent to ${customerName || 'customer'}`;
      case 'bill_receipt_v1':
      case 'bill_receipt': return `Bill receipt sent to ${customerName || 'customer'}`;
      case 'feedback_request_v1':
      case 'feedback_request': return `Feedback request sent to ${customerName || 'customer'}`;
      case 'appointment_cancelled': return `Cancellation notice sent to ${customerName || 'customer'}`;
      case 'appointment_rescheduled': return `Reschedule notice sent to ${customerName || 'customer'}`;
      case 'renewal_reminder': return `30-day win-back sent to ${customerName || 'customer'}`;
      case 'winback_60_day': return `60-day win-back sent to ${customerName || 'customer'}`;
      case 'otp_verification': return `OTP verification code sent`;
      default:
        if (template) return `"${template}" sent to ${customerName || 'customer'}`;
        return `WhatsApp message sent`;
    }
  }

  if (direction === 'inbound') {
    if (buttonReplyId) {
      const map: Record<string, string> = {
        'book_appointment': 'tapped "Book Appointment"',
        'services_prices': 'tapped "View Services"',
        'talk_to_salon': 'tapped "Talk to Salon"',
        'reschedule_appointment': 'tapped "Reschedule"',
        'cancel_appointment': 'tapped "Cancel"',
        'feedback_5': 'rated ⭐⭐⭐⭐⭐ (Loved it!)',
        'feedback_3': 'rated ⭐⭐⭐ (It was okay)',
        'feedback_1': 'rated 😞 (Not satisfied)',
        'google_review_yes': 'agreed to leave Google review',
        'google_review_no': 'declined Google review',
      };
      if (buttonReplyId.startsWith('confirm_cancel_')) return `${customerName || 'Customer'} confirmed cancellation`;
      if (buttonReplyId.startsWith('resched.')) return `${customerName || 'Customer'} selected reschedule date`;
      if (buttonReplyId.startsWith('reschedtime.')) return `${customerName || 'Customer'} selected reschedule time`;
      const action = map[buttonReplyId] || `tapped "${buttonReplyId}"`;
      return `${customerName || 'Customer'} ${action}`;
    }
    if (messageText) {
      const upper = messageText.trim().toUpperCase();
      if (upper.startsWith('BOOK_') || /\[SNG[-]?\d+\]/i.test(messageText)) {
        return `${customerName || 'Customer'} scanned QR code to book`;
      }
      return `${customerName || 'Customer'} sent: "${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}"`;
    }
    return `Message received from ${customerName || 'customer'}`;
  }

  return 'WhatsApp activity';
}

/**
 * Fetch WhatsApp automation logs for the current tenant.
 */
export async function getWhatsAppLogs(): Promise<WhatsAppLogRow[]> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) return [];

  try {
    const admin = createAdminClient();

    const { data: logs } = await (admin
      .from('whatsapp_sessions' as any)
      .select('id, phone, direction, template_name, status, created_at, metadata')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(150) as any);

    return (logs ?? []).map((log: any) => ({
      id: log.id,
      phone: formatPhoneDisplay(log.phone),
      direction: log.direction,
      template_name: log.template_name,
      status: log.status,
      created_at: log.created_at,
      description: getDescription(log),
    }));
  } catch (err) {
    console.error('[getWhatsAppLogs] Error:', err);
    return [];
  }
}

// =============================================================================
// Marketing Templates — Pro/owner gated create + list
//
// A Pro owner authors a marketing template (from a preset or free text) and we
// submit it to Meta on THEIR OWN WABA via the Management API, then mirror it
// locally so the composer can show its approval status. Creation is refused
// unless the tenant has a fully connected dedicated number — we never create a
// template on the shared Snip and Glow account.
// =============================================================================

/** Redacted view of a mirrored template returned to the owner UI. */
export interface MarketingTemplateView {
  id: string;
  name: string;
  language: string;
  category: string;
  status: TemplateStatus;
  bodyText: string;
  footerText: string | null;
  headerImageUrl: string | null;
  exampleParams: string[];
  rejectionReason: string | null;
  createdAt: string;
  /** 'standard' or 'carousel' — lets the campaign UI render the right preview. */
  templateType: 'standard' | 'carousel';
  /** Carousel only: ordered cards (empty for standard templates). */
  cards: Array<{ imageUrl: string; bodyText: string }>;
  /** Action buttons shared by the message (quick reply / url / call). */
  buttons: Array<{ type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url: string | null; phoneNumber: string | null }>;
}

function toTemplateView(row: TemplateRow): MarketingTemplateView {
  return {
    id: row.id,
    name: row.name,
    language: row.language,
    category: row.category,
    status: row.status,
    bodyText: row.body_text,
    footerText: row.footer_text,
    headerImageUrl: row.header_image_url,
    exampleParams: Array.isArray(row.example_params) ? row.example_params : [],
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    templateType: (row.template_type ?? 'standard') as 'standard' | 'carousel',
    cards: Array.isArray(row.cards)
      ? row.cards.map((c) => ({ imageUrl: c.image_url, bodyText: c.body_text }))
      : [],
    buttons: Array.isArray(row.buttons)
      ? row.buttons.map((b) => ({ type: b.type, text: b.text, url: b.url ?? null, phoneNumber: b.phone_number ?? null }))
      : [],
  };
}

/**
 * Upload a marketing-template header image to the tenant's public `marketing`
 * storage bucket and return its permanent public URL. The composer calls this
 * first, then passes the URL into {@link submitMarketingTemplate}. Pro/owner
 * gated; JPG/PNG up to 5 MB (the formats + size WhatsApp accepts for headers).
 */
export async function uploadMarketingTemplateImage(
  formData: FormData
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  let tenantId: string;
  try {
    ({ tenantId } = await assertProOwner());
  } catch {
    return { ok: false, error: 'Only the salon owner on a Pro plan can add template images.' };
  }

  const file = formData.get('image');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'Please choose an image.' };
  const type = (file.type || '').toLowerCase();
  if (type !== 'image/jpeg' && type !== 'image/jpg' && type !== 'image/png') {
    return { ok: false, error: 'Use a JPG or PNG image (those are the formats WhatsApp accepts).' };
  }
  if (file.size > MARKETING_IMAGE_MAX_BYTES) return { ok: false, error: 'Image must be under 5 MB.' };

  const bytes = Buffer.from(await file.arrayBuffer());
  const up = await storeMarketingImage(tenantId, bytes, file.type);
  if (!up.ok) return { ok: false, error: up.error };
  return { ok: true, url: up.url };
}

/** Parse a full Meta template (with components) into a local mirror-row input. */
function metaTemplateToMirrorInput(t: MetaTemplateFull): SubmittedTemplateInput | null {
  const comps = t.components || [];
  const body = comps.find((c) => (c.type || '').toUpperCase() === 'BODY');
  if (!body?.text) return null; // a template with no body isn't sendable/previewable
  const header = comps.find((c) => (c.type || '').toUpperCase() === 'HEADER');
  const footer = comps.find((c) => (c.type || '').toUpperCase() === 'FOOTER');
  const headerIsText = header ? (header.format || 'TEXT').toUpperCase() === 'TEXT' : false;
  const buttonsComp = comps.find((c) => (c.type || '').toUpperCase() === 'BUTTONS');
  const storedButtons = (buttonsComp?.buttons ?? [])
    .map((b) => {
      const bt = (b.type || '').toUpperCase();
      if (bt !== 'QUICK_REPLY' && bt !== 'URL' && bt !== 'PHONE_NUMBER') return null;
      return {
        type: bt as 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER',
        text: b.text || '',
        url: bt === 'URL' ? (b.url ?? null) : null,
        phone_number: bt === 'PHONE_NUMBER' ? (b.phone_number ?? null) : null,
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);
  return {
    name: t.name,
    language: t.language || 'en',
    category: t.category || 'MARKETING',
    bodyText: body.text,
    headerText: headerIsText ? header?.text ?? null : null,
    // Meta doesn't return a re-sendable public image URL, so only templates whose
    // banner we uploaded via the composer carry header_image_url — leave it null
    // here and never overwrite an existing one (we only insert NEW templates).
    headerImageUrl: null,
    footerText: footer?.text ?? null,
    exampleParams: body.example?.body_text?.[0] ?? [],
    status: t.status,
    metaTemplateId: t.id ?? null,
    buttons: storedButtons.length ? storedButtons : null,
  };
}

/**
 * Pull the tenant's MARKETING templates from their WABA into our local mirror so
 * the dashboard shows EVERY template — including ones created directly in
 * WhatsApp Manager, which never went through our composer. New templates are
 * inserted with full content; already-mirrored ones only get their status
 * refreshed, so we never clobber a composer-uploaded banner URL (which Meta
 * can't return). Best-effort: any failure leaves the cached mirror untouched.
 */
async function syncMarketingTemplatesFromMeta(
  tenantId: string,
  credentials: WhatsAppCredentials
): Promise<void> {
  try {
    const res = await fetchTemplateDefinitions(credentials);
    if (!res.ok) return;

    const existing = await listTenantTemplates(tenantId);
    const known = new Set(existing.map((r) => `${r.name}|${r.language}`));

    for (const t of res.templates) {
      if ((t.category || '').toUpperCase() !== 'MARKETING') continue;
      const key = `${t.name}|${t.language || 'en'}`;

      if (known.has(key)) {
        // Keep status fresh without overwriting the body/banner we already hold.
        // (Skip REJECTED so a webhook-provided rejection reason isn't cleared.)
        if (t.status !== 'REJECTED') {
          await updateTemplateStatus({
            metaTemplateId: t.id,
            name: t.name,
            language: t.language,
            status: t.status,
          });
        }
        continue;
      }

      // New to us (e.g. created in WhatsApp Manager) — insert a full mirror row.
      const input = metaTemplateToMirrorInput(t);
      if (input) {
        try {
          await upsertSubmittedTemplate(tenantId, input);
        } catch (err) {
          console.error('[syncMarketingTemplates] insert failed for', t.name, err);
        }
      }
    }
  } catch (err) {
    console.error('[syncMarketingTemplatesFromMeta] failed (non-fatal):', err);
  }
}

/**
 * List the requesting owner's marketing templates (newest first). Syncs live
 * from the tenant's WABA first, so templates created directly in WhatsApp
 * Manager appear here too. Tolerant: returns [] for a non-Pro/non-owner caller
 * (and on any sync failure falls back to the cached mirror).
 */
export async function getMarketingTemplates(): Promise<MarketingTemplateView[]> {
  try {
    const { tenantId } = await assertProOwner();
    const credentials = await getDedicatedCredentialsForTenant(tenantId);
    if (credentials) await syncMarketingTemplatesFromMeta(tenantId, credentials);
    const rows = await listTenantTemplates(tenantId);
    // The single-message composer lists standard templates only; carousels have
    // their own builder + list.
    return rows.filter((r) => (r.template_type ?? 'standard') !== 'carousel').map(toTemplateView);
  } catch {
    return [];
  }
}

/**
 * List every template the owner can SEND a campaign with — both standard
 * templates and carousels — newest first. Used by the campaign composer. Status
 * is refreshed from Meta first (same as getMarketingTemplates). Tolerant: []
 * for a non-Pro/non-owner caller. The composer filters to APPROVED.
 */
export async function getSendableTemplates(): Promise<MarketingTemplateView[]> {
  try {
    const { tenantId } = await assertProOwner();
    const credentials = await getDedicatedCredentialsForTenant(tenantId);
    if (credentials) await syncMarketingTemplatesFromMeta(tenantId, credentials);
    const rows = await listTenantTemplates(tenantId);
    return rows.map(toTemplateView);
  } catch {
    return [];
  }
}

/** Discriminated outcome of {@link submitMarketingTemplate}. Never carries a token. */
export type SubmitTemplateResult =
  | { ok: true; template: MarketingTemplateView }
  | { ok: false; reason: string };

/**
 * Create a marketing template on the owner's own WABA and mirror it locally.
 *
 * Sequence:
 *   1. {@link assertProOwner} — reject non-Pro/non-owner up front.
 *   2. {@link getDedicatedCredentialsForTenant} — require a connected dedicated
 *      number; `not_connected` otherwise (never falls back to the shared number).
 *   3. {@link createTemplate} — validate + POST to Meta's Management API.
 *   4. {@link upsertSubmittedTemplate} — record it locally as PENDING (Meta will
 *      push the approval verdict to the webhook, which flips the status).
 */
export async function submitMarketingTemplate(input: {
  name: string;
  bodyText: string;
  exampleParams: string[];
  footerText?: string | null;
  headerText?: string | null;
  headerImageUrl?: string | null;
  category?: TemplateCategory;
  language?: string;
  buttons?: Array<{ type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url?: string | null; phoneNumber?: string | null }>;
}): Promise<SubmitTemplateResult> {
  let tenantId: string;
  try {
    ({ tenantId } = await assertProOwner());
  } catch (err) {
    const reason = err instanceof AuthorizationError ? err.reason : 'not_authorized';
    return { ok: false, reason };
  }

  // Must have their OWN connected WABA — a template can only be created on the
  // account that will send it, and never on the shared platform number.
  const credentials = await getDedicatedCredentialsForTenant(tenantId);
  if (!credentials) {
    return { ok: false, reason: 'not_connected' };
  }

  // If the owner attached a banner, convert its stored public URL into a Meta
  // media handle — required to create an IMAGE-header template. Done here (not
  // at upload time) so the handle is fresh at create and travels with the token
  // that owns the template.
  let headerImageHandle: string | undefined;
  const headerImageUrl = input.headerImageUrl?.trim() || null;
  if (headerImageUrl) {
    const appId = getMetaAppId();
    if (!appId) return { ok: false, reason: 'Image headers need META_APP_ID configured on the server.' };
    try {
      const imgRes = await fetch(headerImageUrl);
      if (!imgRes.ok) return { ok: false, reason: 'Could not read the uploaded image. Please re-upload and try again.' };
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const up = await uploadResumableImage(appId, credentials.accessToken, buf, 'marketing-header', contentType);
      if (!up.ok || !up.handle) return { ok: false, reason: up.error || 'Could not upload the image to WhatsApp.' };
      headerImageHandle = up.handle;
    } catch {
      return { ok: false, reason: 'Could not process the image. Please try again.' };
    }
  }

  const definition = {
    name: normalizeTemplateName(input.name),
    language: input.language || 'en',
    category: (input.category ?? 'MARKETING') as TemplateCategory,
    bodyText: input.bodyText,
    exampleParams: input.exampleParams ?? [],
    headerText: input.headerText ?? undefined,
    headerImageHandle,
    footerText: input.footerText ?? undefined,
    buttons: input.buttons ?? undefined,
  };

  const result = await createTemplate(credentials, definition);
  if (!result.ok) {
    return { ok: false, reason: result.error ?? 'Template could not be created.' };
  }

  // Mirror the buttons locally so the composer/campaign preview can render them.
  const storedButtons = (input.buttons ?? [])
    .filter((b) => (b.text ?? '').trim())
    .map((b) => ({
      type: b.type,
      text: b.text.trim(),
      url: b.type === 'URL' ? (b.url || '').trim() : null,
      phone_number: b.type === 'PHONE_NUMBER' ? (b.phoneNumber || '').trim() : null,
    }));

  try {
    const row = await upsertSubmittedTemplate(tenantId, {
      name: definition.name,
      language: definition.language,
      category: definition.category,
      bodyText: definition.bodyText,
      headerText: definition.headerText ?? null,
      headerImageUrl,
      footerText: definition.footerText ?? null,
      exampleParams: definition.exampleParams,
      status: result.status ?? 'PENDING',
      metaTemplateId: result.metaTemplateId ?? null,
      buttons: storedButtons.length ? storedButtons : null,
    });
    if (!row) return { ok: false, reason: 'Saved to WhatsApp but failed to record it locally.' };
    return { ok: true, template: toTemplateView(row) };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Failed to save the template.';
    return { ok: false, reason };
  }
}

// =============================================================================
// Marketing Templates — reconcile approval status from Meta
//
// The webhook is the primary source of a template's verdict, but a missed
// webhook can leave a template stuck at PENDING. This lets the owner pull the
// live statuses from their WABA on demand and refresh the local mirror.
// =============================================================================

export async function reconcileMarketingTemplates(): Promise<MarketingTemplateView[]> {
  let tenantId: string;
  try {
    ({ tenantId } = await assertProOwner());
  } catch {
    return [];
  }

  const credentials = await getDedicatedCredentialsForTenant(tenantId);
  if (credentials) await syncMarketingTemplatesFromMeta(tenantId, credentials);

  const rows = await listTenantTemplates(tenantId);
  return rows.map(toTemplateView);
}

// =============================================================================
// Marketing Campaign — audience + send
//
// Sends an APPROVED marketing template from the tenant's OWN connected WABA to a
// chosen set of the salon's customers. Approved-only, dedicated-credentials
// only, server-side recipient resolution (never trusts client phone numbers),
// per-recipient name personalization, throttled, and logged.
// =============================================================================

export interface CampaignCustomer {
  id: string;
  name: string;
  phone: string;
  gender: string | null;
  dateOfBirth: string | null;
  lastVisitAt: string | null;
}

/** The tenant's customers for building a campaign audience (owner/Pro gated). */
export async function getCampaignCustomers(): Promise<CampaignCustomer[]> {
  let tenantId: string;
  try {
    ({ tenantId } = await assertProOwner());
  } catch {
    return [];
  }

  const admin = createAdminClient();

  // Page through the customer list so a campaign can target everyone, not just
  // the first slice. Capped so the in-browser picker stays responsive.
  const PAGE = 1000;
  const MAX = 5000;
  const rows: any[] = [];
  for (let from = 0; from < MAX; from += PAGE) {
    const { data } = await (admin
      .from('customers')
      .select('id, name, phone, gender, date_of_birth, last_visit_at')
      .eq('tenant_id', tenantId)
      .order('name', { ascending: true })
      .range(from, from + PAGE - 1) as any);
    const batch = (data ?? []) as any[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    gender: c.gender ?? null,
    dateOfBirth: c.date_of_birth ?? null,
    lastVisitAt: c.last_visit_at ?? null,
  }));
}

export interface CreateCampaignInput {
  templateId: string;
  /** Candidate customer ids (manual selection, or "select all" of a filter). */
  customerIds: string[];
  /** One value per template variable (index-aligned to {{1}}..{{N}}). */
  variableValues: string[];
  /** 0-based variable indexes to personalize with each customer's name. */
  personalizeIndexes: number[];
  /** Human-readable audience note for history (e.g. "All customers"). */
  audienceLabel?: string;
  /** When > 0, skip customers already sent a campaign within this many days. */
  excludeContactedDays?: number;
}

export interface CampaignView {
  id: string;
  templateName: string;
  status: 'draft' | 'sending' | 'paused' | 'completed' | 'cancelled' | 'failed';
  audienceLabel: string | null;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  error: string | null;
  createdAt: string;
}

export interface CreateCampaignResult {
  ok: boolean;
  error?: string;
  campaign?: CampaignView;
}

function toCampaignView(p: CampaignProgress): CampaignView {
  return {
    id: p.id,
    templateName: p.templateName,
    status: p.status,
    audienceLabel: p.audienceLabel,
    total: p.total,
    sent: p.sent,
    failed: p.failed,
    pending: p.pending,
    error: p.error,
    createdAt: p.createdAt,
  };
}

// First batch sent synchronously so the owner sees instant progress; the rest
// drips via nudgeCampaign (the progress screen). Sent with bounded concurrency,
// so these stay within the serverless time budget even on the Hobby plan.
const FIRST_BATCH = 20;
// Recipients the owner's progress screen sends per poll tick.
const NUDGE_BATCH = 30;
// Recipients inserted per bulk insert statement.
const INSERT_CHUNK = 500;

/**
 * Create a WhatsApp marketing campaign and begin sending.
 *
 * Resolves the audience server-side (never trusting client phones), writes the
 * campaign plus a per-recipient ledger, sends a first batch immediately, and
 * leaves the remainder to {@link nudgeCampaign} and the drip cron. There is NO
 * 200-recipient cap — a campaign of any size completes over time while recording
 * exactly who was contacted.
 */
export async function createMarketingCampaign(input: CreateCampaignInput): Promise<CreateCampaignResult> {
  let tenantId: string;
  try {
    ({ tenantId } = await assertProOwner());
  } catch (err) {
    const reason = err instanceof AuthorizationError ? err.reason : 'not_authorized';
    return { ok: false, error: reason };
  }

  // Must send from the tenant's OWN number where the template lives.
  const credentials = await getDedicatedCredentialsForTenant(tenantId);
  if (!credentials) return { ok: false, error: 'not_connected' };

  // Template must exist locally AND be APPROVED.
  const tpl = (await listTenantTemplates(tenantId)).find((r) => r.id === input.templateId);
  if (!tpl) return { ok: false, error: 'Template not found.' };
  if (tpl.status !== 'APPROVED') {
    return { ok: false, error: 'This template is not approved yet, so it can\u2019t be sent.' };
  }

  // Validate the variable values the sender will use (Meta rejects blanks).
  const placeholderCount = new Set(
    [...tpl.body_text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1]))
  ).size;
  const personalize = new Set((input.personalizeIndexes ?? []).map(Number));
  const values = input.variableValues ?? [];
  for (let i = 0; i < placeholderCount; i++) {
    if (!personalize.has(i) && !(values[i] ?? '').trim()) {
      return { ok: false, error: `Please fill in every template value (variable ${i + 1}).` };
    }
  }

  const isCarousel = (tpl.template_type ?? 'standard') === 'carousel';
  const carouselCards = Array.isArray(tpl.cards) ? tpl.cards : [];
  if (isCarousel) {
    if (carouselCards.length < 2) return { ok: false, error: 'This carousel has no cards to send.' };
    const missing = carouselCards.findIndex((c) => !c.image_url);
    if (missing !== -1) return { ok: false, error: `Card ${missing + 1} is missing its image.` };
  }

  const ids = Array.from(new Set((input.customerIds ?? []).filter(Boolean)));
  if (ids.length === 0) return { ok: false, error: 'Select at least one customer.' };

  const admin = createAdminClient();

  // Re-resolve recipients server-side (never trust client-supplied phones).
  const { data: custRows } = await (admin
    .from('customers')
    .select('id, name, phone')
    .eq('tenant_id', tenantId)
    .in('id', ids) as any);

  // Optionally skip anyone already sent a campaign within the recent window.
  let excludeIds = new Set<string>();
  const days = Math.max(0, Math.floor(input.excludeContactedDays ?? 0));
  if (days > 0) {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data: recent } = await (admin
      .from('whatsapp_campaign_recipients' as any)
      .select('customer_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'sent')
      .gte('sent_at', cutoff) as any);
    excludeIds = new Set(
      ((recent ?? []) as Array<{ customer_id: string | null }>)
        .map((r) => r.customer_id)
        .filter(Boolean) as string[]
    );
  }

  const seen = new Set<string>();
  const recipients = ((custRows ?? []) as Array<{ id: string; name: string; phone: string }>).filter((c) => {
    if (excludeIds.has(c.id)) return false;
    const digits = (c.phone || '').replace(/\D/g, '');
    if (!digits || seen.has(digits)) return false;
    seen.add(digits);
    return true;
  });

  if (recipients.length === 0) {
    return { ok: false, error: 'No valid recipients found (they may all have been messaged recently).' };
  }

  // Create the campaign row.
  const nowIso = new Date().toISOString();
  const { data: campaignRow, error: campErr } = await (admin
    .from('whatsapp_campaigns' as any)
    .insert({
      tenant_id: tenantId,
      template_id: tpl.id,
      template_name: tpl.name,
      status: 'sending',
      variable_values: values,
      personalize_indexes: Array.from(personalize),
      audience_label: input.audienceLabel ?? null,
      total_count: recipients.length,
      started_at: nowIso,
    })
    .select('id')
    .single() as any);

  if (campErr || !campaignRow?.id) {
    return { ok: false, error: 'Could not start the campaign. Please try again.' };
  }
  const campaignId = campaignRow.id as string;

  // Write the recipient ledger in chunks.
  for (let i = 0; i < recipients.length; i += INSERT_CHUNK) {
    const chunk = recipients.slice(i, i + INSERT_CHUNK).map((c) => ({
      campaign_id: campaignId,
      tenant_id: tenantId,
      customer_id: c.id,
      name: c.name,
      phone: (c.phone || '').replace(/\D/g, ''),
      status: 'pending',
    }));
    await (admin.from('whatsapp_campaign_recipients' as any).insert(chunk) as any);
  }

  // Send a first batch now for instant feedback; the rest drips in the background.
  const progress = await processCampaignBatch(campaignId, FIRST_BATCH);
  if (!progress) return { ok: false, error: 'Could not start the campaign. Please try again.' };
  return { ok: true, campaign: toCampaignView(progress) };
}

/**
 * Send the next batch of a campaign and return its live progress. Called
 * repeatedly by the owner's progress screen; safe to run alongside the drip
 * cron (claims are atomic). Scoped to the caller's tenant.
 */
export async function nudgeCampaign(campaignId: string): Promise<CampaignView | null> {
  let tenantId: string;
  try {
    ({ tenantId } = await assertProOwner());
  } catch {
    return null;
  }
  if (!(await ownsCampaign(tenantId, campaignId))) return null;
  const progress = await processCampaignBatch(campaignId, NUDGE_BATCH);
  return progress ? toCampaignView(progress) : null;
}

/** The tenant's campaigns, newest first, for the history list. */
export async function listMarketingCampaigns(limit = 20): Promise<CampaignView[]> {
  let tenantId: string;
  try {
    ({ tenantId } = await assertProOwner());
  } catch {
    return [];
  }
  const admin = createAdminClient();
  const { data } = await (admin
    .from('whatsapp_campaigns' as any)
    .select('id, template_name, status, audience_label, total_count, sent_count, failed_count, error, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit) as any);

  return ((data ?? []) as any[]).map((c) => ({
    id: c.id,
    templateName: c.template_name,
    status: c.status,
    audienceLabel: c.audience_label,
    total: c.total_count,
    sent: c.sent_count,
    failed: c.failed_count,
    pending: Math.max((c.total_count ?? 0) - (c.sent_count ?? 0) - (c.failed_count ?? 0), 0),
    error: c.error,
    createdAt: c.created_at,
  }));
}

async function ownsCampaign(tenantId: string, campaignId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await (admin
    .from('whatsapp_campaigns' as any)
    .select('id')
    .eq('id', campaignId)
    .eq('tenant_id', tenantId)
    .maybeSingle() as any);
  return !!data?.id;
}

async function setCampaignStatus(
  campaignId: string,
  status: 'sending' | 'paused' | 'cancelled'
): Promise<CampaignView | null> {
  let tenantId: string;
  try {
    ({ tenantId } = await assertProOwner());
  } catch {
    return null;
  }
  if (!(await ownsCampaign(tenantId, campaignId))) return null;

  const admin = createAdminClient();
  // Only move campaigns still in flight — never revive a finished/failed one.
  const guard = status === 'sending' ? ['paused'] : ['sending', 'paused'];
  await (admin
    .from('whatsapp_campaigns' as any)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .eq('tenant_id', tenantId)
    .in('status', guard) as any);

  // Cancelling drops the remaining work so it can't resume by accident.
  if (status === 'cancelled') {
    await (admin
      .from('whatsapp_campaign_recipients' as any)
      .update({ status: 'skipped' })
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'processing']) as any);
  }

  // Resuming sends a batch immediately; pause/cancel just report fresh progress.
  const progress = await processCampaignBatch(campaignId, status === 'sending' ? NUDGE_BATCH : 0);
  return progress ? toCampaignView(progress) : null;
}

export async function pauseMarketingCampaign(campaignId: string): Promise<CampaignView | null> {
  return setCampaignStatus(campaignId, 'paused');
}

export async function resumeMarketingCampaign(campaignId: string): Promise<CampaignView | null> {
  return setCampaignStatus(campaignId, 'sending');
}

export async function cancelMarketingCampaign(campaignId: string): Promise<CampaignView | null> {
  return setCampaignStatus(campaignId, 'cancelled');
}

// =============================================================================
// Marketing CAROUSEL templates — Pro/owner gated build + draft + submit.
//
// A carousel = a message bubble (BODY) + 2..10 image cards, each with offer text
// and a shared set of buttons. The owner builds and previews it, saves drafts,
// and submits it to Meta for approval on their OWN connected WABA. Submitting
// uploads each card image to Meta (resumable upload -> handle) and creates the
// template; the local mirror stores the full card content so the builder can
// re-render and the (later) sender can attach each card's image by link.
// =============================================================================

export interface CarouselCardView {
  imageUrl: string;
  bodyText: string;
}

export interface CarouselButtonView {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url: string | null;
  phoneNumber: string | null;
}

export interface CarouselTemplateView {
  id: string;
  name: string;
  language: string;
  status: TemplateStatus;
  bodyText: string;
  exampleParams: string[];
  cards: CarouselCardView[];
  buttons: CarouselButtonView[];
  rejectionReason: string | null;
  createdAt: string;
  metaTemplateId: string | null;
}

function toCarouselView(row: TemplateRow): CarouselTemplateView {
  return {
    id: row.id,
    name: row.name,
    language: row.language,
    status: row.status,
    bodyText: row.body_text,
    exampleParams: Array.isArray(row.example_params) ? row.example_params : [],
    cards: Array.isArray(row.cards)
      ? row.cards.map((c) => ({ imageUrl: c.image_url, bodyText: c.body_text }))
      : [],
    buttons: Array.isArray(row.buttons)
      ? row.buttons.map((b) => ({
          type: b.type,
          text: b.text,
          url: b.url ?? null,
          phoneNumber: b.phone_number ?? null,
        }))
      : [],
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    metaTemplateId: row.meta_template_id,
  };
}

/** Client-authored carousel payload (shared by draft save + submit). */
export interface CarouselInput {
  /** Row id when editing an existing draft (so a rename replaces, not clones). */
  id?: string | null;
  name: string;
  bodyText: string;
  bodyExampleParams: string[];
  buttons: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string | null;
    phoneNumber?: string | null;
  }>;
  cards: Array<{ imageUrl: string; bodyText: string }>;
  language?: string;
}

function toStoredButtons(
  buttons: CarouselInput['buttons']
): StoredCarouselButton[] {
  return (buttons ?? []).map((b) => ({
    type: b.type,
    text: b.text,
    url: b.url ?? null,
    phone_number: b.phoneNumber ?? null,
  }));
}

function toStoredCards(cards: CarouselInput['cards']): StoredCarouselCard[] {
  return (cards ?? []).map((c) => ({ image_url: c.imageUrl, body_text: c.bodyText }));
}

function toButtonDefs(buttons: CarouselInput['buttons']): CarouselButtonDef[] {
  return (buttons ?? []).map((b) => ({
    type: b.type,
    text: b.text,
    url: b.url ?? undefined,
    phoneNumber: b.phoneNumber ?? undefined,
  }));
}

/**
 * List the owner's carousel templates (newest first). Refreshes approval status
 * from Meta for already-submitted ones (never touches local card content).
 * Tolerant: returns [] for a non-Pro/non-owner caller.
 */
export async function getCarouselTemplates(): Promise<CarouselTemplateView[]> {
  try {
    const { tenantId } = await assertProOwner();
    const credentials = await getDedicatedCredentialsForTenant(tenantId);
    if (credentials) await syncMarketingTemplatesFromMeta(tenantId, credentials);
    const rows = await listTenantTemplates(tenantId);
    return rows
      .filter((r) => (r.template_type ?? 'standard') === 'carousel')
      .map(toCarouselView);
  } catch {
    return [];
  }
}

export type CarouselDraftResult =
  | { ok: true; template: CarouselTemplateView }
  | { ok: false; reason: string };

/**
 * Save (or update) a carousel as a local DRAFT so the owner can edit it over
 * time before submitting. Requires only a name; cards/buttons may be partial.
 * Refuses to overwrite a name already used by a non-draft (submitted) template.
 */
export async function saveCarouselDraft(input: CarouselInput): Promise<CarouselDraftResult> {
  let tenantId: string;
  try {
    ({ tenantId } = await assertProOwner());
  } catch (err) {
    const reason = err instanceof AuthorizationError ? err.reason : 'not_authorized';
    return { ok: false, reason };
  }

  const name = normalizeTemplateName(input.name);
  if (!input.name || !input.name.trim()) return { ok: false, reason: 'Give the carousel a name.' };
  const language = input.language || 'en';

  // Don't clobber an already-submitted template of the same name with a draft.
  const existing = (await listTenantTemplates(tenantId)).find(
    (r) => r.name === name && r.language === language
  );
  if (existing && existing.status !== 'DRAFT') {
    return {
      ok: false,
      reason: 'A submitted template already uses this name. Pick a different name for your draft.',
    };
  }

  try {
    const row = await upsertSubmittedTemplate(tenantId, {
      name,
      language,
      category: 'MARKETING',
      templateType: 'carousel',
      bodyText: input.bodyText ?? '',
      exampleParams: input.bodyExampleParams ?? [],
      cards: toStoredCards(input.cards),
      buttons: toStoredButtons(input.buttons),
      status: 'DRAFT',
      metaTemplateId: null,
    });
    if (!row) return { ok: false, reason: 'Could not save the draft.' };
    return { ok: true, template: toCarouselView(row) };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Could not save the draft.';
    return { ok: false, reason };
  }
}

export type SubmitCarouselResult =
  | { ok: true; template: CarouselTemplateView }
  | { ok: false; reason: string };

/**
 * Submit a carousel to Meta for approval on the owner's own WABA.
 *
 * Steps: Pro/owner guard -> require a connected dedicated number -> validate the
 * definition -> upload every card image to Meta (resumable upload, in parallel)
 * to obtain a per-card media handle -> create the template -> mirror it locally
 * as PENDING with the full card content (the webhook flips the status later).
 */
export async function submitCarouselTemplate(input: CarouselInput): Promise<SubmitCarouselResult> {
  let tenantId: string;
  try {
    ({ tenantId } = await assertProOwner());
  } catch (err) {
    const reason = err instanceof AuthorizationError ? err.reason : 'not_authorized';
    return { ok: false, reason };
  }

  const credentials = await getDedicatedCredentialsForTenant(tenantId);
  if (!credentials) return { ok: false, reason: 'not_connected' };

  const name = normalizeTemplateName(input.name);
  const language = input.language || 'en';
  const cards = input.cards ?? [];

  if (cards.length > CAROUSEL_MAX_CARDS) {
    return { ok: false, reason: `A carousel can have at most ${CAROUSEL_MAX_CARDS} cards.` };
  }
  const missingImage = cards.findIndex((c) => !c.imageUrl || !c.imageUrl.trim());
  if (missingImage !== -1) {
    return { ok: false, reason: `Add an image to card ${missingImage + 1} before submitting.` };
  }

  const appId = getMetaAppId();
  if (!appId) return { ok: false, reason: 'Image cards need META_APP_ID configured on the server.' };

  // Upload every card image to Meta -> media handle (parallel to stay fast).
  let handles: string[];
  try {
    handles = await Promise.all(
      cards.map(async (c, i) => {
        const imgRes = await fetch(c.imageUrl);
        if (!imgRes.ok) throw new Error(`Could not read the image on card ${i + 1}. Re-upload and try again.`);
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        const buf = Buffer.from(await imgRes.arrayBuffer());
        const up = await uploadResumableImage(appId, credentials.accessToken, buf, `carousel-card-${i + 1}`, contentType);
        if (!up.ok || !up.handle) throw new Error(up.error || `Could not upload card ${i + 1} image to WhatsApp.`);
        return up.handle;
      })
    );
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Could not upload the card images.' };
  }

  const definition: CarouselTemplateDefinition = {
    name,
    language,
    category: 'MARKETING',
    bodyText: input.bodyText ?? '',
    bodyExampleParams: input.bodyExampleParams ?? [],
    buttons: toButtonDefs(input.buttons),
    cards: cards.map((c, i) => ({ headerImageHandle: handles[i], bodyText: c.bodyText })),
  };

  const validation = validateCarouselDefinition(definition);
  if (!validation.ok) return { ok: false, reason: validation.error };

  const result = await createCarouselTemplate(credentials, definition);
  if (!result.ok) return { ok: false, reason: result.error ?? 'The carousel could not be created.' };

  try {
    const row = await upsertSubmittedTemplate(tenantId, {
      name,
      language,
      category: 'MARKETING',
      templateType: 'carousel',
      bodyText: definition.bodyText,
      exampleParams: definition.bodyExampleParams ?? [],
      cards: toStoredCards(input.cards),
      buttons: toStoredButtons(input.buttons),
      status: result.status ?? 'PENDING',
      metaTemplateId: result.metaTemplateId ?? null,
    });
    if (!row) return { ok: false, reason: 'Saved to WhatsApp but failed to record it locally.' };
    return { ok: true, template: toCarouselView(row) };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Failed to save the carousel.';
    return { ok: false, reason };
  }
}

/**
 * Discard a local carousel. Only DRAFT and REJECTED rows can be deleted here —
 * removing a PENDING/APPROVED template locally would desync it from Meta (it
 * would still exist on the WABA), so those are left in place.
 */
export async function deleteCarouselTemplate(
  id: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let tenantId: string;
  try {
    ({ tenantId } = await assertProOwner());
  } catch (err) {
    const reason = err instanceof AuthorizationError ? err.reason : 'not_authorized';
    return { ok: false, reason };
  }

  const row = await getTenantTemplateById(tenantId, id);
  if (!row) return { ok: false, reason: 'Carousel not found.' };
  if (row.status !== 'DRAFT' && row.status !== 'REJECTED') {
    return { ok: false, reason: 'Only drafts and rejected carousels can be deleted here.' };
  }

  const ok = await deleteTenantTemplate(tenantId, id);
  return ok ? { ok: true } : { ok: false, reason: 'Could not delete the carousel.' };
}

/**
 * Duplicate a carousel into a new editable DRAFT (name + "_copy"), so a tenant
 * can reuse last festival's layout — swap the images and text, then submit.
 */
export async function duplicateCarouselTemplate(id: string): Promise<CarouselDraftResult> {
  let tenantId: string;
  try {
    ({ tenantId } = await assertProOwner());
  } catch (err) {
    const reason = err instanceof AuthorizationError ? err.reason : 'not_authorized';
    return { ok: false, reason };
  }

  const row = await getTenantTemplateById(tenantId, id);
  if (!row) return { ok: false, reason: 'Carousel not found.' };

  // Find a free "<name>_copy[_n]" name for the duplicate.
  const existingNames = new Set((await listTenantTemplates(tenantId)).map((r) => r.name));
  const base = normalizeTemplateName(`${row.name}_copy`);
  let candidate = base;
  let n = 2;
  while (existingNames.has(candidate)) candidate = normalizeTemplateName(`${base}_${n++}`);

  try {
    const created = await upsertSubmittedTemplate(tenantId, {
      name: candidate,
      language: row.language,
      category: 'MARKETING',
      templateType: 'carousel',
      bodyText: row.body_text,
      exampleParams: Array.isArray(row.example_params) ? row.example_params : [],
      cards: Array.isArray(row.cards) ? row.cards : [],
      buttons: Array.isArray(row.buttons) ? row.buttons : [],
      status: 'DRAFT',
      metaTemplateId: null,
    });
    if (!created) return { ok: false, reason: 'Could not duplicate the carousel.' };
    return { ok: true, template: toCarouselView(created) };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Could not duplicate the carousel.';
    return { ok: false, reason };
  }
}
