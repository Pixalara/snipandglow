import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, logAdminAction } from '@/lib/admin/auth';
import { formatISTDate } from '@/lib/datetime';
import Link from 'next/link';

// =============================================================================
// Admin — WhatsApp Setup Requests queue
// Lists tenant requests for manual dedicated WhatsApp API setup (interim flow
// while Embedded Signup / Tech Provider approval is pending).
// =============================================================================

interface SetupRequest {
  id: string;
  tenant_id: string;
  contact_phone: string;
  contact_name: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  in_progress: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  completed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  cancelled: 'bg-slate-500/15 text-slate-500',
};

export default async function AdminWhatsAppSetupPage() {
  const user = await requireAdmin();
  const admin = createAdminClient();

  // Newest first; open requests (pending / in_progress) sort to the top.
  const { data: requestsData } = await (admin
    .from('whatsapp_setup_requests' as any)
    .select('id, tenant_id, contact_phone, contact_name, notes, status, created_at')
    .order('created_at', { ascending: false }) as any);

  const requests = (requestsData as SetupRequest[] | null) ?? [];

  // Resolve tenant names for the listed requests in one query.
  const tenantIds = Array.from(new Set(requests.map((r) => r.tenant_id)));
  const tenantNames = new Map<string, { name: string; code: string }>();
  if (tenantIds.length > 0) {
    const { data: tenants } = await (admin
      .from('tenants' as any)
      .select('id, name, tenant_code')
      .in('id', tenantIds) as any);
    for (const t of (tenants as { id: string; name: string; tenant_code: string }[] | null) ?? []) {
      tenantNames.set(t.id, { name: t.name, code: t.tenant_code });
    }
  }

  const openCount = requests.filter((r) => r.status === 'pending' || r.status === 'in_progress').length;

  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'view_whatsapp_setup_requests',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">WhatsApp Setup Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {openCount} open request{openCount === 1 ? '' : 's'} · manual dedicated WhatsApp onboarding queue
        </p>
      </div>

      {requests.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">No WhatsApp setup requests yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Salon', 'Requested Number', 'Contact', 'Status', 'Requested', 'Action'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((r) => {
                  const tenant = tenantNames.get(r.tenant_id);
                  return (
                    <tr key={r.id} className="hover:bg-accent/40">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{tenant?.name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{tenant?.code ?? r.tenant_id}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-foreground/80">{r.contact_phone}</td>
                      <td className="px-4 py-3 text-foreground/80">{r.contact_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[r.status] ?? STATUS_STYLES.cancelled}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatISTDate(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/tenants/${r.tenant_id}`}
                          className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          Activate →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
