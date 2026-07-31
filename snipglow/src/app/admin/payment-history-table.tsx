import Link from 'next/link';
import { formatISTDateTime } from '@/lib/datetime';

// =============================================================================
// Shared payment history table (admin).
// Used per-tenant on the tenant detail page and across all tenants on
// /admin/payments. `showTenant` adds the salon column for the consolidated view.
// =============================================================================

export interface PaymentRow {
  id: string;
  tenant_id: string;
  salon_name?: string | null;
  tenant_code?: string | null;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  amount: number; // paise
  plan_tier: string;
  billing_cycle: string;
  months: number;
  status: string;
  activated_at: string | null;
  created_at: string;
  notes?: Record<string, unknown> | null;
}

function statusClass(status: string): string {
  if (status === 'paid') return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
  if (status === 'failed') return 'bg-red-500/15 text-red-600 dark:text-red-400';
  return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
}

export function PaymentHistoryTable({
  rows,
  showTenant = false,
  emptyText = 'No payments yet',
}: {
  rows: PaymentRow[];
  showTenant?: boolean;
  emptyText?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Date (IST)</th>
            {showTenant && (
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Salon</th>
            )}
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Amount</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Period</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
            <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Payment / Order ID</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => {
            const notes = (r.notes ?? {}) as Record<string, unknown>;
            return (
              <tr key={r.id} className="hover:bg-accent/40">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {formatISTDateTime(r.created_at)}
                </td>
                {showTenant && (
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/tenants/${r.tenant_id}`}
                      className="font-medium text-foreground hover:text-blue-500"
                    >
                      {r.salon_name ?? '—'}
                    </Link>
                    {r.tenant_code && (
                      <span className="block font-mono text-[10px] text-muted-foreground">{r.tenant_code}</span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                  ₹{(r.amount / 100).toLocaleString('en-IN')}
                  {notes.custom_rate ? (
                    <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                      CUSTOM
                    </span>
                  ) : null}
                  {notes.test_charge ? (
                    <span className="ml-1.5 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-blue-600 dark:text-blue-400">
                      TEST
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-xs text-foreground/80 whitespace-nowrap">
                  {r.months} mo · {r.billing_cycle}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass(r.status)}`}>
                    {r.status}
                  </span>
                  {r.status === 'paid' && !r.activated_at && (
                    <span className="ml-1.5 text-[10px] text-amber-600">not activated</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                  {r.razorpay_payment_id ?? r.razorpay_order_id}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={showTenant ? 6 : 5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
