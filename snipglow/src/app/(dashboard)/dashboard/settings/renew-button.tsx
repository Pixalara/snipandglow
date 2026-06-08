'use client';

import { useState } from 'react';
import { Crown } from 'lucide-react';
import { CompletePaymentModal } from '@/components/complete-payment-modal';

/** Settings "Complete Payment" button that opens the interim renewal modal. */
export function RenewButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-pink-500 hover:to-fuchsia-500 transition-all"
      >
        <Crown className="size-4" />
        Complete Payment — ₹799/mo
      </button>
      <CompletePaymentModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
