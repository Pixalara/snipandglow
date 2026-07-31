'use client';

import { useState, useTransition } from 'react';
import { IndianRupee, Check, AlertTriangle, RotateCcw } from 'lucide-react';
import { adminUpdateTenantPricing } from './actions';

// =============================================================================
// Admin — Payment Settings for one tenant.
//
// Set a negotiated ₹/month for this salon. When set, it replaces the plan list
// price everywhere: the price shown in their dashboard AND the amount charged in
// Razorpay. Leave a field blank to fall back to the standard plan price.
// =============================================================================

export function PricingEditor({
  tenantId,
  planName,
  listMonthly,
  listYearlyPerMonth,
  customMonthly,
  customYearlyPerMonth,
  billingCycle,
}: {
  tenantId: string;
  planName: string;
  listMonthly: number;
  listYearlyPerMonth: number;
  customMonthly: number | null;
  customYearlyPerMonth: number | null;
  billingCycle: 'monthly' | 'yearly';
}) {
  const [monthly, setMonthly] = useState(customMonthly ? String(customMonthly) : '');
  const [yearly, setYearly] = useState(customYearlyPerMonth ? String(customYearlyPerMonth) : '');
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const parse = (v: string): number | null => {
    const t = v.trim();
    if (!t) return null;
    const n = Math.round(Number(t));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const nextMonthly = parse(monthly);
  const nextYearly = parse(yearly);

  // What the tenant will actually be charged after saving.
  const effMonthly = nextMonthly ?? listMonthly;
  const effYearlyPm = nextYearly ?? listYearlyPerMonth;
  const chargeNow =
    billingCycle === 'yearly' ? effYearlyPm * 12 : effMonthly;

  function save(clear = false) {
    setMsg(null);
    startTransition(async () => {
      const res = await adminUpdateTenantPricing(tenantId, {
        custom_monthly_price: clear ? null : nextMonthly,
        custom_yearly_per_month: clear ? null : nextYearly,
      });
      if (res.success) {
        if (clear) { setMonthly(''); setYearly(''); }
        setMsg({ ok: true, text: clear ? 'Reverted to standard plan pricing.' : 'Pricing saved.' });
      } else {
        setMsg({ ok: false, text: res.error ?? 'Failed to save.' });
      }
    });
  }

  const inputCls =
    'h-9 w-full rounded-lg border border-border bg-background pl-7 pr-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-6 py-4 bg-muted/30">
        <div className="flex items-center gap-2">
          <IndianRupee className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Payment Settings</h2>
          {(customMonthly || customYearlyPerMonth) && (
            <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              CUSTOM RATE
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Negotiated pricing for this salon. Overrides the {planName} list price in their dashboard and in Razorpay.
        </p>
      </div>

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Monthly rate (₹/month)
            </label>
            <div className="relative mt-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <input
                type="number"
                min={1}
                step="1"
                inputMode="numeric"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
                placeholder={String(listMonthly)}
                className={inputCls}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Blank = list price ₹{listMonthly.toLocaleString('en-IN')}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Yearly rate (₹/month, billed ×12)
            </label>
            <div className="relative mt-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
              <input
                type="number"
                min={1}
                step="1"
                inputMode="numeric"
                value={yearly}
                onChange={(e) => setYearly(e.target.value)}
                placeholder={String(listYearlyPerMonth)}
                className={inputCls}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Blank = list price ₹{listYearlyPerMonth.toLocaleString('en-IN')}/mo · ₹
              {(listYearlyPerMonth * 12).toLocaleString('en-IN')}/yr
            </p>
          </div>
        </div>

        {/* What they'll be charged */}
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Next renewal charge ({billingCycle === 'yearly' ? '12 months' : '1 month'})
            </span>
            <span className="text-base font-bold text-foreground">
              ₹{chargeNow.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {msg && (
          <div
            className={`flex items-start gap-2 rounded-xl border p-3 ${
              msg.ok
                ? 'border-emerald-300/60 bg-emerald-50 dark:bg-emerald-900/15'
                : 'border-red-300/60 bg-red-50 dark:bg-red-900/15'
            }`}
          >
            {msg.ok ? (
              <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="size-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <p className={`text-sm ${msg.ok ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>
              {msg.text}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => save(false)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {isPending ? 'Saving…' : 'Save pricing'}
          </button>
          {(customMonthly || customYearlyPerMonth) && (
            <button
              onClick={() => save(true)}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
            >
              <RotateCcw className="size-3.5" />
              Revert to list price
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
