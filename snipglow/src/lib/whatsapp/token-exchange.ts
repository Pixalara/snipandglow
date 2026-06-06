// =============================================================================
// WhatsApp Token Exchange Service
// Exchanges a Meta Embedded Signup authorization code for a long-lived access
// token and fetches the associated WhatsApp Business Account (WABA) details.
//
// Design: Token Exchange Service interface (pro-plan-whatsapp-onboarding).
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
//
// IMPORTANT (Req 3.3 / 4.7 / 10.3): error reasons returned by this module are
// derived from the Graph API `error.message` or the HTTP status only. They must
// NEVER contain the access token or any other credential.
// =============================================================================

import { WA_BASE_URL } from './config';

/** Maximum time (ms) allowed for the full Graph API token exchange (Req 3.6). */
const EXCHANGE_TIMEOUT_MS = 30_000;

/** Result of validating a raw authorization code (Req 3.4, 3.5). */
export type AuthCodeValidation =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'malformed' };

/** WhatsApp Business Account details fetched after the token exchange (Req 3.2). */
export interface WabaDetails {
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
}

/** Outcome of the full code-for-token exchange + WABA detail fetch. */
export interface ExchangeResult {
  ok: boolean;
  accessToken?: string;
  waba?: WabaDetails;
  /** Descriptive failure reason (Req 3.3) — never contains a token. */
  errorReason?: string;
}

// Auth codes from Meta Embedded Signup are URL-safe opaque strings. We accept a
// conservative well-formed character set and reject anything containing
// whitespace or characters that could not appear in a genuine code.
const WELL_FORMED_CODE = /^[A-Za-z0-9._\-|]+$/;

/**
 * Validate an Embedded Signup authorization code before any Graph API call.
 *
 * A code is valid only when it is present, non-empty after trimming
 * whitespace, and well-formed. Validation failure must prevent the Meta Graph
 * API call entirely (Req 3.4, 3.5).
 */
export function validateAuthCode(
  code: string | null | undefined
): AuthCodeValidation {
  if (code === null || code === undefined) {
    return { ok: false, reason: 'empty' };
  }
  if (typeof code !== 'string') {
    return { ok: false, reason: 'malformed' };
  }

  const trimmed = code.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'empty' };
  }

  if (!WELL_FORMED_CODE.test(trimmed)) {
    return { ok: false, reason: 'malformed' };
  }

  return { ok: true };
}

/** Read a required platform Meta app credential from the environment. */
function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing_env:${name}`);
  }
  return value;
}

/**
 * Build a descriptive, token-free error reason from a Graph API response body
 * and/or HTTP status. Only `error.message` and the status are surfaced.
 */
function describeGraphError(status: number, body: unknown): string {
  const message =
    body &&
    typeof body === 'object' &&
    'error' in body &&
    body.error &&
    typeof body.error === 'object' &&
    'message' in body.error &&
    typeof (body.error as { message: unknown }).message === 'string'
      ? (body.error as { message: string }).message
      : undefined;

  return message
    ? `Meta Graph API error (HTTP ${status}): ${message}`
    : `Meta Graph API error (HTTP ${status})`;
}

/**
 * Fetch the WABA id, phone number id, and display phone number associated with
 * a freshly obtained access token (Req 3.2).
 *
 * Mirrors the proven flow in `functions/src/whatsapp/whatsappConnect.ts`:
 *   1. GET /me/whatsapp_business_accounts -> first WABA id
 *   2. GET /{waba-id}/phone_numbers       -> first phone number id + display number
 *
 * Returns mapped {@link WabaDetails} on success or an {@link ExchangeResult}
 * carrying a token-free `errorReason` on failure.
 */
export async function fetchWabaDetails(
  token: string,
  signal?: AbortSignal
): Promise<WabaDetails | { errorReason: string }> {
  const authHeaders = { Authorization: `Bearer ${token}` };

  // 1. Resolve the WhatsApp Business Account.
  const wabaResponse = await fetch(`${WA_BASE_URL}/me/whatsapp_business_accounts`, {
    headers: authHeaders,
    signal,
  });
  const wabaData = await wabaResponse.json().catch(() => ({}));

  if (
    !wabaResponse.ok ||
    !wabaData?.data ||
    !Array.isArray(wabaData.data) ||
    wabaData.data.length === 0
  ) {
    return {
      errorReason: wabaResponse.ok
        ? 'No WhatsApp Business Account found for this account'
        : describeGraphError(wabaResponse.status, wabaData),
    };
  }

  const wabaId: string = wabaData.data[0].id;

  // 2. Resolve the phone number under that WABA.
  const phonesResponse = await fetch(`${WA_BASE_URL}/${wabaId}/phone_numbers`, {
    headers: authHeaders,
    signal,
  });
  const phonesData = await phonesResponse.json().catch(() => ({}));

  if (
    !phonesResponse.ok ||
    !phonesData?.data ||
    !Array.isArray(phonesData.data) ||
    phonesData.data.length === 0
  ) {
    return {
      errorReason: phonesResponse.ok
        ? 'No phone number found for the WhatsApp Business Account'
        : describeGraphError(phonesResponse.status, phonesData),
    };
  }

  const phone = phonesData.data[0];
  const phoneNumberId: string = phone.id;
  const displayPhoneNumber: string =
    phone.display_phone_number || phone.phone_number || '';

  return { wabaId, phoneNumberId, displayPhoneNumber };
}

/**
 * Exchange an Embedded Signup authorization code for a long-lived access token
 * and fetch the associated WABA details (Req 3.1, 3.2).
 *
 * The entire operation is bounded by a 30s `AbortController` timeout (Req 3.6);
 * on timeout a `timeout` reason is returned. Any Graph API error yields a
 * descriptive, token-free `errorReason` (Req 3.3).
 */
export async function exchangeCodeForToken(code: string): Promise<ExchangeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EXCHANGE_TIMEOUT_MS);

  try {
    const appId = readEnv('META_APP_ID');
    const appSecret = readEnv('META_APP_SECRET');

    // 1. Exchange the authorization code for an access token (Req 3.1).
    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code,
    });

    const tokenResponse = await fetch(
      `${WA_BASE_URL}/oauth/access_token?${tokenParams.toString()}`,
      { signal: controller.signal }
    );
    const tokenData = await tokenResponse.json().catch(() => ({}));

    if (!tokenResponse.ok || !tokenData?.access_token) {
      return {
        ok: false,
        errorReason: describeGraphError(tokenResponse.status, tokenData),
      };
    }

    const accessToken: string = tokenData.access_token;

    // 2. Fetch WABA details using the new token (Req 3.2).
    const waba = await fetchWabaDetails(accessToken, controller.signal);
    if ('errorReason' in waba) {
      return { ok: false, errorReason: waba.errorReason };
    }

    return { ok: true, accessToken, waba };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        ok: false,
        errorReason: `Token exchange timed out after ${EXCHANGE_TIMEOUT_MS / 1000}s`,
      };
    }
    if (err instanceof Error && err.message.startsWith('missing_env:')) {
      const name = err.message.slice('missing_env:'.length);
      return {
        ok: false,
        errorReason: `Server is not configured for WhatsApp onboarding (missing ${name})`,
      };
    }
    return {
      ok: false,
      errorReason:
        err instanceof Error
          ? `Token exchange failed: ${err.message}`
          : 'Token exchange failed: unknown error',
    };
  } finally {
    clearTimeout(timeout);
  }
}
