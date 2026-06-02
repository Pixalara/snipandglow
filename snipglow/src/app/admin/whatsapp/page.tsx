import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';
import { formatISTDateTime } from '@/lib/datetime';

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
    { label: 'Total Sent', value: sentRes.count ?? 0, color: 'text-blue-500' },
    { label: 'Delivered', value: deliveredRes.count ?? 0, color: 'text-emerald-500' },
    { label: 'Read', value: readRes.count ?? 0, color: 'text-green-500' },
    { label: 'Failed', value: failedRes.count ?? 0, color: 'text-red-500' },
    { label: 'Inbound', value: inboundRes.count ?? 0, color: 'text-violet-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">WhatsApp Health</h1>
        <p className="text-sm text-muted-foreground mt-1">Message delivery stats across all tenants · times in IST</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase">{m.label}</p>
            <p className={`text-2xl font-bold mt-1 ${m.color}`}>{(m.value).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Recent Messages */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Recent Messages</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Time (IST)</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Phone</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Direction</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Template</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(recentMessages ?? []).map((m: any) => (
                <tr key={m.id} className="hover:bg-accent/40">
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatISTDateTime(m.created_at)}</td>
                  <td className="px-4 py-2 text-xs text-foreground/80">{m.phone}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${m.direction === 'outbound' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-violet-500/15 text-violet-600 dark:text-violet-400'}`}>
                      {m.direction === 'outbound' ? '↑ sent' : '↓ received'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{m.template_name || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs ${m.status === 'delivered' || m.status === 'read' ? 'text-emerald-500' : m.status === 'failed' ? 'text-red-500' : 'text-muted-foreground'}`}>
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
