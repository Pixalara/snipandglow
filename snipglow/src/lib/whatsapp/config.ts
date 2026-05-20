// =============================================================================
// WhatsApp Cloud API Configuration
// Multi-tenant: Shared mode (Snip and Glow number) + Dedicated mode (salon's own)
// =============================================================================

export interface WhatsAppCredentials {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
}

// Snip and Glow's shared platform number
export const PLATFORM_PHONE_NUMBER_ID = '1165461446644735';
export const PLATFORM_WABA_ID = '1245944267357075';

/**
 * Get platform-level WhatsApp credentials (Snip and Glow's shared number).
 * Used for shared mode — salons that don't have their own WhatsApp API.
 */
export function getPlatformCredentials(): WhatsAppCredentials | null {
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID || PLATFORM_PHONE_NUMBER_ID;
  const businessAccountId = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID || PLATFORM_WABA_ID;

  if (!accessToken) {
    return null;
  }

  return { accessToken, phoneNumberId, businessAccountId };
}

/**
 * Check if a phone_number_id belongs to the shared Snip and Glow number.
 */
export function isSharedNumber(phoneNumberId: string): boolean {
  return phoneNumberId === PLATFORM_PHONE_NUMBER_ID ||
    phoneNumberId === (process.env.META_WHATSAPP_PHONE_NUMBER_ID || PLATFORM_PHONE_NUMBER_ID);
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

/**
 * Parse booking slug from prefilled message.
 * Handles:
 * - "BOOK_SNG001_ROYAL_SALOON" → "sng001_royal_saloon"
 * - "SNG001" → looks up by tenant_code
 * - "Hi" / "Hello" → no slug (handled by session)
 * Trims trailing underscores/spaces.
 */
export function parseBookingSlug(message: string): string | null {
  const trimmed = message.trim().toUpperCase();
  if (trimmed.startsWith('BOOK_')) {
    return trimmed.replace('BOOK_', '').toLowerCase().replace(/_+$/, '');
  }
  // Short code format: SNG001, SNG-001
  if (/^SNG[-]?\d+$/i.test(trimmed)) {
    return trimmed.toLowerCase().replace('-', '');
  }
  return null;
}
