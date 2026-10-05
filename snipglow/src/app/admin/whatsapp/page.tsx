import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';
import { formatISTDateTime } from '@/lib/datetime';
import Link from 'next/link';

// Account-level failure codes that block delivery for the whole number
// (vs. per-recipient issues). 131042 = billing/payment problem.
const BILLING_HINT = /131042|payment|billing|method was declined/i;

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

  // Recent delivery FAILURES — the actionable signal. A spike here (especially
  // a billing code) means messages are being accepted by Meta but withheld.
  const { data: recentFailuresData } = await (admin
    .from('whatsapp_sessions' as any)
    .select('id, tenant_id, phone, template_name, error_details, created_at')
    .eq('direction', 'outbound')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(20) as any);
  const recentFailures = (recentFailuresData as {
    id: string;
    tenant_id: string | null;
    phone: string;
    template_name: string | null;
    error_details: string | null;
    created_at: string;
  }[] | null) ?? [];

  // Recent messages (all directions/statuses)
  const { data: recentMessages } = await (admin
    .from('whatsapp_sessions' as any)
    .select('id, tenant_id, phone, direction, template_name, status, error_details, created_at')
    .order('created_at', { ascending: false })
    .limit(30) as any);

  // Resolve tenant names for everything we're about to render.
  const tenantNames = new Map<string, string>();
  const tenantIds = Array.from(
    new Set(
      [...recentFailures, ...((recentMessages as any[]) ?? [])]
        .map((r) => r.tenant_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  if (tenantIds.length > 0) {
    const { data: tenantsData } = await (admin
      .from('tenants' as any)
      .select('id, name')
      .in('id', tenantIds) as any);
    for (const t of (tenantsData as { id: string; name: string }[] | null) ?? []) {
      tenantNames.set(t.id, t.name);
    }
  }

  const sent = sentRes.count ?? 0;
  const failed = failedRes.count ?? 0;
  const failureRate = sent > 0 ? (failed / sent) * 100 : 0;
  const failureRateColor =
    failureRate >= 5 ? 'text-red-500' : failureRate >= 1 ? 'text-amber-500' : 'text-emerald-500';

  // Billing block = messages accepted but not delivered. Surface loud if seen
  // in recent failures so it's actioned before it silently eats a day of sends.
  const billingFailure = recentFailures.find((f) => BILLING_HINT.test(f.error_details || ''));

  const metrics = [
    { label: 'Total Sent', value: sent, color: 'text-blue-500' },
    { label: 'Delivered', value: deliveredRes.count ?? 0, color: 'text-emerald-500' },
    { label: 'Read', value: readRes.count ?? 0, color: 'text-green-500' },
    { label: 'Failed', value: failed, color: 'text-red-500' },
    { label: 'Inbound', value: inboundRes.count ?? 0, color: 'text-violet-500' },
    { label: 'Failure Rate', value: `${failureRate.toFixed(1)}%`, color: failureRateColor },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">WhatsApp Health</h1>
        <p className="text-sm text-muted-foreground mt-1">Message delivery stats across all tenants · times in IST</p>
      </div>

      {/* Billing block banner — accepted-but-not-delivered. Highest priority. */}
      {billingFailure && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none">🚨</span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                Billing block detected — messages are being accepted but not delivered
              </p>
              <p className="text-xs text-foreground/80">
                Meta is withholding delivery, likely due to an unpaid balance or a declined payment method.
                Clear the outstanding amount in Meta Business Manager → Billing &amp; Payments to restore delivery.
                Logs may still show messages as “sent”.
              </p>
              <p className="text-[11px] text-muted-foreground font-mono">
                Last signal: {billingFailure.error_details} · {formatISTDateTime(billingFailure.created_at)}
                {billingFailure.tenant_id ? ` · ${tenantNames.get(billingFailure.tenant_id) ?? billingFailure.tenant_id}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase">{m.label}</p>
            <p className={`text-2xl font-bold mt-1 ${m.color}`}>
              {typeof m.value === 'number' ? m.value.toLocaleString() : m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent delivery failures — the thing to act on */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent delivery failures</h2>
          {recentFailures.length > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-red-500 px-2 h-5 text-[11px] font-bold text-white">
              {recentFailures.length}
            </span>
          )}
        </div>
        {recentFailures.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No delivery failures 🎉
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Time (IST)</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Tenant</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Phone</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Template</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentFailures.map((f) => (
                  <tr key={f.id} className="hover:bg-accent/40">
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatISTDateTime(f.created_at)}</td>
                    <td className="px-4 py-2 text-xs text-foreground/80">
                      {f.tenant_id ? (
                        <Link href={`/admin/tenants/${f.tenant_id}`} className="hover:underline">
                          {tenantNames.get(f.tenant_id) ?? f.tenant_id}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-foreground/80 font-mono whitespace-nowrap">{f.phone}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{f.template_name || '—'}</td>
                    <td className="px-4 py-2 text-xs text-red-500 max-w-xs">{f.error_details || 'failed'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Error</th>
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
                  <td className="px-4 py-2 text-xs text-red-500/80 max-w-[16rem] truncate" title={m.error_details || ''}>
                    {m.error_details || '—'}
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
