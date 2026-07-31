import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, logAdminAction } from '@/lib/admin/auth';
import { IndianRupee, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { PaymentHistoryTable, type PaymentRow } from '../payment-history-table';

// =============================================================================
// Admin — consolidated subscription payment transactions across all tenants.
// =============================================================================

export default async function AdminPaymentsPage() {
  const user = await requireAdmin();
  const admin = createAdminClient();

  const { data: orders } = await (admin
    .from('payment_orders' as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300) as any);

  const list = (orders ?? []) as PaymentRow[];

  // Attach salon names for the consolidated view.
  const tenantIds = [...new Set(list.map((o) => o.tenant_id).filter(Boolean))];
  const nameMap: Record<string, { name: string; code: string | null }> = {};
  if (tenantIds.length > 0) {
    const { data: tenants } = await (admin
      .from('tenants' as any)
      .select('id, name, tenant_code')
      .in('id', tenantIds) as any);
    for (const t of (tenants ?? []) as any[]) {
      nameMap[t.id] = { name: t.name, code: t.tenant_code ?? null };
    }
  }
  const rows: PaymentRow[] = list.map((o) => ({
    ...o,
    salon_name: nameMap[o.tenant_id]?.name ?? null,
    tenant_code: nameMap[o.tenant_id]?.code ?? null,
  }));

  // Totals — only 'paid' counts as collected.
  const paid = rows.filter((r) => r.status === 'paid');
  const failed = rows.filter((r) => r.status === 'failed');
  const pending = rows.filter((r) => r.status === 'created');
  const collected = paid.reduce((s, r) => s + r.amount, 0) / 100;

  // This month's collection (IST).
  const istMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7);
  const monthCollected =
    paid
      .filter((r) => new Date(r.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).startsWith(istMonth))
      .reduce((s, r) => s + r.amount, 0) / 100;

  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'view_payments',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Subscription transactions across all salons · times in IST
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={<IndianRupee className="size-4" />}
          label="Total collected"
          value={`₹${collected.toLocaleString('en-IN')}`}
          sub={`${paid.length} payment${paid.length !== 1 ? 's' : ''}`}
          tone="emerald"
        />
        <SummaryCard
          icon={<IndianRupee className="size-4" />}
          label="This month"
          value={`₹${monthCollected.toLocaleString('en-IN')}`}
          sub="Collected in current month"
          tone="blue"
        />
        <SummaryCard
          icon={<XCircle className="size-4" />}
          label="Failed"
          value={String(failed.length)}
          sub="Payment attempts"
          tone="red"
        />
        <SummaryCard
          icon={<Clock className="size-4" />}
          label="Incomplete"
          value={String(pending.length)}
          sub="Started, not paid"
          tone="amber"
        />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Transactions</h2>
            <span className="text-xs text-muted-foreground">({rows.length})</span>
          </div>
        </div>
        <PaymentHistoryTable rows={rows} showTenant emptyText="No subscription payments recorded yet" />
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: 'emerald' | 'blue' | 'red' | 'amber';
}) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    red: 'bg-red-500/15 text-red-600 dark:text-red-400',
    amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className={`flex size-8 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</div>
      <p className="mt-2.5 text-xl font-bold text-foreground leading-tight">{value}</p>
      <p className="text-xs font-medium text-foreground/80 mt-0.5">{label}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
