'use client';

import { useState } from 'react';
import { Crown, RefreshCw } from 'lucide-react';
import { CompletePaymentModal } from '@/components/complete-payment-modal';

/**
 * Opens the Razorpay checkout modal. Used in Settings for three cases:
 *   • expired  → "Complete Payment"
 *   • trial    → "Subscribe Now"
 *   • active   → "Renew Early" (extend before expiry; days are never lost)
 */
export function RenewButton({
  label = 'Complete Payment',
  variant = 'primary',
  icon = 'crown',
  fullWidth = true,
}: {
  label?: string;
  variant?: 'primary' | 'outline';
  icon?: 'crown' | 'refresh';
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const base = `inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all ${
    fullWidth ? 'w-full sm:w-auto' : ''
  }`;
  const styles =
    variant === 'outline'
      ? 'border border-border bg-card text-foreground hover:bg-muted'
      : 'bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white shadow-lg hover:from-pink-500 hover:to-fuchsia-500';

  return (
    <>
      <button onClick={() => setOpen(true)} className={`${base} ${styles}`}>
        {icon === 'refresh' ? <RefreshCw className="size-4" /> : <Crown className="size-4" />}
        {label}
      </button>
      <CompletePaymentModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
