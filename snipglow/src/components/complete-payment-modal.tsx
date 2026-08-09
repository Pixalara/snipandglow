'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, CheckCircle2, Phone, ShieldCheck, Loader2 } from 'lucide-react';

// =============================================================================
// Complete Payment modal — live Razorpay Checkout.
//
// Flow:
//   1. POST /api/payments/create-order  → server computes the amount from the
//      tenant's plan (the browser never sends a price) and returns an order id.
//   2. Razorpay Checkout opens (UPI / cards / netbanking / wallets).
//   3. POST /api/payments/verify        → server re-verifies the signature and
//      extends the subscription. A webhook covers the case where the tab closes.
//
// If payments aren't configured (503), we fall back to the WhatsApp/manual path.
// =============================================================================

const SUPPORT_PHONE = '9449602995';
const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }
}

/** Load the Checkout script once. */
function loadCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const s = document.createElement('script');
    s.src = CHECKOUT_SRC;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

interface OrderResponse {
  orderId: string;
  testCharge?: boolean;
  amount: number;
  currency: string;
  keyId: string;
  months: number;
  cycle: 'monthly' | 'yearly';
  salonName: string;
  contact: string;
  email: string;
}

type Cycle = 'monthly' | 'yearly';

interface PlanOption {
  cycle: Cycle;
  amount: number;
  months: number;
  perMonth: number;
  periodStart: string;
  periodEnd: string;
}

interface PlansResponse {
  planLabel: string;
  currentCycle: Cycle;
  yearlyDiscountPct: number;
  customRate: boolean;
  options: PlanOption[];
}

