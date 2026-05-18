// =============================================================================
// WhatsApp Message Template Builders
// These construct the payload for Meta's Cloud API template messages.
// Template names must match what's approved in Meta Business Manager.
// =============================================================================

import type { WhatsAppCredentials } from './config';
import { WA_BASE_URL } from './config';

// =============================================================================
// Types
// =============================================================================

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface TemplateComponent {
  type: string;
  sub_type?: string;
  index?: string;
  parameters?: Array<{ type: string; text?: string; payload?: string }>;
}

// =============================================================================
// Core Send Function
// =============================================================================

/**
 * Send a message via WhatsApp Cloud API.
 * Handles both template messages and interactive messages.
 */
export async function sendMessage(
  credentials: WhatsAppCredentials,
  to: string,
  payload: Record<string, unknown>
): Promise<SendResult> {
  try {
    const res = await fetch(`${WA_BASE_URL}/${credentials.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formatPhone(to),
        ...payload,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[WhatsApp] Send failed:', data.error);
      return { success: false, error: data.error?.message || 'Unknown error' };
    }

    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err) {
    console.error('[WhatsApp] Network error:', err);
    return { success: false, error: String(err) };
  }
}

// =============================================================================
// Template Message Builders
// =============================================================================

/**
 * Send booking confirmation template.
 * Template: booking_confirmation
 * Variables: customer_name, service_name, date_time, salon_name
 */
export function buildBookingConfirmation(
  customerName: string,
  serviceName: string,
  dateTime: string,
  salonName: string
) {
  return {
    type: 'template',
    template: {
      name: 'booking_confirmation',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: customerName },
            { type: 'text', text: serviceName },
            { type: 'text', text: dateTime },
            { type: 'text', text: salonName },
          ],
        },
      ] as TemplateComponent[],
    },
  };
}

/**
 * Send appointment reminder template.
 * Template: appointment_reminder
 * Variables: customer_name, service_name, date_time
 */
export function buildAppointmentReminder(
  customerName: string,
  serviceName: string,
  dateTime: string
) {
  return {
    type: 'template',
    template: {
      name: 'appointment_reminder',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: customerName },
            { type: 'text', text: serviceName },
            { type: 'text', text: dateTime },
          ],
        },
      ] as TemplateComponent[],
    },
  };
}

/**
 * Send renewal/win-back reminder template.
 * Template: renewal_reminder
 * Variables: customer_name, salon_name, days_since_visit
 */
export function buildRenewalReminder(
  customerName: string,
  salonName: string,
  daysSinceVisit: string
) {
  return {
    type: 'template',
    template: {
      name: 'renewal_reminder',
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: customerName },
            { type: 'text', text: salonName },
            { type: 'text', text: daysSinceVisit },
          ],
        },
      ] as TemplateComponent[],
    },
  };
}

/**
 * Send a generic broadcast template.
 * Template name is dynamic (passed as parameter).
 * Variables: array of string parameters.
 */
export function buildBroadcastTemplate(
  templateName: string,
  params: string[]
) {
  return {
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: params.map((text) => ({ type: 'text', text })),
        },
      ] as TemplateComponent[],
    },
  };
}

/**
 * Send a text message (within 24-hour customer service window only).
 */
export function buildTextMessage(text: string) {
  return {
    type: 'text',
    text: { body: text },
  };
}

/**
 * Send interactive button message (within 24-hour window).
 */
export function buildInteractiveButtons(
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
) {
  return {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format phone number to E.164 format for WhatsApp API.
 * Handles Indian numbers: removes +, spaces, leading 0.
 */
function formatPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Remove leading +
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  // If starts with 0, assume Indian number
  if (cleaned.startsWith('0')) {
    cleaned = '91' + cleaned.slice(1);
  }

  // If 10 digits, assume Indian number
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    cleaned = '91' + cleaned;
  }

  return cleaned;
}
