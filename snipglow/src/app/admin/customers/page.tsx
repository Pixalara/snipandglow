import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, logAdminAction } from '@/lib/admin/auth';
import { formatISTDate } from '@/lib/datetime';

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
        <h1 className="text-2xl font-bold text-foreground">All Customers</h1>
        <p className="text-sm text-muted-foreground mt-1">{(customers ?? []).length} customers across all tenants</p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Salon</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Visits</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Spent</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(customers ?? []).map((c) => (
                <tr key={c.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3 text-foreground font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-foreground/80">{c.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{tenantMap[c.tenant_id]?.code} — {tenantMap[c.tenant_id]?.name}</td>
                  <td className="px-4 py-3 text-foreground/80">{c.total_visits || 0}</td>
                  <td className="px-4 py-3 text-foreground/80">₹{(c.total_spent || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatISTDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
