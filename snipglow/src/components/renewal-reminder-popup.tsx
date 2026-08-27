'use client';

import { useState, useEffect } from 'react';
import { Crown, Clock, AlertTriangle, X } from 'lucide-react';
import { CompletePaymentModal } from '@/components/complete-payment-modal';

// =============================================================================
// Renewal reminder.
//
// Shown as the subscription/trial end date approaches, in five escalating stages
// based on the salon's own IST calendar:
//
//   8-14 days before → early heads-up     (corner card, non-blocking)
//   4-7  days before → renews this week   (corner card, non-blocking)
//   2-3  days before → renews in N days   (modal, amber)
//   1    day  before → renews tomorrow    (modal, orange)
//   day of expiry    → expires today      (modal, red, urgent)
//
// STAGES ARE BANDS, NOT EXACT DAYS. They used to be `days === 2 / 1 / 0`, so an
// owner who did not happen to open the dashboard on one of those three days got
// no warning at all before being locked out — a nasty surprise on a yearly plan.
// Any visit inside the final two weeks now produces a reminder.
//
// Why calendar days and not raw hours: "2 days before" must mean the same thing
// to the owner as it does on their wall calendar. A pure millisecond diff would
// make a reminder land at, say, 47 hours and read as "1 day".
//
// Only the last three stages take over the screen. Interrupting a working salon
// with a full-screen modal two weeks out is not proportional, so the early
// notices sit in the corner instead.
//
// Managers see the reminder too, but without a Pay button: only the owner can
// pay, so a manager gets copy that tells them who to ask rather than a CTA that
// would fail with a 403.
//
// Each stage is dismissible once per login (sessionStorage), so it re-appears on
// the next sign-in until the plan is renewed - without nagging on every page
// navigation. Stage keys are separate, so dismissing the early notice does not
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

type Stage = 'two_weeks' | 'week' | 'three_days' | 'tomorrow' | 'today';

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

/** First day (inclusive) on which any reminder is shown. */
export const REMINDER_WINDOW_DAYS = 14;

/**
 * Which reminder (if any) applies for a given days-remaining value.
 *
 * Bands, not exact days: every value from 0 to REMINDER_WINDOW_DAYS maps to a
 * stage, so skipping a day cannot skip the warning. Negative values are silent —
 * once expired, the lockout guard takes over.
 */
export function stageForDaysLeft(days: number): Stage | null {
  if (!Number.isFinite(days) || days < 0) return null;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 3) return 'three_days';
  if (days <= 7) return 'week';
  if (days <= REMINDER_WINDOW_DAYS) return 'two_weeks';
  return null;
}

/** Whether a stage is urgent enough to take over the screen. */
export function isUrgentStage(stage: Stage): boolean {
  return stage === 'today' || stage === 'tomorrow' || stage === 'three_days';
}

