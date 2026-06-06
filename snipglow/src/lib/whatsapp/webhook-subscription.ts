// =============================================================================
// WhatsApp Webhook Subscription
// Registers a Tenant's WABA to the platform's Meta webhook so inbound messages
// route to the platform. (Requirement 5.1)
// =============================================================================

import { WA_BASE_URL } from './config';

export interface SubscribeResult {
  ok: boolean;
  /**
   * Descriptive failure reason on error. Derived only from the Graph API
   * `error.message` or the HTTP status — it NEVER contains the access token.
   */
  errorReason?: string;
}

/**
 * Subscribe a Tenant's WABA to the platform app's webhook by calling the Meta
 * Graph API `POST {waba-id}/subscribed_apps` endpoint.
 *
 * The access token is sent only in the `Authorization` header and is never
 * placed into the returned result or any error reason. (Requirement 5.1)
 *
 * @param wabaId The Tenant's WhatsApp Business Account id.
 * @param token  The Tenant's long-lived access token (header use only).
 */
export async function subscribeWaba(
  wabaId: string,
  token: string
): Promise<SubscribeResult> {
  try {
    const res = await fetch(`${WA_BASE_URL}/${wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    let data: { success?: boolean; error?: { message?: string } } = {};
    try {
      data = await res.json();
    } catch {
      // Non-JSON body — fall through to status-based handling below.
    }

    if (!res.ok) {
      const reason =
        data.error?.message || `HTTP ${res.status} ${res.statusText}`.trim();
      return { ok: false, errorReason: reason };
    }

    // Graph API returns `{ success: true }` on a successful subscription.
    if (data.success === false) {
      return { ok: false, errorReason: 'subscription_not_confirmed' };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, errorReason: String(e) };
  }
}
