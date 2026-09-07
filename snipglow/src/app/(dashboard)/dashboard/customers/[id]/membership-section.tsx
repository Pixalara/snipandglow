'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Award, Plus, X, TrendingUp, CalendarCheck, IndianRupee, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatINR, formatDateIN } from '@/lib/utils';
import { assignCustomerMembership } from '../actions';
import type { Membership } from '@/types';
import type { MembershipUsageSummary } from '../actions';

// =============================================================================
// MembershipSection — mirrors WalletSection: shows the customer's current plan
// with an assign/change/remove action, plus how much the membership is actually
// being used (visits, savings this month and lifetime, and the services it has
// discounted). Assignment was previously buried in the edit-customer modal.
// =============================================================================

interface ActiveMembership {
  id: string;
  end_date: string;
  membership_name: string;
  discount_pct: number;
}

export function MembershipSection({
  customerId,
  customerName,
  activeMembership,
  usage,
  availablePlans,
}: {
  customerId: string;
  customerName: string;
  activeMembership: ActiveMembership | null;
  usage: MembershipUsageSummary;
  availablePlans: Membership[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50 to-fuchsia-50/40 p-5 dark:border-violet-800/30 dark:from-violet-900/15 dark:to-fuchsia-900/10">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 shadow-sm shadow-violet-200/50 dark:bg-violet-900/40">
            <Award className="size-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-violet-700/80 dark:text-violet-400/80">Membership</p>
            {activeMembership ? (
              <p className="text-lg font-bold leading-tight text-violet-700 dark:text-violet-300">
                {activeMembership.membership_name}
                <span className="ml-2 text-sm font-medium text-violet-600/80 dark:text-violet-400/80">
                  {activeMembership.discount_pct}% off · expires {formatDateIN(activeMembership.end_date)}
                </span>
              </p>
            ) : (
              <p className="text-lg font-bold leading-tight text-violet-700/70 dark:text-violet-300/70">
                No active plan
              </p>
            )}
          </div>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="w-full gap-1.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 sm:w-auto"
          disabled={availablePlans.length === 0 && !activeMembership}
        >
          <Plus className="size-4" />
          {activeMembership ? 'Change plan' : 'Assign plan'}
        </Button>
      </div>

      {availablePlans.length === 0 && !activeMembership && (
        <p className="mt-3 text-xs text-violet-700/70 dark:text-violet-400/70">
          No membership plans exist yet. Create one under Memberships first.
        </p>
      )}

      {/* Usage — only meaningful once the membership has actually been billed */}
      {usage.visits > 0 && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2.5">
            <UsageStat
              icon={<CalendarCheck className="size-3.5" />}
              label="Visits used"
              value={String(usage.visits)}
              sub={usage.visitsThisMonth > 0 ? `${usage.visitsThisMonth} this month` : undefined}
            />
            <UsageStat
              icon={<IndianRupee className="size-3.5" />}
              label="Saved this month"
              value={formatINR(usage.savedThisMonth)}
            />
            <UsageStat
              icon={<TrendingUp className="size-3.5" />}
              label="Saved lifetime"
              value={formatINR(usage.savedLifetime)}
            />
          </div>

          {usage.services.length > 0 && (
            <div className="rounded-xl border border-violet-200/50 bg-white/50 p-3 dark:border-violet-800/30 dark:bg-black/10">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700/70 dark:text-violet-400/70">
                <Scissors className="size-3" />
                Services used with this plan
              </p>
              <ul className="space-y-1.5">
                {usage.services.slice(0, 5).map((s) => (
                  <li key={s.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-foreground">
                      {s.name}
                      <span className="ml-1.5 text-xs text-muted-foreground">×{s.count}</span>
                    </span>
                    <span className="shrink-0 font-medium text-emerald-600 dark:text-emerald-400">
                      {formatINR(s.saved)} saved
                    </span>
                  </li>
                ))}
              </ul>
              {usage.services.length > 5 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  +{usage.services.length - 5} more service{usage.services.length - 5 === 1 ? '' : 's'}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {activeMembership && usage.visits === 0 && (
        <p className="mt-3 text-xs text-violet-700/70 dark:text-violet-400/70">
          Not used yet. Savings and services will appear here after the first discounted bill.
        </p>
      )}

      {open && (
        <AssignMembershipModal
          customerId={customerId}
          customerName={customerName}
          activeMembership={activeMembership}
          availablePlans={availablePlans}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function UsageStat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-violet-200/50 bg-white/50 p-3 dark:border-violet-800/30 dark:bg-black/10">
      <div className="flex size-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
        {icon}
      </div>
      <p className="mt-2 truncate text-base font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
      {sub && <p className="text-[11px] font-medium text-violet-600 dark:text-violet-400">{sub}</p>}
    </div>
  );
}

function AssignMembershipModal({
  customerId,
  customerName,
  activeMembership,
  availablePlans,
  onClose,
}: {
  customerId: string;
  customerName: string;
  activeMembership: ActiveMembership | null;
  availablePlans: Membership[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // '' means "no plan" — i.e. remove the current membership.
  const [planId, setPlanId] = useState('');
  const [error, setError] = useState('');

  const selectedPlan = useMemo(
    () => availablePlans.find((p) => p.id === planId) ?? null,
    [availablePlans, planId]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;
    setError('');

    // Guard the no-op: nothing selected and nothing to remove.
    if (!planId && !activeMembership) {
      setError('Select a plan to assign.');
      return;
    }

    startTransition(async () => {
      const result = await assignCustomerMembership(customerId, planId || null);
      if (result.success) {
        toast.success(
          planId
            ? `${selectedPlan?.name ?? 'Plan'} assigned to ${customerName}.`
            : `Membership removed for ${customerName}.`
        );
        onClose();
        router.refresh();
      } else {
        setError(result.error);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={isPending ? undefined : onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-card p-6 shadow-xl sm:max-w-md sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/20">
              <Award className="size-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {activeMembership ? 'Change membership' : 'Assign membership'}
              </h2>
              <p className="text-xs text-muted-foreground">{customerName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {activeMembership && (
          <div className="mb-4 rounded-xl border border-violet-200/60 bg-violet-50/60 p-3 text-sm dark:border-violet-800/30 dark:bg-violet-900/15">
            <p className="text-foreground">
              Current: <span className="font-medium">{activeMembership.membership_name}</span> (
              {activeMembership.discount_pct}% off)
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Assigning a new plan replaces this one. Its recorded usage is kept.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="membership-plan">Plan</Label>
            <select
              id="membership-plan"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              autoFocus
            >
              <option value="">{activeMembership ? 'Remove membership' : 'Select a plan…'}</option>
              {availablePlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {plan.discount_pct}% off · {formatINR(plan.price)} / {plan.validity_days}d
                </option>
              ))}
            </select>
          </div>

          {selectedPlan && (
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Discount on every bill</span>
                <span className="font-semibold text-foreground">{selectedPlan.discount_pct}%</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Valid for</span>
                <span className="font-medium text-foreground">{selectedPlan.validity_days} days</span>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-xl bg-violet-600 text-white hover:bg-violet-700"
              disabled={isPending || (!planId && !activeMembership)}
            >
              {isPending ? 'Saving…' : !planId && activeMembership ? 'Remove plan' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
