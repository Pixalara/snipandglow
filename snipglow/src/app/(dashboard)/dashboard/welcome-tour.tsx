'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Users,
  Calendar,
  Receipt,
  BarChart3,
  Settings as SettingsIcon,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
} from 'lucide-react';
import { markTourSeen } from './tour-actions';

// =============================================================================
// First-run product tour.
//
// Shown once to a newly signed-up salon owner, walking through the five things
// they'll actually use, in the order they'll use them:
//   Customers -> Appointments -> Billing -> Analytics -> Settings
//
// Each step links straight to the relevant screen, so the tour doubles as a
// launchpad rather than just a slideshow. Completion is recorded server-side
// (per salon) with a localStorage guard for instant dismissal.
// =============================================================================

const STEPS = [
  {
    key: 'customers',
    icon: Users,
    title: 'Add your customers',
    what: 'Your client book, online.',
    body:
      'Save clients with their phone number and every visit, service, note and payment stays on their profile automatically. New clients are also created for you when they book on WhatsApp.',
    tip: 'Start by adding a few regulars - you can bulk-add the rest as they visit.',
    href: '/dashboard/customers',
    cta: 'Go to Customers',
    accent: 'from-violet-500 to-purple-600',
    ring: 'ring-violet-200 dark:ring-violet-900/40',
  },
  {
    key: 'appointments',
    icon: Calendar,
    title: 'Manage appointments',
    what: 'Bookings, without the phone calls.',
    body:
      'Book in seconds from the dashboard, or let clients book themselves on WhatsApp. See your day in list or calendar view, reschedule with a tap, and automatic reminders go out before every visit.',
    tip: 'Reminders are what cut no-shows - they run on their own once bookings exist.',
    href: '/dashboard/appointments',
    cta: 'Go to Appointments',
    accent: 'from-blue-500 to-indigo-600',
    ring: 'ring-blue-200 dark:ring-blue-900/40',
  },
  {
    key: 'billing',
    icon: Receipt,
    title: 'Bill in seconds',
    what: 'GST-ready invoices, sent on WhatsApp.',
    body:
      'Search services or products by name or category, apply a discount, pick cash / UPI / card - or the customer wallet - and the receipt reaches your client on WhatsApp instantly.',
    tip: 'Completing an appointment can generate the bill for you in one step.',
    href: '/dashboard/billing',
    cta: 'Go to Billing',
    accent: 'from-fuchsia-500 to-pink-600',
    ring: 'ring-fuchsia-200 dark:ring-fuchsia-900/40',
  },
  {
    key: 'analytics',
    icon: BarChart3,
    title: 'See what is working',
    what: 'Revenue and trends at a glance.',
    body:
      'Track daily, weekly and monthly revenue, your top services, staff performance, busy hours and product margins. Filter by month or any custom date range, and export to Excel.',
    tip: 'Check peak hours to decide staffing - it is the fastest win in here.',
    href: '/dashboard/analytics',
    cta: 'Go to Revenue',
    accent: 'from-emerald-500 to-teal-600',
    ring: 'ring-emerald-200 dark:ring-emerald-900/40',
  },
  {
    key: 'settings',
    icon: SettingsIcon,
    title: 'Finish your setup',
    what: 'Make it yours.',
    body:
      'Add your salon timings, GST details, WhatsApp booking link and QR code, default discounts and staff logins. Your subscription and payment history live here too.',
    tip: 'Grab your WhatsApp booking QR code and put it at your reception desk.',
    href: '/dashboard/settings',
    cta: 'Go to Settings',
    accent: 'from-amber-500 to-orange-600',
    ring: 'ring-amber-200 dark:ring-amber-900/40',
  },
] as const;

const LOCAL_KEY = 'sg_tour_seen';

export function WelcomeTour({ salonName }: { salonName?: string }) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(LOCAL_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [i, setI] = useState(0);
  const [, startTransition] = useTransition();

  function finish() {
    try { window.localStorage.setItem(LOCAL_KEY, '1'); } catch { /* ignore */ }
    setOpen(false);
    // Record per-salon so other devices don't replay the tour.
    startTransition(() => { void markTourSeen(); });
  }

  if (!open) return null;

  const step = STEPS[i];
  const isLast = i === STEPS.length - 1;
  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={finish} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Getting started tour"
        className="relative z-10 w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Getting started · {i + 1} of {STEPS.length}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground truncate">
              {i === 0 && salonName ? `Welcome, ${salonName}!` : 'Your quick tour'}
            </p>
          </div>
          <button
            onClick={finish}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Skip tour"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 px-5 pt-4 sm:px-6">
          {STEPS.map((s, idx) => (
            <button
              key={s.key}
              onClick={() => setI(idx)}
              aria-label={`Step ${idx + 1}: ${s.title}`}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                idx <= i ? 'bg-gradient-to-r from-pink-500 to-fuchsia-500' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="px-5 py-5 sm:px-6">
          <div className={`flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br ${step.accent} shadow-lg ring-4 ${step.ring}`}>
            <Icon className="size-7 text-white" />
          </div>

          <h2 className="mt-4 text-xl font-bold text-foreground">{step.title}</h2>
          <p className="mt-0.5 text-sm font-medium text-fuchsia-600 dark:text-fuchsia-400">{step.what}</p>
          <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-900/15 px-3.5 py-3">
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs text-emerald-800 dark:text-emerald-300">{step.tip}</p>
          </div>

          <Link
            href={step.href}
            onClick={finish}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-fuchsia-600 hover:text-fuchsia-700 dark:text-fuchsia-400"
          >
            {step.cta}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4 sm:px-6">
          {i > 0 ? (
            <button
              onClick={() => setI((n) => n - 1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
          ) : (
            <button
              onClick={finish}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Skip tour
            </button>
          )}

          {isLast ? (
            <button
              onClick={finish}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-pink-500 hover:to-fuchsia-500 transition-all"
            >
              <Check className="size-4" />
              Start using SnipandGlow
            </button>
          ) : (
            <button
              onClick={() => setI((n) => n + 1)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-pink-500 hover:to-fuchsia-500 transition-all"
            >
              Next
              <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
