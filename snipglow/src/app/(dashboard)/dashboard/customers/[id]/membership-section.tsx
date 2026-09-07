'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Award, Plus, X, TrendingUp, CalendarCheck, Receipt, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatINR, formatDateIN } from '@/lib/utils';
import { assignCustomerMembership, purchaseMembership } from '../actions';
import type { Membership, PaymentMethod } from '@/types';
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
              <>
                {/* Name and detail on separate lines so a long plan name or the
                    expiry date never has to share one line on a phone. */}
                <p className="truncate text-base font-bold leading-tight text-violet-700 dark:text-violet-300 sm:text-lg">
                  {activeMembership.membership_name}
                </p>
                <p className="text-xs font-medium text-violet-600/80 dark:text-violet-400/80">
                  {activeMembership.discount_pct}% off · expires {formatDateIN(activeMembership.end_date)}
                </p>
              </>
            ) : (
              <p className="text-base font-bold leading-tight text-violet-700/70 dark:text-violet-300/70 sm:text-lg">
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
          {/* Three metrics stay side by side down to the smallest phone, with
              tighter spacing there; values scale rather than truncate. */}
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            <UsageStat
              icon={<CalendarCheck className="size-3.5" />}
              label="Visits used"
              value={String(usage.visits)}
              sub={usage.visitsThisMonth > 0 ? `${usage.visitsThisMonth} this month` : undefined}
            />
            <UsageStat
              icon={<Receipt className="size-3.5" />}
              label="Billed"
              value={formatINR(usage.billedLifetime)}
              sub={usage.billedThisMonth > 0 ? `${formatINR(usage.billedThisMonth)} this month` : undefined}
            />
            <UsageStat
              icon={<TrendingUp className="size-3.5" />}
              label="Saved"
              value={formatINR(usage.savedLifetime)}
              sub={usage.savedThisMonth > 0 ? `${formatINR(usage.savedThisMonth)} this month` : undefined}
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
    <div className="rounded-xl border border-violet-200/50 bg-white/50 p-2.5 dark:border-violet-800/30 dark:bg-black/10 sm:p-3">
      <div className="flex size-7 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">
        {icon}
      </div>
      {/* No truncate on the value — a rupee figure has no break points, so
          truncation would silently drop digits. It scales down on mobile and
          wraps rather than hides. */}
      <p className="mt-2 text-sm font-bold leading-tight tabular-nums text-foreground sm:text-base">{value}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</p>
      {sub && <p className="text-[11px] font-medium leading-tight text-violet-600 dark:text-violet-400">{sub}</p>}
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [error, setError] = useState('');

  const selectedPlan = useMemo(
    () => availablePlans.find((p) => p.id === planId) ?? null,
    [availablePlans, planId]
  );
  const price = selectedPlan ? Math.max(0, Math.round(Number(selectedPlan.price) || 0)) : 0;
  const willCharge = price > 0;

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
      // Removing a plan: no charge, just expire the current one.
      if (!planId) {
        const result = await assignCustomerMembership(customerId, null);
        if (result.success) {
          toast.success(`Membership removed for ${customerName}.`);
          onClose();
          router.refresh();
        } else {
          setError(result.error);
          toast.error(result.error);
        }
        return;
      }

      // Assigning/changing a plan: bill the plan price, then activate.
      const result = await purchaseMembership(customerId, planId, paymentMethod);
      if (result.success) {
        toast.success(
          result.data.charged > 0
            ? `${selectedPlan?.name ?? 'Plan'} activated · ${formatINR(result.data.charged)} billed${result.data.invoiceNumber ? ` (${result.data.invoiceNumber})` : ''}.`
            : `${selectedPlan?.name ?? 'Plan'} activated for ${customerName}.`
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
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">Amount to charge now</span>
                <span className="text-base font-bold text-violet-700 dark:text-violet-300">
                  {willCharge ? formatINR(price) : 'Free'}
                </span>
              </div>
            </div>
          )}

          {/* Payment method — only when there's a price to collect. The plan is
              billed and activated together; nothing is added until it succeeds. */}
          {willCharge && (
            <div className="space-y-1.5">
              <Label htmlFor="membership-payment">Payment method</Label>
              <select
                id="membership-payment"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
              </select>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Stacked on mobile (primary on top via reverse) so the long
              "Charge ₹X & activate" label can't overflow a narrow screen. */}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl sm:w-auto"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full rounded-xl bg-violet-600 text-white hover:bg-violet-700 sm:w-auto"
              disabled={isPending || (!planId && !activeMembership)}
            >
              {isPending
                ? 'Processing…'
                : !planId && activeMembership
                  ? 'Remove plan'
                  : willCharge
                    ? `Charge ${formatINR(price)} & activate`
                    : 'Activate plan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
