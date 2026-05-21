import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, logAdminAction } from '@/lib/admin/auth';

export default async function AdminCustomersPage() {
  const user = await requireAdmin();
  const admin = createAdminClient();

  const { data: customers } = await admin
    .from('customers')
    .select('id, name, phone, email, total_visits, total_spent, tenant_id, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  // Get tenant names
  const tenantIds = [...new Set((customers ?? []).map((c) => c.tenant_id))];
  const { data: tenants } = await (admin.from('tenants' as any).select('id, name, tenant_code').in('id', tenantIds) as any);
  const tenantMap: Record<string, { name: string; code: string }> = {};
  for (const t of tenants ?? []) tenantMap[t.id] = { name: t.name, code: t.tenant_code };

  await logAdminAction({ adminUserId: user.id, adminEmail: user.email || '', action: 'view_customers' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">All Customers</h1>
        <p className="text-sm text-slate-400 mt-1">{(customers ?? []).length} customers across all tenants</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Salon</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Visits</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Spent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(customers ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/20">
                  <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-slate-300">{c.phone}</td>
                  <td className="px-4 py-3 text-slate-400">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{tenantMap[c.tenant_id]?.code} — {tenantMap[c.tenant_id]?.name}</td>
                  <td className="px-4 py-3 text-slate-300">{c.total_visits || 0}</td>
                  <td className="px-4 py-3 text-slate-300">₹{(c.total_spent || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
