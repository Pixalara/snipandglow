import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';

export default async function AdminWhatsAppPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [sentRes, deliveredRes, readRes, failedRes, inboundRes] = await Promise.all([
    (admin.from('whatsapp_sessions' as any).select('id', { count: 'exact', head: true }).eq('direction', 'outbound') as any),
    (admin.from('whatsapp_sessions' as any).select('id', { count: 'exact', head: true }).eq('direction', 'outbound').eq('status', 'delivered') as any),
    (admin.from('whatsapp_sessions' as any).select('id', { count: 'exact', head: true }).eq('direction', 'outbound').eq('status', 'read') as any),
    (admin.from('whatsapp_sessions' as any).select('id', { count: 'exact', head: true }).eq('direction', 'outbound').eq('status', 'failed') as any),
    (admin.from('whatsapp_sessions' as any).select('id', { count: 'exact', head: true }).eq('direction', 'inbound') as any),
  ]);

  // Recent messages
  const { data: recentMessages } = await (admin
    .from('whatsapp_sessions' as any)
    .select('id, phone, direction, template_name, status, created_at, metadata')
    .order('created_at', { ascending: false })
    .limit(30) as any);

  const metrics = [
    { label: 'Total Sent', value: sentRes.count ?? 0, color: 'text-blue-400' },
    { label: 'Delivered', value: deliveredRes.count ?? 0, color: 'text-emerald-400' },
    { label: 'Read', value: readRes.count ?? 0, color: 'text-green-300' },
    { label: 'Failed', value: failedRes.count ?? 0, color: 'text-red-400' },
    { label: 'Inbound', value: inboundRes.count ?? 0, color: 'text-violet-400' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">WhatsApp Health</h1>
        <p className="text-sm text-slate-400 mt-1">Message delivery stats across all tenants</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-xs text-slate-500 uppercase">{m.label}</p>
            <p className={`text-2xl font-bold mt-1 ${m.color}`}>{(m.value).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Recent Messages */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">Recent Messages</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Time</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Phone</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Direction</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Template</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {(recentMessages ?? []).map((m: any) => (
                <tr key={m.id} className="hover:bg-slate-800/20">
                  <td className="px-4 py-2 text-xs text-slate-400">{new Date(m.created_at).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 text-xs text-slate-300">{m.phone}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${m.direction === 'outbound' ? 'bg-blue-900/30 text-blue-400' : 'bg-violet-900/30 text-violet-400'}`}>
                      {m.direction === 'outbound' ? '↑ sent' : '↓ received'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-400">{m.template_name || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs ${m.status === 'delivered' || m.status === 'read' ? 'text-emerald-400' : m.status === 'failed' ? 'text-red-400' : 'text-slate-400'}`}>
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
