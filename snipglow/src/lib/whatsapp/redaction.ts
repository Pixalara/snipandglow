// =============================================================================
// WhatsApp Onboarding — Redaction-safe view mappers
//
// These mappers take a `tenant_whatsapp_settings` row (which may include the
// encrypted access token and other sensitive columns, e.g. when loaded via
// `select('*')`) and produce view objects for the admin tenant detail page and
// for owner-facing server-action responses.
//
// CONTRACT (Requirements 4.7, 9.2, 10.3):
//   The returned shapes MUST NEVER include `access_token_encrypted` nor any
//   plaintext access token. The mappers achieve this by explicitly picking only
//   safe fields — they never spread the source row — so adding new columns to
//   the table can never accidentally leak a secret through these views.
// =============================================================================

/** WhatsApp delivery mode persisted on the settings row. */
export type WhatsAppMode = 'shared' | 'dedicated';

/** Onboarding lifecycle status persisted on the settings row. */
export type OnboardingStatusValue =
  | 'not_started'
  | 'in_progress'
  | 'connected'
  | 'failed'
  | 'disconnected';

const VALID_STATUSES: ReadonlySet<string> = new Set<OnboardingStatusValue>([
  'not_started',
  'in_progress',
  'connected',
  'failed',
  'disconnected',
]);

/**
 * Shape of a `tenant_whatsapp_settings` row as it may arrive from Supabase.
 * All fields are optional/nullable because callers frequently use `select('*')`
 * or `maybeSingle()`. The index signature acknowledges that extra columns
 * (including `access_token_encrypted`) may be present — the mappers below
 * deliberately ignore anything not explicitly listed as safe.
 */
export interface TenantWhatsAppSettingsRow {
  tenant_id?: string | null;
  mode?: string | null;
  booking_slug?: string | null;
  waba_id?: string | null;
  phone_number_id?: string | null;
  display_phone_number?: string | null;
  display_name?: string | null;
  display_name_status?: string | null;
  webhook_status?: string | null;
  onboarding_status?: string | null;
  onboarding_error?: string | null;
  onboarding_updated_at?: string | null;
  access_token_encrypted?: string | null;
  [key: string]: unknown;
}

/** Redaction-safe projection rendered on the admin tenant detail page (Req 9.1, 9.2). */
export interface AdminWhatsAppView {
  mode: WhatsAppMode;
  onboardingStatus: OnboardingStatusValue;
  displayPhoneNumber: string | null;
  webhookStatus: string | null;
  bookingSlug: string | null;
  onboardingError: string | null;
  onboardingUpdatedAt: string | null;
}

/** Redaction-safe owner-facing onboarding state returned by server actions (Req 7.1, 10.5). */
export interface OnboardingStateResponse {
  status: OnboardingStatusValue;
  mode: WhatsAppMode;
  displayPhoneNumber: string | null;
  webhookStatus: string | null;
  errorReason: string | null;
}

/** Normalize an arbitrary string into a known onboarding status, defaulting to `not_started`. */
function normalizeStatus(value: unknown): OnboardingStatusValue {
  return typeof value === 'string' && VALID_STATUSES.has(value)
    ? (value as OnboardingStatusValue)
    : 'not_started';
}

/** Normalize the delivery mode, defaulting to `shared` for any unknown/missing value. */
function normalizeMode(value: unknown): WhatsAppMode {
  return value === 'dedicated' ? 'dedicated' : 'shared';
}

/** Coerce a possibly-null string column into `string | null` (never `undefined`). */
function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Map a settings row to the admin-facing view.
 *
 * Returns `null` when no row exists so the caller can render the
 * "Dedicated WhatsApp not configured" empty state (Req 9.3). The returned
 * object never includes `access_token_encrypted` or any plaintext token.
 */
export function toAdminWhatsAppView(
  row: TenantWhatsAppSettingsRow | null | undefined
): AdminWhatsAppView | null {
  if (!row) return null;

  return {
    mode: normalizeMode(row.mode),
    onboardingStatus: normalizeStatus(row.onboarding_status),
    displayPhoneNumber: nullableString(row.display_phone_number),
    webhookStatus: nullableString(row.webhook_status),
    bookingSlug: nullableString(row.booking_slug),
    onboardingError: nullableString(row.onboarding_error),
    onboardingUpdatedAt: nullableString(row.onboarding_updated_at),
  };
}

/**
 * Map a settings row to the owner-facing server-action response.
 *
 * When no row exists, returns a default `not_started` / `shared` state
 * (Req 10.5). The returned object never includes `access_token_encrypted` or
 * any plaintext token (Req 4.7).
 */
export function toOnboardingStateResponse(
  row: TenantWhatsAppSettingsRow | null | undefined
): OnboardingStateResponse {
  if (!row) {
    return {
      status: 'not_started',
      mode: 'shared',
      displayPhoneNumber: null,
      webhookStatus: null,
      errorReason: null,
    };
  }

  return {
    status: normalizeStatus(row.onboarding_status),
    mode: normalizeMode(row.mode),
    displayPhoneNumber: nullableString(row.display_phone_number),
    webhookStatus: nullableString(row.webhook_status),
    errorReason: nullableString(row.onboarding_error),
  };
}
