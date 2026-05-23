import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';

// =============================================================================
// Admin — Automation Logs (all tenants)
// =============================================================================

const statusColors: Record<string, string> = {
  sent: 'text-emerald-400',
  delivered: 'text-blue-400',
  read: 'text-blue-300',
  failed: 'text-red-400',
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
        <h1 className="text-2xl font-bold text-white">Automation Logs</h1>
        <p className="text-sm text-slate-400 mt-1">All WhatsApp activity across all tenants</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-500 uppercase">Sent</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{outboundCount}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-500 uppercase">Received</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{inboundCount}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-500 uppercase">Failed</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{failedCount}</p>
        </div>
      </div>

      {/* Logs table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Activity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Direction</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {(logs ?? []).map((log: any) => (
                <tr key={log.id} className="hover:bg-slate-800/20">
                  <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">
                    {tenantMap[log.tenant_id]?.code || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{log.phone || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-300 max-w-xs">{getDescription(log)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${log.direction === 'outbound' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/30 text-blue-400'}`}>
                      {log.direction === 'outbound' ? '↑ sent' : '↓ received'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs ${statusColors[log.status] || 'text-slate-400'}`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
              {(!logs || logs.length === 0) && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No logs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
