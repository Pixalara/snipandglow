import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';

export default async function AdminSubscriptionsPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: tenants } = await (admin
    .from('tenants' as any)
    .select('id, name, tenant_code, owner_name, phone, plan_tier, subscription_status, subscription_start, subscription_end, created_at')
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
        <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
        <p className="text-sm text-slate-400 mt-1">Monitor all tenant subscription statuses</p>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatusCard label="Active" count={statusGroups.active.length} color="text-emerald-400" />
        <StatusCard label="Trial" count={statusGroups.trial.length} color="text-amber-400" />
        <StatusCard label="Expired" count={statusGroups.expired.length} color="text-red-400" />
        <StatusCard label="Cancelled" count={statusGroups.cancelled.length} color="text-slate-400" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Salon</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Owner</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Start</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(tenants ?? []).map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-800/20">
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{t.tenant_code}</td>
                  <td className="px-4 py-3 text-white font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-slate-300">{t.owner_name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-300">{t.plan_tier || 'starter'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      t.subscription_status === 'active' ? 'bg-emerald-900/30 text-emerald-400' :
                      t.subscription_status === 'trial' ? 'bg-amber-900/30 text-amber-400' :
                      t.subscription_status === 'expired' ? 'bg-red-900/30 text-red-400' :
                      'bg-slate-800 text-slate-400'
                    }`}>{t.subscription_status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{t.subscription_start ? new Date(t.subscription_start).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{t.subscription_end ? new Date(t.subscription_end).toLocaleDateString('en-IN') : '—'}</td>
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
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-xs text-slate-500 uppercase">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{count}</p>
    </div>
  );
}
