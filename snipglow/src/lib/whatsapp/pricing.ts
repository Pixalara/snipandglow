// =============================================================================
// WhatsApp Business Platform — India Pricing
// Effective: April 1, 2026
// Source: Meta WhatsApp Business Platform pricing page
// Currency: INR
// =============================================================================

export const WHATSAPP_RATES_INR = {
  marketing: 0.8631,
  utility: 0.1150,
  authentication: 0.1150,
  authentication_intl: 2.4971,
  service: 0.0000,   // inbound messages are free
  unknown: 0.1150,   // default to utility rate
} as const;

export type TemplateCategory = keyof typeof WHATSAPP_RATES_INR;

/**
 * Map template name to its Meta billing category.
 * Marketing = promotional, win-back, broadcast
 * Utility = transactional (booking, reminder, receipt, feedback)
 * Authentication = OTP
 * Service = inbound (free)
 */
export const TEMPLATE_CATEGORY_MAP: Record<string, TemplateCategory> = {
  // Marketing templates
  renewal_reminder: 'marketing',
  winback_60_day: 'marketing',

  // Authentication templates
  otp_verification: 'authentication',

  // Utility templates (transactional)
  booking_confirmation_v2: 'utility',
  appointment_rescheduled_v1: 'utility',
  appointment_reminder_v1: 'utility',
  bill_receipt_v1: 'utility',
  feedback_request_v1: 'utility',
  owner_booking_alert: 'utility',
  owner_reschedule_alert: 'utility',
  owner_cancel_alert: 'utility',
  owner_feedback_alert: 'utility',
  service_reminder_30d: 'utility',
  service_reminder_60d: 'utility',
};

/**
 * Get the billing category for a template name.
 */
export function getTemplateCategory(templateName: string | null, direction: 'inbound' | 'outbound'): TemplateCategory {
  if (direction === 'inbound') return 'service';
  if (!templateName) return 'utility';
  return TEMPLATE_CATEGORY_MAP[templateName] ?? 'utility';
}

/**
 * Calculate cost for a single message in INR.
 */
export function calculateMessageCost(category: TemplateCategory): number {
  return WHATSAPP_RATES_INR[category] ?? WHATSAPP_RATES_INR.utility;
}

/**
 * Calculate total cost for a batch of messages.
 */
export function calculateBatchCost(messages: Array<{ template_category: string; direction: string }>): number {
  return messages.reduce((total, msg) => {
    if (msg.direction === 'inbound') return total;
    const rate = WHATSAPP_RATES_INR[msg.template_category as TemplateCategory] ?? WHATSAPP_RATES_INR.utility;
    return total + rate;
  }, 0);
}
