// =============================================================================
// Owner Notification Utility
// Uses approved Utility templates — works 24/7, no 24h window restriction.
// Templates: owner_booking_alert, owner_reschedule_alert,
//            owner_cancel_alert, owner_feedback_alert
// =============================================================================

import { sendMessage } from './templates';
import type { WhatsAppCredentials } from './config';

/**
 * Normalize a phone number to E.164 digits (no +, no spaces).
 */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.length === 10 && /^[6-9]/.test(digits)) return '91' + digits;
  if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1);
  return digits;
}

/**
 * Get the owner's phone for a tenant.
 * Tries tenants.phone first, then owner employee record.
 */
export async function getOwnerPhone(admin: any, tenantId: string): Promise<string | null> {
  const { data: tenant } = await admin.from('tenants').select('phone').eq('id', tenantId).single();
  if (tenant?.phone) {
    const normalized = normalizePhone(tenant.phone);
    if (normalized.length === 12) return normalized;
  }
  const { data: ownerEmp } = await (admin
    .from('employees')
    .select('phone')
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')
    .eq('is_active', true)
    .limit(1)
    .single() as any);
  if (ownerEmp?.phone) {
    const normalized = normalizePhone(ownerEmp.phone);
    if (normalized.length === 12) return normalized;
  }
  console.warn('[NotifyOwner] No valid owner phone for tenant:', tenantId);
  return null;
}

// =============================================================================
// Typed notification functions using approved Utility templates
// =============================================================================

/** New booking alert to salon owner */
export async function notifyOwnerNewBooking(
  admin: any, credentials: WhatsAppCredentials, tenantId: string,
  salonName: string, customerName: string, customerPhone: string,
  services: string, dateTime: string
): Promise<void> {
  const ownerPhone = await getOwnerPhone(admin, tenantId);
  if (!ownerPhone) return;
  const result = await sendMessage(credentials, ownerPhone, {
    type: 'template',
    template: {
      name: 'owner_booking_alert',
      language: { code: 'en' },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: salonName },
          { type: 'text', text: customerName },
          { type: 'text', text: `+${customerPhone}` },
          { type: 'text', text: services },
          { type: 'text', text: dateTime },
        ],
      }],
    },
  });
  console.log('[NotifyOwner] Booking alert →', ownerPhone, result.success ? 'OK' : result.error);
}

/** Reschedule alert to salon owner */
export async function notifyOwnerReschedule(
  admin: any, credentials: WhatsAppCredentials, tenantId: string,
  salonName: string, customerName: string, customerPhone: string,
  services: string, newDateTime: string
): Promise<void> {
  const ownerPhone = await getOwnerPhone(admin, tenantId);
  if (!ownerPhone) return;
  const result = await sendMessage(credentials, ownerPhone, {
    type: 'template',
    template: {
      name: 'owner_reschedule_alert',
      language: { code: 'en' },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: salonName },
          { type: 'text', text: customerName },
          { type: 'text', text: `+${customerPhone}` },
          { type: 'text', text: services },
          { type: 'text', text: newDateTime },
        ],
      }],
    },
  });
  console.log('[NotifyOwner] Reschedule alert →', ownerPhone, result.success ? 'OK' : result.error);
}

/** Cancel alert to salon owner */
export async function notifyOwnerCancel(
  admin: any, credentials: WhatsAppCredentials, tenantId: string,
  salonName: string, customerName: string, customerPhone: string
): Promise<void> {
  const ownerPhone = await getOwnerPhone(admin, tenantId);
  if (!ownerPhone) return;
  const result = await sendMessage(credentials, ownerPhone, {
    type: 'template',
    template: {
      name: 'owner_cancel_alert',
      language: { code: 'en' },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: salonName },
          { type: 'text', text: customerName },
          { type: 'text', text: `+${customerPhone}` },
        ],
      }],
    },
  });
  console.log('[NotifyOwner] Cancel alert →', ownerPhone, result.success ? 'OK' : result.error);
}

/** Feedback alert to salon owner */
export async function notifyOwnerFeedback(
  admin: any, credentials: WhatsAppCredentials, tenantId: string,
  salonName: string, customerName: string, rating: number
): Promise<void> {
  const ownerPhone = await getOwnerPhone(admin, tenantId);
  if (!ownerPhone) return;
  const result = await sendMessage(credentials, ownerPhone, {
    type: 'template',
    template: {
      name: 'owner_feedback_alert',
      language: { code: 'en' },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: salonName },
          { type: 'text', text: customerName },
          { type: 'text', text: String(rating) },
        ],
      }],
    },
  });
  console.log('[NotifyOwner] Feedback alert →', ownerPhone, result.success ? 'OK' : result.error);
}

/** Generic fallback — kept for backward compat, tries text then cancel template */
export async function notifyOwner(
  admin: any, credentials: WhatsAppCredentials, tenantId: string, message: string
): Promise<void> {
  const ownerPhone = await getOwnerPhone(admin, tenantId);
  if (!ownerPhone) return;
  const result = await sendMessage(credentials, ownerPhone, { type: 'text', text: { body: message } });
  console.log('[NotifyOwner] Generic →', ownerPhone, result.success ? 'OK' : result.error);
}

