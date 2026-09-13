'use client';

// =============================================================================
// Loyalty points card for the customer profile — a gamified, tier-based view of
// the customer's redeemable balance, with an owner/manager "adjust" action for
// manual bonuses or corrections. Points are earned automatically on billing and
// redeemed at checkout; this card is the at-a-glance status + manual override.
// =============================================================================

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkles, Plus, Minus, X } from 'lucide-react';
import { getPointsTier } from '@/lib/loyalty-points';
import { formatINR } from '@/lib/utils';
import { adjustLoyaltyPoints } from '../loyalty-actions';

export function LoyaltySection({
  customerId,
  customerName,
  balance,
  lifetime,
  redeemValue,
}: {
  customerId: string;
  customerName: string;
  balance: number;
  lifetime: number;
  redeemValue: number;
}) {
  const [showAdjust, setShowAdjust] = useState(false);
  const tier = getPointsTier(lifetime);
  const worth = redeemValue > 0 ? Math.round(balance * redeemValue) : 0;
  const firstName = customerName.split(' ')[0] || customerName;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Tier-coloured face */}
      <div className={`relative overflow-hidden bg-gradient-to-br ${tier.gradient} p-5 text-white`}>
        <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/80">
              <Sparkles className="size-3.5" /> Loyalty Points
            </div>
            <p className="mt-1 text-4xl font-extrabold leading-none">
              {balance.toLocaleString('en-IN')}
              <span className="ml-1 text-lg font-semibold text-white/80">pts</span>
            </p>
            {worth > 0 && (
              <p className="mt-1 text-sm text-white/85">worth {formatINR(worth)} at checkout</p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold backdrop-blur">
              <span aria-hidden>{tier.emoji}</span> {tier.label}
            </span>
            <button
              onClick={() => setShowAdjust(true)}
              className="rounded-lg bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur transition-colors hover:bg-white/25"
            >
              Adjust
            </button>
          </div>
        </div>

        {/* Progress to the next tier */}
        {tier.next ? (
          <div className="relative mt-4">
            <div className="flex items-center justify-between text-[11px] text-white/80">
              <span>{tier.label}</span>
              <span>{tier.toNext.toLocaleString('en-IN')} pts to {tier.next.label}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white/90 transition-all" style={{ width: `${tier.progressPct}%` }} />
            </div>
          </div>
        ) : (
          <p className="relative mt-4 text-xs text-white/80">
            Top tier reached — {firstName} is a {tier.label} member 💎
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 text-xs text-muted-foreground">
        <span>Lifetime earned: <span className="font-semibold text-foreground">{lifetime.toLocaleString('en-IN')} pts</span></span>
        <span>Points apply automatically at billing.</span>
      </div>

      {showAdjust && (
        <AdjustPointsModal
          customerId={customerId}
          customerName={customerName}
          balance={balance}
          onClose={() => setShowAdjust(false)}
        />
      )}
    </div>
  );
}

function AdjustPointsModal({
  customerId,
  customerName,
  balance,
  onClose,
}: {
  customerId: string;
  customerName: string;
  balance: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function handleSubmit() {
    setError('');
    const n = Math.floor(Number(points) || 0);
    if (n <= 0) { setError('Enter a number of points greater than 0.'); return; }
    if (mode === 'remove' && n > balance) { setError(`Only ${balance.toLocaleString('en-IN')} points available to remove.`); return; }
    const signed = mode === 'add' ? n : -n;
    startTransition(async () => {
      const res = await adjustLoyaltyPoints({ customerId, points: signed, reason: reason.trim() || undefined });
      if (res.success) {
        toast.success(`Points ${mode === 'add' ? 'added for' : 'removed from'} ${customerName}.`);
        onClose();
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Adjust loyalty points</h3>
          <button onClick={onClose} aria-label="Close" className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('add')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${mode === 'add' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'border-border text-muted-foreground hover:bg-muted'}`}
            >
              <Plus className="size-4" /> Add
            </button>
            <button
              type="button"
              onClick={() => setMode('remove')}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${mode === 'remove' ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300' : 'border-border text-muted-foreground hover:bg-muted'}`}
            >
              <Minus className="size-4" /> Remove
            </button>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="adjust-points" className="text-sm font-medium text-foreground">Points</label>
            <input
              id="adjust-points"
              type="number"
              min={1}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              placeholder="e.g. 100"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="adjust-reason" className="text-sm font-medium text-foreground">Reason (optional)</label>
            <input
              id="adjust-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={120}
              className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              placeholder="e.g. Festival bonus"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-60"
            >
              {isPending ? 'Saving…' : mode === 'add' ? 'Add points' : 'Remove points'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
