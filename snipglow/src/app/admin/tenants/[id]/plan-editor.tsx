'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, CheckCircle2, AlertTriangle, Crown } from 'lucide-react';
import { adminUpdateTenantPlan, adminActivateSubscription, adminSetSubscriptionEnd } from './actions';

interface Props {
  tenantId: string;
  currentPlan: string;
  currentBillingCycle?: string;
  subscriptionStatus?: string;
  subscriptionEnd?: string | null;
}

// DB plan_tier values (CHECK: starter | pro | enterprise) mapped to the
// customer-facing marketing names.
const PLAN_OPTIONS: { value: string; label: string }[] = [
  { value: 'starter', label: 'Essentials (starter)' },
  { value: 'pro', label: 'Pro (pro)' },
  { value: 'enterprise', label: 'Growth (enterprise)' },
];

const CYCLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'yearly', label: 'Yearly (discounted)' },
  { value: 'monthly', label: 'Monthly (list price)' },
];

export function AdminPlanEditor({ tenantId, currentPlan, currentBillingCycle, subscriptionStatus, subscriptionEnd }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [plan, setPlan] = useState(
    PLAN_OPTIONS.some((p) => p.value === currentPlan) ? currentPlan : 'starter'
  );
  const [cycle, setCycle] = useState(
    currentBillingCycle === 'monthly' ? 'monthly' : 'yearly'
  );
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Subscription activation state.
  const [months, setMonths] = useState(1);
  const [actPending, startActTransition] = useTransition();
  const [actError, setActError] = useState('');
  const [actSuccess, setActSuccess] = useState(false);

  // Exact expiry-date state (extend a trial or prepone to test expiry lock).
  const [expiryDate, setExpiryDate] = useState(
    subscriptionEnd ? new Date(subscriptionEnd).toISOString().slice(0, 10) : ''
  );
  const [expPending, startExpTransition] = useTransition();
  const [expError, setExpError] = useState('');
  const [expSuccess, setExpSuccess] = useState(false);

  function handleSetExpiry() {
    setExpError('');
    setExpSuccess(false);
    if (!expiryDate) {
      setExpError('Pick a date first.');
      return;
    }
    startExpTransition(async () => {
      const res = await adminSetSubscriptionEnd(tenantId, expiryDate);
      if (res.success) {
        setExpSuccess(true);
        router.refresh();
        setTimeout(() => setExpSuccess(false), 2500);
      } else {
        setExpError(res.error || 'Failed to update expiry date.');
      }
    });
  }

  const dirty = plan !== currentPlan || cycle !== (currentBillingCycle === 'monthly' ? 'monthly' : 'yearly');

  function handleSave() {
    setError('');
    setSuccess(false);
    if (!dirty) return;
    startTransition(async () => {
      const res = await adminUpdateTenantPlan(tenantId, plan, cycle);
      if (res.success) {
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 2500);
      } else {
        setError(res.error || 'Failed to update plan.');
      }
    });
  }

  function handleActivate() {
    setActError('');
    setActSuccess(false);
    startActTransition(async () => {
      const res = await adminActivateSubscription(tenantId, months);
      if (res.success) {
        setActSuccess(true);
        router.refresh();
        setTimeout(() => setActSuccess(false), 2500);
      } else {
        setActError(res.error || 'Failed to activate subscription.');
      }
    });
  }

  const endLabel = subscriptionEnd
    ? new Date(subscriptionEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  const inputCls =
    'w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <CreditCard className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Subscription Plan (Admin)</h2>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Change the tenant&apos;s plan tier. Pro unlocks the dedicated WhatsApp onboarding flow. Takes
          effect immediately — the tenant only needs to reload.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 sm:items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Plan Tier</label>
            <select className={inputCls} value={plan} onChange={(e) => setPlan(e.target.value)}>
              {PLAN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Billing Cycle</label>
            <select className={inputCls} value={cycle} onChange={(e) => setCycle(e.target.value)}>
              {CYCLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSave}
            disabled={isPending || !dirty}
            className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Update Plan'}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
            <AlertTriangle className="size-4 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
            <CheckCircle2 className="size-4 shrink-0" /> Plan updated.
          </div>
        )}

        {/* Subscription activation / extension */}
        <div className="mt-2 border-t border-border pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Crown className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Subscription</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Status: <span className="font-medium text-foreground capitalize">{subscriptionStatus || '—'}</span>
            {' · '}Renews / ends: <span className="font-medium text-foreground">{endLabel}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Activating sets the status to <span className="font-medium">active</span> and extends the end date.
            Use this after taking payment offline (interim, until Razorpay is live).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Extend by</label>
              <select className={inputCls} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                <option value={1}>1 month</option>
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
              </select>
            </div>
            <button
              onClick={handleActivate}
              disabled={actPending}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              <Crown className="size-4" />
              {actPending ? 'Activating...' : 'Activate / Extend'}
            </button>
          </div>
          {actError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
              <AlertTriangle className="size-4 shrink-0" /> {actError}
            </div>
          )}
          {actSuccess && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
              <CheckCircle2 className="size-4 shrink-0" /> Subscription activated &amp; extended.
            </div>
          )}

          {/* Set an exact expiry date (extend a trial, or prepone to test the
              expired-account lockout). */}
          <div className="mt-2 border-t border-border pt-4 space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Set exact expiry date</label>
            <p className="text-xs text-muted-foreground">
              Pick any date — a future date gives a trial more time; a past/today date
              expires the account so you can verify dashboard features are locked.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:items-end">
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={inputCls}
                aria-label="Subscription expiry date"
              />
              <button
                onClick={handleSetExpiry}
                disabled={expPending || !expiryDate}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-600 disabled:opacity-50"
              >
                {expPending ? 'Saving...' : 'Set Expiry Date'}
              </button>
            </div>
            {expError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                <AlertTriangle className="size-4 shrink-0" /> {expError}
              </div>
            )}
            {expSuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
                <CheckCircle2 className="size-4 shrink-0" /> Expiry date updated.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
