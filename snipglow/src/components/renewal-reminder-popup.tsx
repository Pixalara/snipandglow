'use client';

import { useState, useEffect } from 'react';
import { Crown, Clock, X } from 'lucide-react';
import { CompletePaymentModal } from '@/components/complete-payment-modal';

// =============================================================================
// Renewal reminder popup.
//
// Shows once to the salon OWNER when the subscription / trial end date is within
// the next 24 hours (and not already expired), nudging them to renew before any
// interruption. Dismissed state is remembered per end-date in localStorage so it
// doesn't reappear on every navigation; it shows again for a new renewal date.
// =============================================================================

interface Props {
  /** ISO subscription/trial end date, or null. */
  endDate: string | null;
  isExpired: boolean;
  isOwner: boolean;
  planLabel: string;
}

export function RenewalReminderPopup({ endDate, isExpired, isOwner, planLabel }: Props) {
  const [show, setShow] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [hoursLeft, setHoursLeft] = useState(0);

  useEffect(() => {
    if (!isOwner || isExpired || !endDate) return;
    const ms = new Date(endDate).getTime() - Date.now();
    // Only within the 24 hours BEFORE the renewal date.
    if (ms <= 0 || ms > 24 * 60 * 60 * 1000) return;
    try {
      if (localStorage.getItem(`renewal_reminder_dismissed_${endDate}`) === '1') return;
    } catch { /* ignore */ }
    setHoursLeft(Math.max(1, Math.ceil(ms / (60 * 60 * 1000))));
    setShow(true);
  }, [endDate, isExpired, isOwner]);

  function dismiss() {
    try {
      if (endDate) localStorage.setItem(`renewal_reminder_dismissed_${endDate}`, '1');
    } catch { /* ignore */ }
    setShow(false);
  }

  if (!show && !renewOpen) return null;

  return (
    <>
      {show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={dismiss} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-2xl text-center">
            <button
              onClick={dismiss}
              className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>

            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30 mb-5">
              <Clock className="size-8 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Your plan renews soon</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              Your <span className="font-medium text-foreground">{planLabel}</span> plan is due for renewal in about{' '}
              <span className="font-semibold text-foreground">{hoursLeft} hour{hoursLeft > 1 ? 's' : ''}</span>.
              Renew now to keep bookings, billing and WhatsApp automation running without interruption.
            </p>

            <button
              onClick={() => { setShow(false); setRenewOpen(true); }}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-pink-500 hover:to-fuchsia-500 transition-all"
            >
              <Crown className="size-4" />
              Renew now
            </button>
            <button onClick={dismiss} className="mt-3 text-sm text-muted-foreground hover:text-foreground">
              Remind me later
            </button>
          </div>
        </div>
      )}

      <CompletePaymentModal open={renewOpen} onClose={() => { setRenewOpen(false); dismiss(); }} />
    </>
  );
}
