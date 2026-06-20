import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';
import { formatISTDate } from '@/lib/datetime';
import { planLabel, getBillingCycle, billingCycleLabel } from '@/lib/subscription';

export default async function AdminSubscriptionsPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: tenants } = await (admin
    .from('tenants' as any)
    .select('id, name, tenant_code, owner_name, phone, plan_tier, subscription_status, subscription_start, subscription_end, created_at, settings')
    .order('subscription_status')
    .order('created_at', { ascending: false }) as any);

  const statusGroups = {
    active: (tenants ?? []).filter((t: any) => t.subscription_status === 'active'),
    trial: (tenants ?? []).filter((t: any) => t.subscription_status === 'trial'),
    expired: (tenants ?? []).filter((t: any) => t.subscription_status === 'expired'),
    cancelled: (tenants ?? []).filter((t: any) => t.subscription_status === 'cancelled'),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor all tenant subscription statuses · dates in IST</p>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatusCard label="Active" count={statusGroups.active.length} color="text-emerald-500" />
        <StatusCard label="Trial" count={statusGroups.trial.length} color="text-amber-500" />
        <StatusCard label="Expired" count={statusGroups.expired.length} color="text-red-500" />
        <StatusCard label="Cancelled" count={statusGroups.cancelled.length} color="text-slate-500" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Salon</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Billing</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Start</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(tenants ?? []).map((t: any) => (
                <tr key={t.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.tenant_code}</td>
                  <td className="px-4 py-3 text-foreground font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-foreground/80">{t.owner_name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-foreground/80">{planLabel(t.plan_tier)}</td>
                  <td className="px-4 py-3 text-xs text-foreground/80">{billingCycleLabel(getBillingCycle(t.settings))}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      t.subscription_status === 'active' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                      t.subscription_status === 'trial' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                      t.subscription_status === 'expired' ? 'bg-red-500/15 text-red-600 dark:text-red-400' :
                      'bg-muted text-muted-foreground'
                    }`}>{t.subscription_status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatISTDate(t.subscription_start)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatISTDate(t.subscription_end)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{count}</p>
    </div>
  );
}
