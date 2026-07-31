'use client';

import { useState, useEffect } from 'react';
import { Crown, Clock, AlertTriangle, X } from 'lucide-react';
import { CompletePaymentModal } from '@/components/complete-payment-modal';

// =============================================================================
// Renewal reminder popup.
//
// Shown to the salon OWNER as the subscription/trial end date approaches, in
// three escalating stages based on the salon's own IST calendar:
//
//   2 days before  → early heads-up      (amber)
//   1 day before   → renews tomorrow     (orange)
//   day of expiry  → renews today        (red, urgent)
//
// Why calendar days and not raw hours: "2 days before" must mean the same thing
// to the owner as it does on their wall calendar. A pure millisecond diff would
// make a reminder land at, say, 47 hours and read as "1 day".
//
// Each stage is dismissible once per login (sessionStorage), so it re-appears on
// the next sign-in until the plan is renewed - without nagging on every page
// navigation. Stage keys are separate, so dismissing the 2-day notice does not
// suppress the final-day one.
// =============================================================================

interface Props {
  /** ISO subscription/trial end date, or null. */
  endDate: string | null;
  isExpired: boolean;
  isOwner: boolean;
  planLabel: string;
  /** Amount payable on renewal, in rupees (custom-rate aware). */
  renewalAmount?: number;
}

type Stage = 'two_days' | 'tomorrow' | 'today';

/** YYYY-MM-DD in the salon's timezone. */
function istDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Whole calendar days from today (IST) until the given date. */
export function istDaysUntil(endIso: string, now: Date = new Date()): number {
  const today = istDay(now);
  const end = istDay(new Date(endIso));
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** Which reminder (if any) applies for a given days-remaining value. */
export function stageForDaysLeft(days: number): Stage | null {
  if (days === 2) return 'two_days';
  if (days === 1) return 'tomorrow';
  if (days === 0) return 'today';
  return null;
}

const STAGE_UI: Record<Stage, {
  title: string;
  when: string;
  iconBg: string;
  iconColor: string;
  Icon: typeof Clock;
}> = {
  two_days: {
    title: 'Your plan renews in 2 days',
    when: 'in 2 days',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    Icon: Clock,
  },
  tomorrow: {
    title: 'Your plan renews tomorrow',
    when: 'tomorrow',
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400',
    Icon: Clock,
  },
  today: {
    title: 'Your plan expires today',
    when: 'today',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    Icon: AlertTriangle,
  },
};

export function RenewalReminderPopup({ endDate, isExpired, isOwner, planLabel, renewalAmount }: Props) {
  const [stage, setStage] = useState<Stage | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);

  useEffect(() => {
    if (!isOwner || isExpired || !endDate) return;

    const days = istDaysUntil(endDate);
    const s = stageForDaysLeft(days);
    if (!s) return;

    try {
      // Per-stage, per-end-date key: dismissing the 2-day notice must not hide
      // the final-day one, and a renewal (new end date) resets everything.
      if (sessionStorage.getItem(`renewal_reminder_${endDate}_${s}`) === '1') return;
    } catch { /* storage unavailable - just show it */ }

    setStage(s);
  }, [endDate, isExpired, isOwner]);

  function dismiss() {
    try {
      if (endDate && stage) sessionStorage.setItem(`renewal_reminder_${endDate}_${stage}`, '1');
    } catch { /* ignore */ }
    setStage(null);
  }

  if (!stage && !renewOpen) return null;

  const ui = stage ? STAGE_UI[stage] : null;
  const endLabel = endDate
    ? new Date(endDate).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <>
      {stage && ui && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={dismiss} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-2xl text-center max-h-[90vh] overflow-y-auto">
            <div className={`mx-auto flex size-16 items-center justify-center rounded-2xl ${ui.iconBg} mb-5`}>
              <ui.Icon className={`size-8 ${ui.iconColor}`} />
            </div>

            <h2 className="text-xl font-bold text-foreground">{ui.title}</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              Your <span className="font-medium text-foreground">{planLabel}</span> plan is due for renewal{' '}
              <span className="font-semibold text-foreground">{ui.when}</span>
              {endLabel ? ` (${endLabel})` : ''}. Renew now to keep bookings, billing and WhatsApp
              automation running without interruption.
            </p>

            {typeof renewalAmount === 'number' && renewalAmount > 0 && (
              <div className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Amount payable</span>
                  <span className="text-lg font-bold text-foreground">
                    ₹{renewalAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={() => { setStage(null); setRenewOpen(true); }}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-pink-500 hover:to-fuchsia-500 transition-all"
            >
              <Crown className="size-4" />
              Renew now
            </button>
            <button
              onClick={dismiss}
              className="mt-3 inline-flex w-full items-center justify-center rounded-xl px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Remind me later
            </button>
          </div>
        </div>
      )}

      <CompletePaymentModal open={renewOpen} onClose={() => setRenewOpen(false)} />
    </>
  );
}