/** "25 Aug 2026" in IST - the customer's calendar. */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function CompletePaymentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [amountLabel, setAmountLabel] = useState('');
  const [plans, setPlans] = useState<PlansResponse | null>(null);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [plansFailed, setPlansFailed] = useState(false);
  // Derived rather than stored, so the effect never needs a synchronous setState.
  const loadingPlans = open && !plans && !plansFailed;

  // Warm the Checkout script so the first tap opens instantly.
  useEffect(() => { if (open) void loadCheckout(); }, [open]);

  // Load the monthly/yearly choices. Prices are server-computed so a negotiated
  // rate shows correctly and the browser never proposes an amount.
  useEffect(() => {
    if (!open || plans || plansFailed) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/payments/plans');
        if (cancelled) return;
        if (!res.ok) {
          // Non-fatal: Pay now still works, using the tenant's saved cycle.
          setPlansFailed(true);
          return;
        }
        const data = (await res.json()) as PlansResponse;
        if (cancelled) return;
        setPlans(data);
        setCycle(data.currentCycle);
      } catch {
        if (!cancelled) setPlansFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [open, plans, plansFailed]);

  if (!open) return null;

  const selected = plans?.options.find((o) => o.cycle === cycle) ?? null;

  const waLink = `https://wa.me/91${SUPPORT_PHONE}?text=${encodeURIComponent('Hi, I want to renew my SnipandGlow subscription.')}`;

  async function handlePay() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send the chosen cycle; omitting it lets the server use the saved one.
        body: JSON.stringify(cycle ? { cycle } : {}),
      });

      if (res.status === 503) {
        setUnavailable(true);
        setBusy(false);
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || 'Could not start the payment. Please try again.');
        setBusy(false);
        return;
      }

      const order = (await res.json()) as OrderResponse;
      setAmountLabel(
        `₹${(order.amount / 100).toLocaleString('en-IN')} · ${order.cycle === 'yearly' ? '12 months' : '1 month'}${
          order.testCharge ? ' · TEST' : ''
        }`
      );
      const ready = await loadCheckout();
      if (!ready || !window.Razorpay) {
        setError('Could not load the payment window. Check your connection and try again.');
        setBusy(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'SnipandGlow',
        description: `Subscription · ${order.cycle === 'yearly' ? '12 months' : '1 month'}`,
        image: 'https://snipandglow.com/android-chrome-512x512.png',
        prefill: {
          name: order.salonName || undefined,
          email: order.email || undefined,
          contact: order.contact || undefined,
        },
        theme: { color: '#db2777' },
        modal: {
          ondismiss: () => setBusy(false),
        },
        handler: async (resp: Record<string, string>) => {
          try {
            const v = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
              }),
            });
            if (v.ok) {
              setPaid(true);
              setBusy(false);
              // Clear the "renew" prompt for this session and refresh server state.
              try { sessionStorage.removeItem('renew_prompt_dismissed'); } catch {}
              router.refresh();
            } else {
              const j = await v.json().catch(() => ({}));
              // Payment succeeded at Razorpay; the webhook will reconcile.
              setError(j.error || 'Payment received. Activation is being confirmed — please refresh in a minute.');
              setBusy(false);
            }
          } catch {
            setError('Payment received. Activation is being confirmed — please refresh in a minute.');
            setBusy(false);
          }
        },
      });

      rzp.open();
    } catch {
      setError('Something went wrong starting the payment. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto">
        {paid ? (
          <div className="flex flex-col items-center text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 mb-5">
              <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Payment successful</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Your subscription is active again. Everything is restored exactly as you left it — thank you!
            </p>
            <button
              onClick={() => { onClose(); router.refresh(); }}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-pink-500 hover:to-fuchsia-500 transition-all"
            >
              Continue to dashboard
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex flex-col items-center text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-fuchsia-600 shadow-lg shadow-fuchsia-500/30 mb-4">
                <Crown className="size-7 text-white" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Complete your payment</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                Pay securely with UPI, card, net banking or wallet. Your salon keeps running without
                interruption the moment payment is complete.
              </p>
              {amountLabel && (
                <p className="mt-3 text-2xl font-bold text-foreground">{amountLabel}</p>
              )}
            </div>

            {/* Billing cycle choice. Hidden when plans can't be loaded, in which
                case the server falls back to the tenant's saved cycle. */}
            {!unavailable && (loadingPlans || plans) && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Choose your plan
                </p>

                {loadingPlans && !plans ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading plans…
                  </div>
                ) : (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {plans?.options.map((opt) => {
                      const active = opt.cycle === cycle;
                      return (
                        <button
                          key={opt.cycle}
                          type="button"
                          onClick={() => setCycle(opt.cycle)}
                          disabled={busy}
                          aria-pressed={active}
                          className={`relative rounded-xl border p-3 text-left transition-all disabled:opacity-60 ${
                            active
                              ? 'border-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-900/20 ring-2 ring-fuchsia-500/30'
                              : 'border-border hover:border-fuchsia-300 hover:bg-muted/50'
                          }`}
                        >
                          {opt.cycle === 'yearly' && (plans?.yearlyDiscountPct ?? 0) > 0 && (
                            <span className="absolute -top-2 right-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                              SAVE {plans?.yearlyDiscountPct}%
                            </span>
                          )}
                          <span className="block text-sm font-semibold text-foreground">
                            {opt.cycle === 'yearly' ? 'Yearly' : 'Monthly'}
                          </span>
                          <span className="mt-0.5 block text-lg font-bold text-foreground">
                            {inr(opt.amount)}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {opt.cycle === 'yearly'
                              ? `${inr(opt.perMonth)}/mo · billed yearly`
                              : 'per month'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selected && (
                  <p className="mt-2.5 text-xs text-muted-foreground">
                    Active from{' '}
                    <span className="font-semibold text-foreground">
                      {fmtDate(selected.periodStart)}
                    </span>{' '}
                    to{' '}
                    <span className="font-semibold text-foreground">
                      {fmtDate(selected.periodEnd)}
                    </span>
                    .
                  </p>
                )}
              </div>
            )}

            {unavailable ? (
              <div className="mt-5 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/15 p-4">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Online payment isn&apos;t available right now. Message us on WhatsApp and we&apos;ll
                  activate your account straight away.
                </p>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-3">
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                  </div>
                )}

                <button
                  onClick={handlePay}
                  disabled={busy}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-pink-500 hover:to-fuchsia-500 transition-all disabled:opacity-60"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Crown className="size-4" />}
                  {busy ? 'Opening payment…' : selected ? `Pay ${inr(selected.amount)}` : 'Pay now'}
                </button>

                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  Secured by Razorpay · UPI, cards & net banking
                </div>
              </>
            )}

            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Phone className="size-4" />
              Need help? Message us
            </a>

            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="mt-2 inline-flex items-center justify-center rounded-xl px-6 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
