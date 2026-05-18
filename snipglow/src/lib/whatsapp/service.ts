'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformCredentials } from './config';
import {
  sendMessage,
  buildBookingConfirmation,
  buildAppointmentReminder,
  buildRenewalReminder,
  buildBroadcastTemplate,
  buildTextMessage,
  buildInteractiveButtons,
} from './templates';
import type { SendResult } from './templates';

// =============================================================================
// WhatsApp Service — High-level functions for salon operations
// Multi-tenant: uses platform credentials or tenant-specific credentials
// =============================================================================

/**
 * Get credentials for a tenant. Falls back to platform credentials.
 * In future, tenants who connect their own number will have credentials stored in DB.
 */
async function getCredentialsForTenant(tenantId: string) {
  // TODO: Check if tenant has their own WhatsApp credentials in DB
  // const admin = createAdminClient();
  // const { data } = await admin.from('tenant_whatsapp_config').select('*').eq('tenant_id', tenantId).single();
  // if (data) return { accessToken: decrypt(data.access_token), phoneNumberId: data.phone_number_id, businessAccountId: data.business_account_id };

  // Fall back to platform credentials
  return getPlatformCredentials();
}

// =============================================================================
// Appointment Messages
// =============================================================================

/**
 * Send booking confirmation to customer after appointment is created.
 */
export async function sendBookingConfirmation(
  tenantId: string,
  customerPhone: string,
  customerName: string,
  serviceName: string,
  dateTime: string,
  salonName: string
): Promise<SendResult> {
  const credentials = await getCredentialsForTenant(tenantId);
  if (!credentials) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  const payload = buildBookingConfirmation(customerName, serviceName, dateTime, salonName);
  const result = await sendMessage(credentials, customerPhone, payload);

  // Log the message
  await logOutboundMessage(tenantId, customerPhone, 'booking_confirmation', result);

  return result;
}

/**
 * Send appointment reminder (24 hours before).
 */
export async function sendAppointmentReminder(
  tenantId: string,
  customerPhone: string,
  customerName: string,
  serviceName: string,
  dateTime: string
): Promise<SendResult> {
  const credentials = await getCredentialsForTenant(tenantId);
  if (!credentials) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  const payload = buildAppointmentReminder(customerName, serviceName, dateTime);
  const result = await sendMessage(credentials, customerPhone, payload);

  await logOutboundMessage(tenantId, customerPhone, 'appointment_reminder', result);

  return result;
}

/**
 * Send renewal/win-back reminder (30 or 60 days after last visit).
 */
export async function sendRenewalReminder(
  tenantId: string,
  customerPhone: string,
  customerName: string,
  salonName: string,
  daysSinceVisit: number
): Promise<SendResult> {
  const credentials = await getCredentialsForTenant(tenantId);
  if (!credentials) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  const payload = buildRenewalReminder(customerName, salonName, String(daysSinceVisit));
  const result = await sendMessage(credentials, customerPhone, payload);

  await logOutboundMessage(tenantId, customerPhone, 'renewal_reminder', result);

  return result;
}

// =============================================================================
// Broadcast Messages
// =============================================================================

/**
 * Send a broadcast template message to multiple customers.
 * Returns results for each recipient.
 */
export async function sendBroadcast(
  tenantId: string,
  templateName: string,
  recipients: Array<{ phone: string; params: string[] }>
): Promise<{ sent: number; failed: number; results: SendResult[] }> {
  const credentials = await getCredentialsForTenant(tenantId);
  if (!credentials) {
    return { sent: 0, failed: recipients.length, results: [{ success: false, error: 'WhatsApp not configured' }] };
  }

  const results: SendResult[] = [];
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const payload = buildBroadcastTemplate(templateName, recipient.params);
    const result = await sendMessage(credentials, recipient.phone, payload);

    if (result.success) {
      sent++;
    } else {
      failed++;
    }
    results.push(result);

    await logOutboundMessage(tenantId, recipient.phone, templateName, result);

    // Rate limiting: Meta allows ~80 messages/second for business accounts
    // Add small delay to be safe
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return { sent, failed, results };
}

// =============================================================================
// Interactive Messages (within 24-hour window)
// =============================================================================

/**
 * Send welcome menu with interactive buttons.
 * Only works within 24-hour customer service window.
 */
export async function sendWelcomeMenu(
  tenantId: string,
  customerPhone: string,
  salonName: string
): Promise<SendResult> {
  const credentials = await getCredentialsForTenant(tenantId);
  if (!credentials) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  const payload = buildInteractiveButtons(
    `👋 Welcome to ${salonName}! How can we help you today?`,
    [
      { id: 'book_appointment', title: '💇 Book Appointment' },
      { id: 'my_appointments', title: '📋 My Appointments' },
      { id: 'contact_us', title: '📞 Contact Us' },
    ]
  );

  const result = await sendMessage(credentials, customerPhone, payload);
  await logOutboundMessage(tenantId, customerPhone, 'welcome_menu', result);

  return result;
}

/**
 * Send feedback request after appointment completion.
 */
export async function sendFeedbackRequest(
  tenantId: string,
  customerPhone: string,
  customerName: string,
  salonName: string
): Promise<SendResult> {
  const credentials = await getCredentialsForTenant(tenantId);
  if (!credentials) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  const payload = buildInteractiveButtons(
    `⭐ Hi ${customerName}! How was your visit to ${salonName} today?\n\nTap to rate your experience:`,
    [
      { id: 'rating_5', title: '⭐⭐⭐⭐⭐ Loved it!' },
      { id: 'rating_3', title: '⭐⭐⭐ It was okay' },
      { id: 'rating_1', title: '😞 Not satisfied' },
    ]
  );

  const result = await sendMessage(credentials, customerPhone, payload);
  await logOutboundMessage(tenantId, customerPhone, 'feedback_request', result);

  return result;
}

// =============================================================================
// Logging
// =============================================================================

/**
 * Log outbound message to whatsapp_sessions table.
 */
async function logOutboundMessage(
  tenantId: string,
  phone: string,
  templateName: string,
  result: SendResult
) {
  try {
    const admin = createAdminClient();
    await admin
      .from('whatsapp_sessions')
      .insert({
        tenant_id: tenantId,
        message_id: result.messageId || `failed_${Date.now()}`,
        phone,
        direction: 'outbound',
        template_name: templateName,
        status: result.success ? 'sent' : 'failed',
        error_details: result.error || null,
        metadata: {},
      } as any);
  } catch (err) {
    console.error('[WhatsApp] Failed to log message:', err);
  }
}
