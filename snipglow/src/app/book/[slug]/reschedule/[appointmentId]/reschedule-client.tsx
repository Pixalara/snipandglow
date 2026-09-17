'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  MapPin, Clock, CheckCircle2, Loader2, Calendar, RefreshCw, Scissors, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSlotsForDate, submitReschedule } from '../../actions';
import type { AppointmentContext, WebOption } from '@/lib/booking/web-booking';

interface SalonPublic {
  name: string;
  /** City, State — a short public location, not the full street address. */
  location: string | null;
  phone: string | null;
  logoUrl: string | null;
  tenantCode: string;
}

interface Props {
  slug: string;
  appointmentId: string;
  salon: SalonPublic;
  context: AppointmentContext;
  dates: WebOption[];
}

function to12h(hhmmss: string): string {
  const [h, m] = hhmmss.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}

export function RescheduleClient({ slug, appointmentId, salon, context, dates }: Props) {
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<WebOption[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ services: string; dateTime: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const latestDate = useRef<string | null>(null);

  async function pickDate(d: string) {
    setDate(d);
    setTime(null);
    setSlots([]);
    setError(null);
    setLoadingSlots(true);
    latestDate.current = d;
    try {
      const s = await getSlotsForDate(slug, d);
      if (latestDate.current === d) setSlots(s);
    } finally {
      if (latestDate.current === d) setLoadingSlots(false);
    }
  }

  // Warm up with the appointment's current day if it's still open, else day one.
  useEffect(() => {
    if (dates.length === 0) return;
    const initial = dates.find((d) => d.id === context.currentDate)?.id ?? dates[0].id;
    void pickDate(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit() {
    if (!date || !time) return;
    setError(null);
    startTransition(async () => {
      const res = await submitReschedule(slug, appointmentId, { date, time });
      if (res.ok && res.summary) setSuccess(res.summary);
      else setError(res.error || 'Something went wrong. Please try again.');
    });
  }

  const initial = (salon.name || 'S').trim().charAt(0).toUpperCase();
  const canConfirm = !!date && !!time && !isPending;

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
              {salon.location && (
                <p className="mt-0.5 flex items-center gap-1 text-sm text-white/85">
                  <MapPin className="size-3.5 shrink-0" />
                  <span className="truncate">{salon.location}</span>
                </p>
              )}
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white/90">
                <RefreshCw className="size-3" /> Reschedule appointment
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 px-5 pb-40 pt-5">
          {success ? (
            <SuccessView salon={salon} summary={success} bookSlug={slug} />
          ) : (
            <>
              {/* Current appointment */}
              <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current appointment</p>
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

              {dates.length === 0 ? (
                <p className="rounded-xl bg-amber-50 px-4 py-6 text-center text-sm text-amber-700">
                  No open days right now. Please contact the salon to reschedule.
                </p>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h2 className="mb-3 text-lg font-bold text-slate-900">Pick a new date</h2>
                    <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {dates.map((d) => {
                        const active = date === d.id;
                        const [wd, dm] = d.title.includes(', ') ? d.title.split(', ') : [d.title, ''];
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => pickDate(d.id)}
                            className={cn(
                              'flex min-w-[64px] flex-col items-center rounded-2xl border px-3 py-2.5 transition active:scale-95',
                              active
                                ? 'border-transparent bg-gradient-to-br from-pink-500 to-violet-500 text-white shadow-md shadow-fuchsia-500/30'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            )}
                          >
                            <span className={cn('text-[11px] font-medium', active ? 'text-white/90' : 'text-slate-400')}>
                              {wd}
                            </span>
                            <span className="text-sm font-semibold">{dm || d.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h2 className="mb-3 text-lg font-bold text-slate-900">Pick a new time</h2>
                    {!date || loadingSlots ? (
                      <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
                        <Loader2 className="size-5 animate-spin" /> Loading times...
                      </div>
                    ) : slots.length === 0 ? (
                      <p className="rounded-xl bg-amber-50 px-4 py-6 text-center text-sm text-amber-700">
                        No open slots for this day. Please try another date.
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {slots.map((s) => {
                          const active = time === s.id;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setTime(s.id)}
                              className={cn(
                                'rounded-xl border py-2.5 text-sm font-medium transition active:scale-95',
                                active
                                  ? 'border-transparent bg-gradient-to-r from-pink-500 to-violet-500 text-white shadow-md shadow-fuchsia-500/30'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-fuchsia-300'
                              )}
                            >
                              {s.title}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}
            </>
          )}
        </main>

        {/* ── Sticky confirm bar ───────────────────────────────────── */}
        {!success && dates.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/90 backdrop-blur-md">
            <div className="mx-auto w-full max-w-xl px-5 py-3">
              {time && date && (
                <p className="mb-2 text-center text-sm text-slate-500">
                  New time: <span className="font-semibold text-slate-900">{to12h(time)}</span>
                </p>
              )}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canConfirm}
                className={cn(
                  'flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold text-white transition active:scale-[0.98]',
                  canConfirm
                    ? 'bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 shadow-lg shadow-fuchsia-500/30'
                    : 'cursor-not-allowed bg-slate-300'
                )}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-5 animate-spin" /> Rescheduling...
                  </>
                ) : (
                  <>
                    <Check className="size-5" /> Confirm new time
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SuccessView({
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
      <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg shadow-green-500/30">
        <CheckCircle2 className="size-11" />
      </div>
      <h2 className="mt-5 text-2xl font-bold text-slate-900">Appointment rescheduled!</h2>
      <p className="mt-1 max-w-xs text-sm text-slate-500">
        Your appointment at {salon.name} has been moved. We&apos;ll send a WhatsApp confirmation shortly.
      </p>

      <div className="mt-6 w-full rounded-2xl border border-slate-200 bg-white p-4 text-left">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-600">
            <Scissors className="size-4" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Services</p>
            <p className="font-medium text-slate-900">{summary.services}</p>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-3 border-t border-slate-100 pt-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
            <Calendar className="size-4" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">New time</p>
            <p className="font-medium text-slate-900">{summary.dateTime}</p>
          </div>
        </div>
      </div>

      <a
        href={`/book/${bookSlug}`}
        className="mt-4 text-sm font-medium text-fuchsia-600 hover:underline"
      >
        Book another appointment
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
