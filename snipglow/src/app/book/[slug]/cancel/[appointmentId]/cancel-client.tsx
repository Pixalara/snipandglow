'use client';

import { useState, useTransition } from 'react';
import {
  MapPin, Clock, Scissors, Calendar, Loader2, XCircle, CheckCircle2,
  RefreshCw, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { submitCancellation } from '../../actions';
import type { AppointmentContext } from '@/lib/booking/web-booking';

interface SalonPublic {
  name: string;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  tenantCode: string;
}

interface Props {
  slug: string;
  appointmentId: string;
  salon: SalonPublic;
  context: AppointmentContext;
}

export function CancelClient({ slug, appointmentId, salon, context }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<'cancelled' | 'kept' | null>(null);
  const [summary, setSummary] = useState<{ services: string; dateTime: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const res = await submitCancellation(slug, appointmentId);
      if (res.ok && res.summary) {
        setSummary(res.summary);
        setOutcome('cancelled');
      } else {
        setError(res.error || 'Something went wrong. Please try again.');
      }
    });
  }

  const initial = (salon.name || 'S').trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-violet-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="relative overflow-hidden bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 px-5 pb-7 pt-8 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/20 shadow-inner ring-1 ring-white/30 backdrop-blur-sm">
              {salon.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={salon.logoUrl} alt={salon.name} className="size-full object-cover" />
              ) : (
                <span className="text-2xl font-bold">{initial}</span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold leading-tight">{salon.name}</h1>
              {salon.address && (
                <p className="mt-0.5 flex items-center gap-1 text-sm text-white/85">
                  <MapPin className="size-3.5 shrink-0" />
                  <span className="truncate">{salon.address}</span>
                </p>
              )}
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white/90">
                <XCircle className="size-3" /> Cancel appointment
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 px-5 pb-40 pt-5">
          {outcome === 'cancelled' && summary ? (
            <CancelledView salon={salon} summary={summary} bookSlug={slug} />
          ) : outcome === 'kept' ? (
            <KeptView context={context} />
          ) : (
            <>
              {/* Appointment to cancel */}
              <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your appointment</p>
                <div className="mt-2 flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-600">
                    <Scissors className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{context.serviceNames}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
                      <Clock className="size-3.5" /> {context.currentLabel}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>Are you sure you want to cancel? This can&apos;t be undone — you&apos;d need to book again.</p>
              </div>

              <a
                href={`/book/${slug}/reschedule/${appointmentId}`}
                className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw className="size-4 text-fuchsia-500" /> Reschedule instead
              </a>

              {error && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}
            </>
          )}
        </main>

        {/* ── Sticky action bar (only on the confirm screen) ───────── */}
        {!outcome && (
          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/90 backdrop-blur-md">
            <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-5 py-3">
              <button
                type="button"
                onClick={() => setOutcome('kept')}
                disabled={isPending}
                className="h-12 flex-1 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className={cn(
                  'flex h-12 flex-1 items-center justify-center gap-2 rounded-xl font-semibold text-white transition active:scale-[0.98]',
                  isPending ? 'cursor-wait bg-rose-400' : 'bg-rose-600 shadow-lg shadow-rose-500/30 hover:bg-rose-700'
                )}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-5 animate-spin" /> Cancelling...
                  </>
                ) : (
                  'Cancel appointment'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CancelledView({
  salon,
  summary,
  bookSlug,
}: {
  salon: SalonPublic;
  summary: { services: string; dateTime: string };
  bookSlug: string;
}) {
  return (
    <div className="flex flex-col items-center pt-10 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-slate-100 text-rose-500">
        <XCircle className="size-11" />
      </div>
      <h2 className="mt-5 text-2xl font-bold text-slate-900">Appointment cancelled</h2>
      <p className="mt-1 max-w-xs text-sm text-slate-500">
        Your appointment at {salon.name} has been cancelled. We hope to see you again soon.
      </p>

      <div className="mt-6 w-full rounded-2xl border border-slate-200 bg-white p-4 text-left">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Scissors className="size-4" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cancelled</p>
            <p className="font-medium text-slate-900">{summary.services}</p>
            <p className="text-sm text-slate-500">{summary.dateTime}</p>
          </div>
        </div>
      </div>

      <a
        href={`/book/${bookSlug}`}
        className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 py-3 font-semibold text-white shadow-lg shadow-fuchsia-500/30"
      >
        Book a new appointment
      </a>

      <p className="mt-8 text-xs text-slate-400">
        Powered by{' '}
        <a href="https://www.snipandglow.com" className="font-medium text-fuchsia-500 hover:underline">
          Snip &amp; Glow
        </a>
      </p>
    </div>
  );
}

function KeptView({ context }: { context: AppointmentContext }) {
  return (
    <div className="flex flex-col items-center pt-10 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg shadow-green-500/30">
        <CheckCircle2 className="size-11" />
      </div>
      <h2 className="mt-5 text-2xl font-bold text-slate-900">Your appointment is still on</h2>
      <p className="mt-1 max-w-xs text-sm text-slate-500">
        Great — nothing has changed. We look forward to seeing you!
      </p>

      <div className="mt-6 w-full rounded-2xl border border-slate-200 bg-white p-4 text-left">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-600">
            <Calendar className="size-4" />
          </div>
          <div>
            <p className="font-medium text-slate-900">{context.serviceNames}</p>
            <p className="text-sm text-slate-500">{context.currentLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
