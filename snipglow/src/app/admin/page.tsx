import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, logAdminAction } from '@/lib/admin/auth';
import { formatISTDate, todayIST } from '@/lib/datetime';

// =============================================================================
// Admin Overview — Platform metrics at a glance
// =============================================================================

export default async function AdminOverviewPage() {
  const user = await requireAdmin();
  const admin = createAdminClient();

  const today = todayIST();
  const istParts = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' }).split(',')[0].split('-');
  const monthStart = `${istParts[0]}-${istParts[1]}-01`;

  // Parallel queries for all metrics
  const [
    tenantsRes,
    activeRes,
    trialRes,
    expiredRes,
    cancelledRes,
    customersRes,
    appointmentsRes,
    todayApptsRes,
    monthApptsRes,
    whatsappSentRes,
    whatsappDeliveredRes,
    whatsappFailedRes,
  ] = await Promise.all([
    admin.from('tenants').select('id', { count: 'exact', head: true }),
    (admin.from('tenants').select('id', { count: 'exact', head: true }).eq('subscription_status', 'active') as any),
    (admin.from('tenants').select('id', { count: 'exact', head: true }).eq('subscription_status', 'trial') as any),
    (admin.from('tenants').select('id', { count: 'exact', head: true }).eq('subscription_status', 'expired') as any),
    (admin.from('tenants').select('id', { count: 'exact', head: true }).eq('subscription_status', 'cancelled') as any),
    admin.from('customers').select('id', { count: 'exact', head: true }),
    admin.from('appointments').select('id', { count: 'exact', head: true }),
    admin.from('appointments').select('id', { count: 'exact', head: true }).eq('appointment_date', today),
    admin.from('appointments').select('id', { count: 'exact', head: true }).gte('appointment_date', monthStart),
    (admin.from('whatsapp_sessions' as any).select('id', { count: 'exact', head: true }).eq('direction', 'outbound') as any),
    (admin.from('whatsapp_sessions' as any).select('id', { count: 'exact', head: true }).eq('direction', 'outbound').eq('status', 'delivered') as any),
    (admin.from('whatsapp_sessions' as any).select('id', { count: 'exact', head: true }).eq('direction', 'outbound').eq('status', 'failed') as any),
  ]);

  // Recent tenants
  const { data: recentTenants } = await (admin
    .from('tenants' as any)
    .select('id, name, tenant_code, subscription_status, created_at')
    .order('created_at', { ascending: false })
    .limit(5) as any);

  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'view_overview',
  });

  const metrics = [
    { label: 'Total Tenants', value: tenantsRes.count ?? 0, color: 'text-blue-500' },
    { label: 'Active', value: activeRes.count ?? 0, color: 'text-emerald-500' },
    { label: 'Trial', value: trialRes.count ?? 0, color: 'text-amber-500' },
    { label: 'Expired', value: expiredRes.count ?? 0, color: 'text-red-500' },
    { label: 'Cancelled', value: cancelledRes.count ?? 0, color: 'text-slate-500' },
    { label: 'Total Customers', value: customersRes.count ?? 0, color: 'text-violet-500' },
    { label: 'Total Appointments', value: appointmentsRes.count ?? 0, color: 'text-cyan-500' },
    { label: "Today's Appointments", value: todayApptsRes.count ?? 0, color: 'text-pink-500' },
    { label: 'This Month Appointments', value: monthApptsRes.count ?? 0, color: 'text-indigo-500' },
    { label: 'WhatsApp Sent', value: whatsappSentRes.count ?? 0, color: 'text-green-500' },
    { label: 'WhatsApp Delivered', value: whatsappDeliveredRes.count ?? 0, color: 'text-green-400' },
    { label: 'WhatsApp Failed', value: whatsappFailedRes.count ?? 0, color: 'text-red-400' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time metrics across all tenants · times in IST</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{m.label}</p>
            <p className={`text-2xl font-bold mt-1 ${m.color}`}>{m.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Recent Tenants */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Recent Tenants</h2>
        </div>
        <div className="divide-y divide-border">
          {(recentTenants ?? []).map((t: any) => (
            <div key={t.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.tenant_code} · {formatISTDate(t.created_at)}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                t.subscription_status === 'active' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                t.subscription_status === 'trial' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                'bg-red-500/15 text-red-600 dark:text-red-400'
              }`}>
                {t.subscription_status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
