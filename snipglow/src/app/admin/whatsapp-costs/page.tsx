import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';
import { WHATSAPP_RATES_INR, type TemplateCategory } from '@/lib/whatsapp/pricing';

// =============================================================================
// Admin — WhatsApp Cost Report
// Per-tenant Meta charges based on India pricing (effective April 1, 2026)
// Marketing: ₹0.8631 | Utility: ₹0.1150 | Authentication: ₹0.1150
// =============================================================================

const CATEGORY_COLORS: Record<string, string> = {
  marketing: 'text-orange-400',
  utility: 'text-blue-400',
  authentication: 'text-violet-400',
  authentication_intl: 'text-pink-400',
  service: 'text-slate-500',
  unknown: 'text-slate-400',
};

const CATEGORY_LABELS: Record<string, string> = {
  marketing: 'Marketing',
  utility: 'Utility',
  authentication: 'Auth',
  authentication_intl: 'Auth-Intl',
  service: 'Service (free)',
  unknown: 'Unknown',
};

function formatINR(amount: number): string {
  return `₹${amount.toFixed(4)}`;
}

function formatINRRounded(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

export default async function WhatsAppCostsPage() {
  await requireAdmin();
  const admin = createAdminClient();

  // Get current month range
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  // Fetch all tenants
  const { data: tenants } = await (admin.from('tenants' as any).select('id, name') as any);
  const tenantMap: Record<string, string> = {};
  for (const t of tenants ?? []) tenantMap[t.id] = t.name;

  // Fetch this month's messages with category
  const { data: thisMonthMsgs } = await (admin
    .from('whatsapp_sessions' as any)
    .select('tenant_id, direction, template_name, template_category')
    .gte('created_at', monthStart)
    .eq('direction', 'outbound') as any);

  // Fetch last month's messages
  const { data: lastMonthMsgs } = await (admin
    .from('whatsapp_sessions' as any)
    .select('tenant_id, direction, template_name, template_category')
    .gte('created_at', lastMonthStart)
    .lte('created_at', lastMonthEnd)
    .eq('direction', 'outbound') as any);

  // Calculate per-tenant costs
  function calcCosts(msgs: any[]) {
    const byTenant: Record<string, {
      total: number;
      byCategory: Record<string, { count: number; cost: number }>;
    }> = {};

    for (const msg of msgs ?? []) {
      const tid = msg.tenant_id;
      if (!byTenant[tid]) byTenant[tid] = { total: 0, byCategory: {} };

      const cat = (msg.template_category || 'utility') as TemplateCategory;
      const rate = WHATSAPP_RATES_INR[cat] ?? WHATSAPP_RATES_INR.utility;

      if (!byTenant[tid].byCategory[cat]) {
        byTenant[tid].byCategory[cat] = { count: 0, cost: 0 };
      }
      byTenant[tid].byCategory[cat].count++;
      byTenant[tid].byCategory[cat].cost += rate;
      byTenant[tid].total += rate;
    }

    return byTenant;
  }

  const thisMonth = calcCosts(thisMonthMsgs ?? []);
  const lastMonth = calcCosts(lastMonthMsgs ?? []);

  const totalThisMonth = Object.values(thisMonth).reduce((s, t) => s + t.total, 0);
  const totalLastMonth = Object.values(lastMonth).reduce((s, t) => s + t.total, 0);
  const totalMsgsThisMonth = (thisMonthMsgs ?? []).length;

  // Sort tenants by cost descending
  const sortedTenants = Object.entries(thisMonth)
    .sort(([, a], [, b]) => b.total - a.total);

  const monthLabel = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const lastMonthLabel = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">WhatsApp Cost Report</h1>
        <p className="text-sm text-slate-400 mt-1">
          Per-tenant Meta charges · India pricing effective April 1, 2026
        </p>
      </div>

      {/* Rate card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Meta India Rates (per message)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Marketing', rate: WHATSAPP_RATES_INR.marketing, color: 'text-orange-400' },
            { label: 'Utility', rate: WHATSAPP_RATES_INR.utility, color: 'text-blue-400' },
            { label: 'Authentication', rate: WHATSAPP_RATES_INR.authentication, color: 'text-violet-400' },
            { label: 'Auth-International', rate: WHATSAPP_RATES_INR.authentication_intl, color: 'text-pink-400' },
          ].map(({ label, rate, color }) => (
            <div key={label} className="rounded-lg border border-slate-800 bg-slate-800/50 p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`text-lg font-bold mt-1 ${color}`}>₹{rate}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-500 uppercase">{monthLabel}</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{formatINRRounded(totalThisMonth)}</p>
          <p className="text-xs text-slate-500 mt-1">{totalMsgsThisMonth} messages</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-500 uppercase">{lastMonthLabel}</p>
          <p className="text-2xl font-bold text-slate-300 mt-1">{formatINRRounded(totalLastMonth)}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-xs text-slate-500 uppercase">Avg per Salon</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">
            {sortedTenants.length > 0 ? formatINRRounded(totalThisMonth / sortedTenants.length) : '₹0.00'}
          </p>
        </div>
      </div>

      {/* Per-tenant breakdown */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">Per-Tenant Breakdown — {monthLabel}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Salon</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Marketing</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Utility</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Auth</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Total Msgs</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Total Cost</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Last Month</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {sortedTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    No messages sent this month
                  </td>
                </tr>
              ) : (
                sortedTenants.map(([tenantId, data]) => {
                  const lastMonthData = lastMonth[tenantId];
                  const totalMsgs = Object.values(data.byCategory).reduce((s, c) => s + c.count, 0);
                  const marketingCost = data.byCategory.marketing?.cost ?? 0;
                  const utilityCost = data.byCategory.utility?.cost ?? 0;
                  const authCost = (data.byCategory.authentication?.cost ?? 0) + (data.byCategory.authentication_intl?.cost ?? 0);

                  return (
                    <tr key={tenantId} className="hover:bg-slate-800/20">
                      <td className="px-4 py-3 text-sm text-white font-medium">
                        {tenantMap[tenantId] || tenantId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-orange-400">
                        {marketingCost > 0 ? (
                          <span>{data.byCategory.marketing?.count ?? 0} msgs<br />{formatINRRounded(marketingCost)}</span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-blue-400">
                        {utilityCost > 0 ? (
                          <span>{data.byCategory.utility?.count ?? 0} msgs<br />{formatINRRounded(utilityCost)}</span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-violet-400">
                        {authCost > 0 ? (
                          <span>{(data.byCategory.authentication?.count ?? 0) + (data.byCategory.authentication_intl?.count ?? 0)} msgs<br />{formatINRRounded(authCost)}</span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-300">{totalMsgs}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-emerald-400">
                        {formatINRRounded(data.total)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">
                        {lastMonthData ? formatINRRounded(lastMonthData.total) : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {sortedTenants.length > 0 && (
              <tfoot>
                <tr className="border-t border-slate-700">
                  <td className="px-4 py-3 text-xs font-bold text-slate-300">TOTAL</td>
                  <td colSpan={4} />
                  <td className="px-4 py-3 text-right text-sm font-bold text-emerald-400">
                    {formatINRRounded(totalThisMonth)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500">
                    {formatINRRounded(totalLastMonth)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Note */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-3">
        <p className="text-xs text-slate-500">
          <span className="text-slate-400 font-medium">Note:</span> Costs are estimated based on template category.
          Actual Meta billing may vary slightly. Service (inbound) messages are free.
          Rates: Marketing ₹{WHATSAPP_RATES_INR.marketing} · Utility ₹{WHATSAPP_RATES_INR.utility} · Auth ₹{WHATSAPP_RATES_INR.authentication} · Auth-Intl ₹{WHATSAPP_RATES_INR.authentication_intl}
        </p>
      </div>
    </div>
  );
}
