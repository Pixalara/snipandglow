import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';
import { WHATSAPP_RATES_INR, getTemplateCategory, type TemplateCategory } from '@/lib/whatsapp/pricing';
import { CostFilter } from './cost-filter';

// =============================================================================
// Admin — WhatsApp Cost Report
// Per-tenant Meta charges · India pricing effective April 1, 2026
// Marketing: ₹0.8631 | Utility: ₹0.1150 | Authentication: ₹0.1150
// =============================================================================

function formatINRRounded(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

function getDefaultRange() {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const to = now.toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' }).split(',')[0];
  return { from, to };
}

export default async function WhatsAppCostsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const defaults = getDefaultRange();
  const fromDate = params.from || defaults.from;
  const toDate = params.to || defaults.to;
  const preset = params.preset || 'month';

  // Build date range label
  const fromLabel = new Date(fromDate + 'T12:00:00+05:30').toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
  const toLabel = new Date(toDate + 'T12:00:00+05:30').toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
  const rangeLabel = fromDate === toDate ? fromLabel : `${fromLabel} – ${toLabel}`;

  const admin = createAdminClient();

  // Fetch tenants
  const { data: tenants } = await (admin.from('tenants' as any).select('id, name') as any);
  const tenantMap: Record<string, string> = {};
  for (const t of tenants ?? []) tenantMap[t.id] = t.name;

  // Fetch messages in selected range (end of day)
  const fromISO = `${fromDate}T00:00:00+05:30`;
  const toISO = `${toDate}T23:59:59+05:30`;

  const { data: msgs } = await (admin
    .from('whatsapp_sessions' as any)
    .select('tenant_id, direction, template_name, template_category')
    .gte('created_at', fromISO)
    .lte('created_at', toISO)
    .eq('direction', 'outbound') as any);

  // Calculate per-tenant costs
  const byTenant: Record<string, {
    total: number;
    byCategory: Record<string, { count: number; cost: number }>;
  }> = {};

  for (const msg of msgs ?? []) {
    const tid = msg.tenant_id;
    if (!byTenant[tid]) byTenant[tid] = { total: 0, byCategory: {} };
    // Derive category from the template name (authoritative + handles historical
    // rows where template_category was never stored). Fall back to the stored
    // column only if present and the name yields nothing useful.
    const derived = getTemplateCategory(msg.template_name ?? null, 'outbound');
    const cat = (derived || msg.template_category || 'utility') as TemplateCategory;
    const rate = WHATSAPP_RATES_INR[cat] ?? WHATSAPP_RATES_INR.utility;
    if (!byTenant[tid].byCategory[cat]) byTenant[tid].byCategory[cat] = { count: 0, cost: 0 };
    byTenant[tid].byCategory[cat].count++;
    byTenant[tid].byCategory[cat].cost += rate;
    byTenant[tid].total += rate;
  }

  const sortedTenants = Object.entries(byTenant).sort(([, a], [, b]) => b.total - a.total);
  const totalCost = Object.values(byTenant).reduce((s, t) => s + t.total, 0);
  const totalMsgs = (msgs ?? []).length;
  const avgPerSalon = sortedTenants.length > 0 ? totalCost / sortedTenants.length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">WhatsApp Cost Report</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Per-tenant Meta charges · India pricing effective April 1, 2026 · dates in IST
        </p>
      </div>

      {/* Filter */}
      <CostFilter currentFrom={fromDate} currentTo={toDate} currentPreset={preset} />

      {/* Rate card */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Meta India Rates (per message)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Marketing', rate: WHATSAPP_RATES_INR.marketing, color: 'text-orange-500' },
            { label: 'Utility', rate: WHATSAPP_RATES_INR.utility, color: 'text-blue-500' },
            { label: 'Authentication', rate: WHATSAPP_RATES_INR.authentication, color: 'text-violet-500' },
            { label: 'Auth-International', rate: WHATSAPP_RATES_INR.authentication_intl, color: 'text-pink-500' },
          ].map(({ label, rate, color }) => (
            <div key={label} className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-lg font-bold mt-1 ${color}`}>₹{rate}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase truncate">{rangeLabel}</p>
          <p className="text-2xl font-bold text-emerald-500 mt-1">{formatINRRounded(totalCost)}</p>
          <p className="text-xs text-muted-foreground mt-1">{totalMsgs} messages</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase">Salons Active</p>
          <p className="text-2xl font-bold text-blue-500 mt-1">{sortedTenants.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase">Avg per Salon</p>
          <p className="text-2xl font-bold text-violet-500 mt-1">{formatINRRounded(avgPerSalon)}</p>
        </div>
      </div>

      {/* Per-tenant breakdown */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Per-Tenant Breakdown</h2>
          <span className="text-xs text-muted-foreground">{rangeLabel}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Salon</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-orange-500">Marketing</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-blue-500">Utility</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-violet-500">Auth</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Total Msgs</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No messages sent in this period
                  </td>
                </tr>
              ) : (
                sortedTenants.map(([tenantId, data]) => {
                  const totalMsgsTenant = Object.values(data.byCategory).reduce((s, c) => s + c.count, 0);
                  const marketingCost = data.byCategory.marketing?.cost ?? 0;
                  const utilityCost = data.byCategory.utility?.cost ?? 0;
                  const authCost = (data.byCategory.authentication?.cost ?? 0) + (data.byCategory.authentication_intl?.cost ?? 0);
                  const pct = totalCost > 0 ? (data.total / totalCost * 100).toFixed(1) : '0';

                  return (
                    <tr key={tenantId} className="hover:bg-accent/40">
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground font-medium">{tenantMap[tenantId] || tenantId.slice(0, 8)}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{pct}% of total</p>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-orange-500">
                        {marketingCost > 0 ? (
                          <><span className="text-muted-foreground">{data.byCategory.marketing?.count ?? 0}×</span><br />{formatINRRounded(marketingCost)}</>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-blue-500">
                        {utilityCost > 0 ? (
                          <><span className="text-muted-foreground">{data.byCategory.utility?.count ?? 0}×</span><br />{formatINRRounded(utilityCost)}</>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-violet-500">
                        {authCost > 0 ? (
                          <><span className="text-muted-foreground">{(data.byCategory.authentication?.count ?? 0) + (data.byCategory.authentication_intl?.count ?? 0)}×</span><br />{formatINRRounded(authCost)}</>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-foreground/80 font-medium">{totalMsgsTenant}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-bold text-emerald-500">{formatINRRounded(data.total)}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {sortedTenants.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td className="px-4 py-3 text-xs font-bold text-foreground/80">TOTAL</td>
                  <td colSpan={4} />
                  <td className="px-4 py-3 text-right text-base font-bold text-emerald-500">
                    {formatINRRounded(totalCost)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Note */}
      <div className="rounded-xl border border-border bg-card/50 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="text-foreground/80 font-medium">Note:</span> Costs are estimated based on template category.
          Actual Meta billing may vary. Inbound messages are free.
          Rates: Marketing ₹{WHATSAPP_RATES_INR.marketing} · Utility ₹{WHATSAPP_RATES_INR.utility} · Auth ₹{WHATSAPP_RATES_INR.authentication} · Auth-Intl ₹{WHATSAPP_RATES_INR.authentication_intl}
        </p>
      </div>
    </div>
  );
}
