import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AutomationLogsClient } from './automation-logs-client';

// =============================================================================
// Automation Logs Page — Shows all WhatsApp notification activity
// =============================================================================

export interface AutomationLogRow {
  id: string;
  phone: string;
  direction: 'inbound' | 'outbound';
  template_name: string | null;
  status: string;
  created_at: string;
  description: string;
}

export default async function AutomationLogsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) redirect('/onboarding');

  const admin = createAdminClient();

  // Fetch recent WhatsApp sessions for this tenant
  const { data: logs } = await (admin
    .from('whatsapp_sessions')
    .select('id, phone, direction, template_name, status, created_at, metadata')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100) as any);

  // Transform into human-readable descriptions
  const rows: AutomationLogRow[] = (logs ?? []).map((log: any) => ({
    id: log.id,
    phone: formatPhoneDisplay(log.phone),
    direction: log.direction,
    template_name: log.template_name,
    status: log.status,
    created_at: log.created_at,
    description: getDescription(log),
  }));

  return <AutomationLogsClient logs={rows} />;
}

/** Format phone for display */
function formatPhoneDisplay(phone: string): string {
  if (!phone) return '—';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return `+${cleaned}`;
}

/** Generate plain English description from log metadata */
function getDescription(log: any): string {
  const meta = log.metadata || {};
  const direction = log.direction;
  const template = log.template_name;
  const status = log.status;
  const customerName = meta.customer_name || '';
  const messageText = meta.message_text || '';
  const buttonReplyId = meta.button_reply_id || '';

  // Outbound messages
  if (direction === 'outbound') {
    switch (template) {
      case 'booking_confirmation':
        return `Sent booking confirmation to ${customerName || 'customer'}`;
      case 'appointment_reminder':
        return `Sent appointment reminder to ${customerName || 'customer'}`;
      case 'renewal_reminder':
        return `Sent renewal reminder to ${customerName || 'customer'}`;
      case 'feedback_request':
        return `Sent feedback request to ${customerName || 'customer'}`;
      case 'welcome_menu':
        return `Sent welcome menu to ${customerName || 'customer'}`;
      case 'otp_verification':
        return `Sent OTP verification code`;
      default:
        if (template) return `Sent "${template}" message`;
        return `Sent WhatsApp message`;
    }
  }

  // Inbound messages
  if (direction === 'inbound') {
    if (buttonReplyId) {
      switch (buttonReplyId) {
        case 'book_appointment':
          return `${customerName || 'Customer'} tapped "Book Appointment"`;
        case 'services_prices':
          return `${customerName || 'Customer'} tapped "View Services"`;
        case 'talk_to_salon':
          return `${customerName || 'Customer'} tapped "Talk to Salon"`;
        case 'reschedule_appointment':
          return `${customerName || 'Customer'} tapped "Reschedule"`;
        case 'cancel_appointment':
          return `${customerName || 'Customer'} tapped "Cancel"`;
        case 'keep_appointment':
          return `${customerName || 'Customer'} chose to keep appointment`;
        case 'feedback_5':
          return `${customerName || 'Customer'} rated ⭐⭐⭐⭐⭐ (Loved it!)`;
        case 'feedback_3':
          return `${customerName || 'Customer'} rated ⭐⭐⭐ (It was okay)`;
        case 'feedback_1':
          return `${customerName || 'Customer'} rated 😞 (Not satisfied)`;
        default:
          if (buttonReplyId.startsWith('confirm_cancel_'))
            return `${customerName || 'Customer'} confirmed cancellation`;
          if (buttonReplyId.startsWith('resched.'))
            return `${customerName || 'Customer'} selected reschedule date`;
          if (buttonReplyId.startsWith('reschedtime.'))
            return `${customerName || 'Customer'} selected reschedule time`;
          return `${customerName || 'Customer'} tapped "${buttonReplyId}"`;
      }
    }

    if (messageText) {
      const upper = messageText.trim().toUpperCase();
      if (upper.startsWith('BOOK_'))
        return `${customerName || 'Customer'} scanned QR code to book`;
      return `${customerName || 'Customer'} sent: "${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}"`;
    }

    return `Received message from ${customerName || 'customer'}`;
  }

  return 'WhatsApp activity';
}
