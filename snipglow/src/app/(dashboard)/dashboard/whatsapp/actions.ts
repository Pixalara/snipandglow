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

  if ((tenant as any)?.plan_tier !== 'pro') {
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
