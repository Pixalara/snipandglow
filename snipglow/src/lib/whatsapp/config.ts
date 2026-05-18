// =============================================================================
// WhatsApp Cloud API Configuration
// Multi-tenant ready: uses platform credentials by default,
// tenant-specific credentials when available.
// =============================================================================

export interface WhatsAppCredentials {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
}

/**
 * Get platform-level WhatsApp credentials (SnipandGlow's own number).
 * Used for sending messages on behalf of tenants who haven't connected their own number.
 */
export function getPlatformCredentials(): WhatsAppCredentials | null {
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const businessAccountId = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID;

  if (!accessToken || !phoneNumberId || !businessAccountId) {
    return null;
  }

  return { accessToken, phoneNumberId, businessAccountId };
}

/**
 * Get webhook verification token.
 */
export function getWebhookVerifyToken(): string {
  return process.env.META_WEBHOOK_VERIFY_TOKEN || '';
}

/**
 * Get Meta App Secret for webhook signature verification.
 */
export function getAppSecret(): string {
  return process.env.META_APP_SECRET || '';
}

/**
 * WhatsApp Cloud API base URL
 */
export const WA_API_VERSION = 'v21.0';
export const WA_BASE_URL = `https://graph.facebook.com/${WA_API_VERSION}`;
