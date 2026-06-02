import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';
import { formatISTShort } from '@/lib/datetime';

// =============================================================================
// Admin — Automation Logs (all tenants)
// =============================================================================

const statusColors: Record<string, string> = {
  sent: 'text-emerald-500',
  delivered: 'text-blue-500',
  read: 'text-blue-400',
  failed: 'text-red-500',
};

function getDescription(log: any): string {
  const meta = log.metadata || {};
  const direction = log.direction;
  const template = log.template_name;
  const customerName = meta.customer_name || '';
  const messageText = meta.message_text || '';
  const buttonReplyId = meta.button_reply_id || '';

  if (direction === 'outbound') {
    switch (template) {
      case 'booking_confirmation': return `Booking confirmation → ${customerName || 'customer'}`;
      case 'booking_confirmation_v2': return `Booking confirmed (with calendar) → ${customerName || 'customer'}`;
      case 'appointment_rescheduled_v1': return `Reschedule confirmation → ${customerName || 'customer'}`;
      case 'appointment_reminder': return `Appointment reminder → ${customerName || 'customer'}`;
      case 'bill_receipt': return `Bill receipt → ${customerName || 'customer'}`;
      case 'feedback_request': return `Feedback request → ${customerName || 'customer'}`;
      case 'appointment_cancelled': return `Cancellation notice → ${customerName || 'customer'}`;
      case 'appointment_rescheduled': return `Reschedule notice → ${customerName || 'customer'}`;
      case 'otp_verification': return `OTP verification code sent`;
      default:
        if (template?.startsWith('reminder_24h_')) return `24h reminder → ${customerName || 'customer'}`;
        if (template?.startsWith('reminder_3h_')) return `3h reminder → ${customerName || 'customer'}`;
        if (template) return `Sent "${template}" → ${customerName || 'customer'}`;
        return `Sent WhatsApp message`;
    }
  }

  if (direction === 'inbound') {
    if (buttonReplyId) {
      const map: Record<string, string> = {
        'book_appointment': 'tapped "Book Appointment"',
        'services_prices': 'tapped "View Services"',
        'reschedule_appointment': 'tapped "Reschedule"',
        'cancel_appointment': 'tapped "Cancel"',
        'feedback_5': 'rated ⭐⭐⭐⭐⭐',
        'feedback_4': 'rated ⭐⭐⭐⭐',
        'feedback_3': 'rated ⭐⭐⭐',
        'feedback_2': 'rated ⭐⭐',
        'feedback_1': 'rated ⭐',
        'google_review_yes': 'agreed to Google review',
        'google_review_no': 'declined Google review',
      };
      const action = map[buttonReplyId] || `tapped "${buttonReplyId}"`;
      return `${customerName || 'Customer'} ${action}`;
    }
    if (messageText) {
      if (messageText.toUpperCase().startsWith('BOOK_') || /\[SNG[-]?\d+\]/i.test(messageText)) {
        return `${customerName || 'Customer'} scanned QR code`;
      }
      return `${customerName || 'Customer'} sent: "${messageText.substring(0, 40)}${messageText.length > 40 ? '...' : ''}"`;
    }
    return `Received message from ${customerName || 'customer'}`;
  }

  return 'WhatsApp activity';
}

export default async function AdminAutomationLogsPage() {
  await requireAdmin();
  const admin = createAdminClient();

  // Get tenant names for display
  const { data: tenants } = await (admin.from('tenants' as any).select('id, name, tenant_code') as any);
  const tenantMap: Record<string, { name: string; code: string }> = {};
  for (const t of tenants ?? []) tenantMap[t.id] = { name: t.name, code: t.tenant_code };

  // Fetch recent logs across all tenants
  const { data: logs } = await (admin
    .from('whatsapp_sessions' as any)
    .select('id, tenant_id, phone, direction, template_name, status, created_at, metadata')
    .order('created_at', { ascending: false })
    .limit(200) as any);

  const outboundCount = (logs ?? []).filter((l: any) => l.direction === 'outbound').length;
  const inboundCount = (logs ?? []).filter((l: any) => l.direction === 'inbound').length;
  const failedCount = (logs ?? []).filter((l: any) => l.status === 'failed').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Automation Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">All WhatsApp activity across all tenants · times in IST</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase">Sent</p>
          <p className="text-2xl font-bold text-emerald-500 mt-1">{outboundCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase">Received</p>
          <p className="text-2xl font-bold text-blue-500 mt-1">{inboundCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase">Failed</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{failedCount}</p>
        </div>
      </div>

      {/* Logs table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Time (IST)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Activity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Direction</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(logs ?? []).map((log: any) => (
                <tr key={log.id} className="hover:bg-accent/40">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {formatISTShort(log.created_at)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {tenantMap[log.tenant_id]?.code || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{log.phone || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-foreground/80 max-w-xs">{getDescription(log)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${log.direction === 'outbound' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'}`}>
                      {log.direction === 'outbound' ? '↑ sent' : '↓ received'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs ${statusColors[log.status] || 'text-muted-foreground'}`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
              {(!logs || logs.length === 0) && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No logs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
