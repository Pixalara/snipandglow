'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, CheckCircle2, AlertTriangle } from 'lucide-react';
import { adminUpdateTenantPlan } from './actions';

interface Props {
  tenantId: string;
  currentPlan: string;
}

// DB plan_tier values (CHECK: starter | pro | enterprise) mapped to the
// customer-facing marketing names.
const PLAN_OPTIONS: { value: string; label: string }[] = [
  { value: 'starter', label: 'Essentials (starter)' },
  { value: 'pro', label: 'Pro (pro)' },
  { value: 'enterprise', label: 'Growth (enterprise)' },
];

export function AdminPlanEditor({ tenantId, currentPlan }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [plan, setPlan] = useState(
    PLAN_OPTIONS.some((p) => p.value === currentPlan) ? currentPlan : 'starter'
  );
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const dirty = plan !== currentPlan;

  function handleSave() {
    setError('');
    setSuccess(false);
    if (!dirty) return;
    startTransition(async () => {
      const res = await adminUpdateTenantPlan(tenantId, plan);
      if (res.success) {
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 2500);
      } else {
        setError(res.error || 'Failed to update plan.');
      }
    });
  }

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

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:items-end">
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
      </div>
    </div>
  );
}
