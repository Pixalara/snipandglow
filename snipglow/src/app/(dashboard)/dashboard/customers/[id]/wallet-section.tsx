'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Wallet, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatINR } from '@/lib/utils';
import { addWalletBalance } from '../wallet-actions';
import type { PaymentMethod } from '@/types';

// =============================================================================
// WalletSection — shows the customer's wallet balance + an "Add Balance" button
// that opens a billing-style modal (amount, payment method, optional note).
// =============================================================================

export function WalletSection({
  customerId,
  customerName,
  balance,
}: {
  customerId: string;
  customerName: string;
  balance: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
            <Wallet className="size-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Wallet Balance</p>
            <p className="text-2xl font-bold text-foreground leading-tight">{formatINR(balance)}</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-xl gap-1.5">
          <Plus className="size-4" />
          Add Balance
        </Button>
      </div>

      {open && (
        <AddWalletModal
          customerId={customerId}
          customerName={customerName}
          currentBalance={balance}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function AddWalletModal({
  customerId,
  customerName,
  currentBalance,
  onClose,
}: {
  customerId: string;
  customerName: string;
  currentBalance: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const numericAmount = Math.round(Number(amount));
  const valid = numericAmount > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || isPending) return;
    setError('');
    startTransition(async () => {
      const result = await addWalletBalance({
        customerId,
        amount: numericAmount,
        paymentMethod,
        note: note.trim() || undefined,
      });
      if (result.success) {
        toast.success(
          `${formatINR(numericAmount)} added. New balance ${formatINR(result.data.balance)}.`
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={isPending ? undefined : onClose} aria-hidden="true" />
      <div className="relative z-10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/20">
              <Wallet className="size-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Add Wallet Balance</h2>
              <p className="text-xs text-muted-foreground">{customerName} · Current {formatINR(currentBalance)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="wallet-amount">Amount to add (₹)</Label>
            <Input
              id="wallet-amount"
              type="number"
              min={1}
              step="1"
              inputMode="numeric"
              placeholder="e.g. 1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="flex gap-2" role="radiogroup" aria-label="Payment method">
              {(['cash', 'upi', 'card'] as PaymentMethod[]).map((method) => (
                <label
                  key={method}
                  className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm transition-all ${
                    paymentMethod === method
                      ? 'border-primary bg-primary/5 text-primary font-medium shadow-sm'
                      : 'border-border text-muted-foreground hover:border-foreground/30'
                  }`}
                >
                  <input
                    type="radio"
                    name="wallet-payment-method"
                    value={method}
                    checked={paymentMethod === method}
                    onChange={() => setPaymentMethod(method)}
                    className="sr-only"
                  />
                  {method === 'upi' ? 'UPI' : method.charAt(0).toUpperCase() + method.slice(1)}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wallet-note">Note (optional)</Label>
            <Input
              id="wallet-note"
              type="text"
              placeholder="e.g. Festival top-up"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={120}
            />
          </div>

          {valid && (
            <div className="rounded-xl bg-muted/50 p-3 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">New balance</span>
              <span className="font-semibold text-foreground">{formatINR(currentBalance + numericAmount)}</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl" disabled={!valid || isPending}>
              {isPending ? 'Adding…' : 'Add & Send Receipt'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
