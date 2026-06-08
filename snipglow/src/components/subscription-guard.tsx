'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Crown, Lock, AlertTriangle, X } from 'lucide-react';
import { CompletePaymentModal } from '@/components/complete-payment-modal';

interface SubscriptionGuardProps {
  subscriptionStatus: string;
  /** Effective expiry (computed from trial/subscription end date). */
  isExpired?: boolean;
  /** ISO date the trial/subscription ended (for the popup message). */
  trialEndedAt?: string | null;
  children: React.ReactNode;
}

// Pages that remain accessible even when expired (so the owner can pay/manage).
const ALWAYS_ACCESSIBLE = ['/dashboard', '/dashboard/settings'];

export function SubscriptionGuard({
  subscriptionStatus,
  isExpired: isExpiredProp,
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
      {isExpired && <TrialEndedDialog endedAt={trialEndedAt} onPay={() => setPayOpen(true)} />}
      {!isExpired || isAccessible ? children : <LockedFeature onPay={() => setPayOpen(true)} />}
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

/** One-time-per-session popup shown whenever an expired tenant is in the app. */
function TrialEndedDialog({ endedAt, onPay }: { endedAt: string | null | undefined; onPay: () => void }) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    // Show once per browser session so it isn't nagging on every navigation.
    return sessionStorage.getItem('trial_ended_dismissed') !== '1';
  });

  if (!open) return null;

  const endedLabel = formatDate(endedAt);

  function dismiss() {
    try { sessionStorage.setItem('trial_ended_dismissed', '1'); } catch {}
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
            <Crown className="size-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Your free trial has ended</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            {endedLabel
              ? `Your 15-day free trial ended on ${endedLabel}. `
              : 'Your 15-day free trial has ended. '}
            Please complete the payment to continue using SnipandGlow without interruption.
          </p>

          <div className="mt-6 w-full rounded-xl bg-muted/50 border border-border p-4 text-left">
            <p className="text-xs text-muted-foreground">
              Your data is safe. Appointments, billing, customers, and WhatsApp automation are
              paused until you renew - everything is restored the moment payment is complete.
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

/** Locked content shown on gated pages when expired. */
function LockedFeature({ onPay }: { onPay: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 dark:border-red-800/30 bg-gradient-to-br from-red-50 via-rose-50 to-orange-50 dark:from-red-950/20 dark:via-rose-950/10 dark:to-orange-950/10 p-8 sm:p-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/30 mb-5">
          <Lock className="size-7 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Feature Locked</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          Your free trial has ended. Complete your payment to unlock appointments, billing,
          customers, and all other features.
        </p>

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
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors w-full sm:w-auto"
          >
            Go to Dashboard
          </Link>
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 px-4 py-3 text-left max-w-md">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Your data is safe. Once you complete payment, everything will be restored exactly as you left it.
          </p>
        </div>
      </div>
    </div>
  );
}
