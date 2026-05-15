'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Crown, Lock, AlertTriangle } from 'lucide-react';

interface SubscriptionGuardProps {
  subscriptionStatus: string;
  children: React.ReactNode;
}

// Pages that are always accessible regardless of subscription status
const ALWAYS_ACCESSIBLE = ['/dashboard', '/dashboard/settings'];

export function SubscriptionGuard({ subscriptionStatus, children }: SubscriptionGuardProps) {
  const pathname = usePathname();

  const isExpired = subscriptionStatus === 'expired' || subscriptionStatus === 'cancelled';
  const isAccessible = ALWAYS_ACCESSIBLE.some(
    (path) => pathname === path || pathname === path + '/'
  );

  // If subscription is active/trial or page is always accessible, show content
  if (!isExpired || isAccessible) {
    return <>{children}</>;
  }

  // Show locked state for expired subscriptions
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-red-200 dark:border-red-800/30 bg-gradient-to-br from-red-50 via-rose-50 to-orange-50 dark:from-red-950/20 dark:via-rose-950/10 dark:to-orange-950/10 p-8 sm:p-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/30 mb-5">
          <Lock className="size-7 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Feature Locked</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          Your subscription has expired. Renew your plan to access appointments, billing, customers, and all other features.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-pink-500 hover:to-fuchsia-500 transition-all w-full sm:w-auto"
          >
            <Crown className="size-4" />
            Renew Subscription
          </Link>
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
            Your data is safe. Once you renew, everything will be restored exactly as you left it.
          </p>
        </div>
      </div>
    </div>
  );
}