const STAGE_UI: Record<Stage, {
  title: string;
  when: string;
  iconBg: string;
  iconColor: string;
  Icon: typeof Clock;
}> = {
  two_weeks: {
    title: 'Your plan renews in 2 weeks',
    when: 'in about 2 weeks',
    iconBg: 'bg-sky-100 dark:bg-sky-900/30',
    iconColor: 'text-sky-600 dark:text-sky-400',
    Icon: Clock,
  },
  week: {
    title: 'Your plan renews this week',
    when: 'this week',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    Icon: Clock,
  },
  three_days: {
    title: 'Your plan renews in a few days',
    when: 'in a few days',
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

  // The stage has to be resolved AFTER mount, not during render, because it
  // depends on two things the server cannot see: sessionStorage (which stages the
  // user already dismissed) and the browser's current time. Computing it during
  // render would either throw on the server or produce a hydration mismatch, so
  // setting state from this effect is the correct trade here.
  useEffect(() => {
    // Managers are told too (see the header note) — only the CTA differs.
    if (isExpired || !endDate) return;

    const days = istDaysUntil(endDate);
    const s = stageForDaysLeft(days);
    if (!s) return;

    try {
      // Per-stage, per-end-date key: dismissing the early notice must not hide
      // the final-day one, and a renewal (new end date) resets everything.
      if (sessionStorage.getItem(`renewal_reminder_${endDate}_${s}`) === '1') return;
    } catch { /* storage unavailable - just show it */ }

    // Deliberate: see the note above this effect. This runs once per mount, not
    // in a render loop, so there is no cascading-render risk.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStage(s);
  }, [endDate, isExpired]);

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

  const urgent = stage ? isUrgentStage(stage) : false;

  /** Body copy, which differs for staff who cannot pay. */
  const body = isOwner ? (
    <>
      Your <span className="font-medium text-foreground">{planLabel}</span> plan is due for renewal{' '}
      <span className="font-semibold text-foreground">{ui?.when}</span>
      {endLabel ? ` (${endLabel})` : ''}. Renew now to keep bookings, billing and WhatsApp
      automation running without interruption.
    </>
  ) : (
    <>
      The salon&apos;s <span className="font-medium text-foreground">{planLabel}</span> plan is due for
      renewal <span className="font-semibold text-foreground">{ui?.when}</span>
      {endLabel ? ` (${endLabel})` : ''}. Only the owner can renew — please let them know so
      bookings, billing and WhatsApp automation keep running.
    </>
  );

  const amountPanel =
    isOwner && typeof renewalAmount === 'number' && renewalAmount > 0 ? (
      <div className="mt-4 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Amount payable</span>
          <span className="text-lg font-bold text-foreground">
            ₹{renewalAmount.toLocaleString('en-IN')}
          </span>
        </div>
      </div>
    ) : null;

  return (
    <>
      {/* Urgent stages (0-3 days) take over the screen. */}
      {stage && ui && urgent && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={dismiss} aria-hidden="true" />
          <div
            role="alertdialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-2xl text-center max-h-[90vh] overflow-y-auto"
          >
            <div className={`mx-auto flex size-16 items-center justify-center rounded-2xl ${ui.iconBg} mb-5`}>
              <ui.Icon className={`size-8 ${ui.iconColor}`} />
            </div>

            <h2 className="text-xl font-bold text-foreground">{ui.title}</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">{body}</p>

            {amountPanel}

            {isOwner && (
              <button
                onClick={() => { setStage(null); setRenewOpen(true); }}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-pink-500 hover:to-fuchsia-500 transition-all"
              >
                <Crown className="size-4" />
                Renew now
              </button>
            )}
            <button
              onClick={dismiss}
              className={`${isOwner ? 'mt-3' : 'mt-5'} inline-flex w-full items-center justify-center rounded-xl px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors`}
            >
              {isOwner ? 'Remind me later' : 'Got it'}
            </button>
          </div>
        </div>
      )}

      {/* Early stages (4-14 days) sit in the corner. The account still works, so
          interrupting the front desk with a blocking overlay isn't warranted. */}
      {stage && ui && !urgent && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-[120] w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-border bg-card p-4 shadow-2xl"
        >
          <button
            onClick={dismiss}
            className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Dismiss renewal reminder"
          >
            <X className="size-4" />
          </button>

          <div className="flex items-start gap-3 pr-7">
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${ui.iconBg}`}>
              <ui.Icon className={`size-5 ${ui.iconColor}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{ui.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{body}</p>
            </div>
          </div>

          {amountPanel}

          {isOwner && (
            <button
              onClick={() => { setStage(null); setRenewOpen(true); }}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-pink-500 hover:to-fuchsia-500 transition-all"
            >
              <Crown className="size-4" />
              Renew now
            </button>
          )}
        </div>
      )}

      <CompletePaymentModal open={renewOpen} onClose={() => setRenewOpen(false)} />
    </>
  );
}
