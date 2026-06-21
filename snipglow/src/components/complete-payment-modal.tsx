'use client';

import { useState } from 'react';
import { X, Crown, CheckCircle2, Phone, Copy, Check } from 'lucide-react';
import { requestSubscriptionRenewal } from '@/app/(dashboard)/dashboard/settings/renewal-actions';

// =============================================================================
// Complete Payment modal (interim — Razorpay checkout pending).
//
// Shows payment instructions and lets the owner submit a renewal request that
// alerts the platform team. Once Razorpay is live, swap the request button for
// a real checkout handler.
// =============================================================================

// Support contact for offline renewal (matches the homepage WhatsApp number).
const SUPPORT_PHONE = '9449602995';
const SUPPORT_UPI = 'snipandglow@upi'; // TODO: replace with the real UPI ID when available.

export function CompletePaymentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  if (!open) return null;

  async function handleRequest() {
    setSubmitting(true);
    setError('');
    const res = await requestSubscriptionRenewal();
    if (res.success) {
      // Send the team notification email from the browser — Web3Forms reliably
      // accepts requests with a real page Origin (server-side calls can be
      // silently dropped). The server already recorded the request.
      try {
        const payload = res.data?.emailPayload;
        if (payload) {
          await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }
      } catch {
        /* non-fatal: the request is already recorded for the admin */
      }
      setSubmitting(false);
      setSent(true);
    } else {
      setSubmitting(false);
      setError(res.error);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    }).catch(() => {});
  }

  const waLink = `https://wa.me/91${SUPPORT_PHONE}?text=${encodeURIComponent('Hi, I want to renew my SnipandGlow subscription.')}`;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>

        {sent ? (
          <div className="flex flex-col items-center text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 mb-5">
              <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Renewal request sent</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Our team has been notified and will reach out shortly to complete your payment and
              reactivate your account. You can also message us on WhatsApp to speed things up.
            </p>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-all w-full"
            >
              <Phone className="size-4" />
              Message us on WhatsApp
            </a>
            <button onClick={onClose} className="mt-3 text-sm text-muted-foreground hover:text-foreground">
              Close
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex flex-col items-center text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-fuchsia-600 shadow-lg shadow-fuchsia-500/30 mb-4">
                <Crown className="size-7 text-white" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Renew your subscription</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                Online card payments are launching soon. For now, renew in a minute - pay via UPI or
                let our team take care of it. Tap below and we&apos;ll reactivate your account right away.
              </p>
            </div>

            {/* Payment details */}
            <div className="mt-5 space-y-2.5">
              <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pay via UPI</p>
                  <p className="text-sm font-semibold text-foreground">{SUPPORT_UPI}</p>
                </div>
                <button
                  onClick={() => copy(SUPPORT_UPI, 'upi')}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {copied === 'upi' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  {copied === 'upi' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Or call / WhatsApp</p>
                  <p className="text-sm font-semibold text-foreground">+91 {SUPPORT_PHONE}</p>
                </div>
                <button
                  onClick={() => copy(SUPPORT_PHONE, 'phone')}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {copied === 'phone' ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                  {copied === 'phone' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-red-600 text-center">{error}</p>}

            <button
              onClick={handleRequest}
              disabled={submitting}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-pink-500 hover:to-fuchsia-500 transition-all disabled:opacity-60"
            >
              {submitting ? 'Sending request…' : 'Request renewal & notify team'}
            </button>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Phone className="size-4" />
              Message us on WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
