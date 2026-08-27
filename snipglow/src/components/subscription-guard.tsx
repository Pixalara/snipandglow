'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Crown, ShieldCheck, Sparkles, X, Check } from 'lucide-react';
import { CompletePaymentModal } from '@/components/complete-payment-modal';

interface SubscriptionGuardProps {
  subscriptionStatus: string;
  /** Effective expiry (computed from trial/subscription end date). */
  isExpired?: boolean;
  /** True when the lapsed period was a free trial (vs a paid subscription). */
  isTrial?: boolean;
  /** ISO date the trial/subscription ended (for the popup message). */
  trialEndedAt?: string | null;
  children: React.ReactNode;
}

// Routes that stay reachable when expired, so the owner can always see what they
// owe and pay it:
//
//   /dashboard          — the renewal prompt lives here
//   /dashboard/settings — the expiry date, the exact amount payable and the
//                         payment history live here. Locking it meant an owner
//                         who had just paid could not look up the payment id that
//                         support would ask them for.
//
// Everything that runs the salon (appointments, billing, customers, WhatsApp)
// stays locked until the subscription is renewed.
const ALWAYS_ACCESSIBLE = ['/dashboard', '/dashboard/settings'];

export function SubscriptionGuard({
  subscriptionStatus,
  isExpired: isExpiredProp,
  isTrial = false,
  trialEndedAt,
  children,
}: SubscriptionGuardProps) {
  const pathname = usePathname();
  const [payOpen, setPayOpen] = useState(false);

  // Effective expiry: prefer the computed prop; fall back to explicit status.
  const isExpired =
    isExpiredProp ?? (subscriptionStatus === 'expired' || subscriptionStatus === 'cancelled');

  const isAccessible = ALWAYS_ACCESSIBLE.some(
    (path) => pathname === path || pathname === path + '/'
  );

  return (
    <>
      {isExpired && (
        <RenewNowDialog endedAt={trialEndedAt} isTrial={isTrial} onPay={() => setPayOpen(true)} />
      )}
      {!isExpired || isAccessible ? children : <RenewToContinue isTrial={isTrial} onPay={() => setPayOpen(true)} />}
      <CompletePaymentModal open={payOpen} onClose={() => setPayOpen(false)} />
    </>
  );
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

const BENEFITS = [
  'WhatsApp bookings & automatic reminders',
  'Billing, invoices & Customer Wallet',
  'Client history, memberships & reports',
];

/** One-time-per-session prompt encouraging the owner to complete payment. */
function RenewNowDialog({
  endedAt,
  isTrial,
  onPay,
}: {
  endedAt: string | null | undefined;
  isTrial: boolean;
  onPay: () => void;
}) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    // Show once per browser session so it isn't nagging on every navigation.
    return sessionStorage.getItem('renew_prompt_dismissed') !== '1';
  });

  if (!open) return null;

  const endedLabel = formatDate(endedAt);

  function dismiss() {
    try { sessionStorage.setItem('renew_prompt_dismissed', '1'); } catch {}
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-2xl">
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-fuchsia-600 shadow-lg shadow-fuchsia-500/30 mb-5">
            <Sparkles className="size-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Continue with SnipandGlow</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            {isTrial
              ? endedLabel
                ? `Your free trial ran until ${endedLabel}. Complete your payment now to keep your salon running without interruption.`
                : 'Your free trial period is complete. Complete your payment now to keep your salon running without interruption.'
              : endedLabel
                ? `Your plan was active until ${endedLabel}. Renew now to keep your salon running without interruption.`
                : 'Your plan needs renewal. Complete your payment now to keep your salon running without interruption.'}
          </p>

          {/* What stays switched on */}
          <div className="mt-5 w-full rounded-xl border border-border bg-muted/40 p-4 text-left">
            <p className="text-xs font-semibold text-foreground mb-2">Continue enjoying</p>
            <ul className="space-y-1.5">
              {BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/15 px-4 py-3 text-left w-full">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-800 dark:text-emerald-300">
              All your data is safe. Everything picks up right where you left off the moment your payment is complete.
            </p>
          </div>

          <div className="mt-6 flex w-full flex-col sm:flex-row gap-3">
            <button
              onClick={() => { dismiss(); onPay(); }}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-pink-500 hover:to-fuchsia-500 transition-all"
            >
              <Crown className="size-4" />
              Complete Payment
            </button>
            <button
              onClick={dismiss}
              className="inline-flex items-center justify-center rounded-xl border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Shown on gated pages — encourages completing payment rather than scolding. */
function RenewToContinue({ isTrial, onPay }: { isTrial: boolean; onPay: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-pink-200/70 dark:border-fuchsia-800/30 bg-gradient-to-br from-pink-50 via-fuchsia-50 to-violet-50 dark:from-pink-950/20 dark:via-fuchsia-950/10 dark:to-violet-950/10 p-8 sm:p-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-fuchsia-600 shadow-lg shadow-fuchsia-500/30 mb-5">
          <Sparkles className="size-7 text-white" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Complete your payment to continue</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-5">
          {isTrial
            ? 'Your free trial is complete. Finish your payment to unlock appointments, billing, customers and WhatsApp automation again — without any interruption to your salon.'
            : 'Your plan needs renewal. Complete your payment to unlock appointments, billing, customers and WhatsApp automation again — without any interruption to your salon.'}
        </p>

        {/* Benefits */}
        <ul className="mb-6 grid gap-2 text-left">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-foreground/80">
              <Check className="size-4 text-emerald-500 shrink-0 mt-0.5" />
              {b}
            </li>
          ))}
        </ul>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onPay}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-pink-500 hover:to-fuchsia-500 transition-all w-full sm:w-auto"
          >
            <Crown className="size-4" />
            Complete Payment
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors w-full sm:w-auto"
          >
            Go to Dashboard
          </Link>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/40 px-4 py-3 text-left max-w-md">
          <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-800 dark:text-emerald-300">
            Your data is safe and untouched. Everything is restored exactly as you left it as soon as your payment is complete.
          </p>
        </div>
      </div>
    </div>
  );
}
