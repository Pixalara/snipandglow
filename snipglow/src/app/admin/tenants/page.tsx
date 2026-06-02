import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, logAdminAction } from '@/lib/admin/auth';
import { formatISTDate } from '@/lib/datetime';
import Link from 'next/link';

// =============================================================================
// Admin — Tenant Management
// =============================================================================

export default async function AdminTenantsPage() {
  const user = await requireAdmin();
  const admin = createAdminClient();

  // Fetch all tenants with stats
  const { data: tenants } = await (admin
    .from('tenants' as any)
    .select('id, name, tenant_code, owner_name, phone, plan_tier, subscription_status, created_at')
    .order('created_at', { ascending: false }) as any);

  // Get counts per tenant
  const tenantIds = (tenants ?? []).map((t: any) => t.id);
  let customerCounts: Record<string, number> = {};
  let appointmentCounts: Record<string, number> = {};
  let serviceCounts: Record<string, number> = {};
  let staffCounts: Record<string, number> = {};

  if (tenantIds.length > 0) {
    const [custRes, apptRes, svcRes, empRes] = await Promise.all([
      admin.from('customers').select('tenant_id').in('tenant_id', tenantIds),
      admin.from('appointments').select('tenant_id').in('tenant_id', tenantIds),
      admin.from('services').select('tenant_id').in('tenant_id', tenantIds).eq('is_active', true),
      admin.from('employees').select('tenant_id').in('tenant_id', tenantIds).eq('is_active', true),
    ]);

    for (const c of custRes.data ?? []) customerCounts[c.tenant_id] = (customerCounts[c.tenant_id] || 0) + 1;
    for (const a of apptRes.data ?? []) appointmentCounts[a.tenant_id] = (appointmentCounts[a.tenant_id] || 0) + 1;
    for (const s of svcRes.data ?? []) serviceCounts[s.tenant_id] = (serviceCounts[s.tenant_id] || 0) + 1;
    for (const e of empRes.data ?? []) staffCounts[e.tenant_id] = (staffCounts[e.tenant_id] || 0) + 1;
  }

  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'view_tenants',
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tenants</h1>
          <p className="text-sm text-muted-foreground mt-1">{(tenants ?? []).length} registered salons</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Code</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Salon</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Owner</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Phone</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Plan</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Customers</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Appts</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Services</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Staff</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Joined</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(tenants ?? []).map((t: any) => (
                <tr key={t.id} className="hover:bg-accent/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.tenant_code}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{t.name}</td>
                  <td className="px-4 py-3 text-foreground/80">{t.owner_name || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-muted text-foreground/80">{t.plan_tier || 'starter'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      t.subscription_status === 'active' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                      t.subscription_status === 'trial' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                      t.subscription_status === 'expired' ? 'bg-red-500/15 text-red-600 dark:text-red-400' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {t.subscription_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground/80">{customerCounts[t.id] || 0}</td>
                  <td className="px-4 py-3 text-foreground/80">{appointmentCounts[t.id] || 0}</td>
                  <td className="px-4 py-3 text-foreground/80">{serviceCounts[t.id] || 0}</td>
                  <td className="px-4 py-3 text-foreground/80">{staffCounts[t.id] || 0}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatISTDate(t.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/tenants/${t.id}`} className="text-xs text-blue-500 hover:text-blue-400 font-medium">
                      View
                    </Link>
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
