'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import {
  Scissors, MapPin, Phone, Clock, Check, CheckCircle2, Loader2,
  Sparkles, ChevronLeft, User, Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSlotsForDate, submitBooking } from './actions';
// Type-only import — erased at compile time, so no server code enters the bundle.
import type { WebService, WebOption } from '@/lib/booking/web-booking';

interface SalonPublic {
  name: string;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  tenantCode: string;
}

interface Props {
  slug: string;
  salon: SalonPublic;
  services: WebService[];
  dates: WebOption[];
}

const STEP_LABELS = ['Services', 'Date & Time', 'Details', 'Confirm'] as const;

function formatDuration(mins: number): string {
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m} min`;
}

function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

export function BookingClient({ slug, salon, services, dates }: Props) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<WebOption[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ services: string; dateTime: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const latestDate = useRef<string | null>(null);

  // Group services by category, preserving fetch order.
  const grouped = useMemo(() => {
    const map = new Map<string, WebService[]>();
    for (const s of services) {
      const key = s.category || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries());
  }, [services]);

  const selectedServices = useMemo(
    () => services.filter((s) => selected.includes(s.id)),
    [services, selected]
  );
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);

  const phoneDigits = phone.replace(/\D/g, '');
  const phoneValid = /^[6-9]\d{9}$/.test(phoneDigits);
  const nameValid = name.trim().length >= 2;
  const detailsValid = nameValid && phoneValid;

  const canContinue =
    (step === 0 && selected.length > 0) ||
    (step === 1 && !!date && !!time) ||
    (step === 2 && detailsValid) ||
    step === 3;

  function toggleService(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

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

  function goNext() {
    if (!canContinue) return;
    setError(null);
    if (step === 0 && !date && dates.length > 0) {
      // Warm up the next step by preselecting the first available day.
      void pickDate(dates[0].id);
    }
    if (step === 3) {
      handleSubmit();
      return;
    }
    setStep((s) => Math.min(s + 1, 3));
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleSubmit() {
    if (!date || !time) return;
    setError(null);
    startTransition(async () => {
      const res = await submitBooking(slug, {
        serviceIds: selected,
        customerName: name.trim(),
        phone,
        date,
        time,
      });
      if (res.ok && res.summary) setSuccess(res.summary);
      else setError(res.error || 'Something went wrong. Please try again.');
    });
  }

  function reset() {
    setSuccess(null);
    setStep(0);
    setSelected([]);
    setDate(null);
    setTime(null);
    setSlots([]);
    setName('');
    setPhone('');
    setError(null);
  }

  const initial = (salon.name || 'S').trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-white to-violet-50 text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col">
        {/* ── Salon header ─────────────────────────────────────────── */}
        <header className="relative overflow-hidden bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 px-5 pb-7 pt-8 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 size-40 rounded-full bg-white/10 blur-2xl" />
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
                <Sparkles className="size-3" /> Book your appointment
              </p>
            </div>
          </div>
        </header>

        {/* ── Progress stepper ─────────────────────────────────────── */}
        {!success && (
          <div className="flex items-center gap-1.5 px-5 py-4">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex flex-1 flex-col gap-1.5">
                <div
                  className={cn(
                    'h-1.5 rounded-full transition-colors',
                    i < step ? 'bg-fuchsia-500' : i === step ? 'bg-fuchsia-500' : 'bg-slate-200'
                  )}
                />
                <span
                  className={cn(
                    'text-[10px] font-medium',
                    i <= step ? 'text-fuchsia-600' : 'text-slate-400'
                  )}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Content ──────────────────────────────────────────────── */}
        <main className="flex-1 px-5 pb-40">
          {success ? (
            <SuccessView salon={salon} summary={success} onReset={reset} />
          ) : (
            <>
              {step === 0 && (
                <ServicesStep
                  grouped={grouped}
                  selected={selected}
                  onToggle={toggleService}
                />
              )}

              {step === 1 && (
                <DateTimeStep
                  dates={dates}
                  date={date}
                  time={time}
                  slots={slots}
                  loading={loadingSlots}
                  onPickDate={pickDate}
                  onPickTime={setTime}
                />
              )}

              {step === 2 && (
                <DetailsStep
                  name={name}
                  phone={phone}
                  nameValid={nameValid}
                  phoneValid={phoneValid}
                  onName={setName}
                  onPhone={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                />
              )}

              {step === 3 && (
                <ReviewStep
                  salon={salon}
                  services={selectedServices}
                  totalPrice={totalPrice}
                  totalDuration={totalDuration}
                  date={date}
                  time={time}
                  name={name}
                  phone={phoneDigits}
                />
              )}

              {error && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}
            </>
          )}
        </main>

        {/* ── Sticky action bar ────────────────────────────────────── */}
        {!success && (
          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/90 backdrop-blur-md">
            <div className="mx-auto w-full max-w-xl px-5 py-3">
              {selectedServices.length > 0 && (
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''}
                    {totalDuration > 0 && ` · ${formatDuration(totalDuration)}`}
                  </span>
                  <span className="font-semibold text-slate-900">{rupees(totalPrice)}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={isPending}
                    className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
                    aria-label="Go back"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canContinue || isPending}
                  className={cn(
                    'flex h-12 flex-1 items-center justify-center gap-2 rounded-xl font-semibold text-white transition active:scale-[0.98]',
                    canContinue && !isPending
                      ? 'bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 shadow-lg shadow-fuchsia-500/30'
                      : 'cursor-not-allowed bg-slate-300'
                  )}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="size-5 animate-spin" /> Booking...
                    </>
                  ) : step === 3 ? (
                    <>
                      <Check className="size-5" /> Confirm Booking
                    </>
                  ) : (
                    'Continue'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step: Services ───────────────────────────────────────────────────────────

function ServicesStep({
  grouped,
  selected,
  onToggle,
}: {
  grouped: [string, WebService[]][];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (grouped.length === 0) {
    return (
      <EmptyState
        icon={<Scissors className="size-7 text-fuchsia-500" />}
        title="No services yet"
        subtitle="This salon hasn't published any services online. Please contact them directly."
      />
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-900">Choose your services</h2>
      {grouped.map(([category, items]) => (
        <div key={category} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{category}</h3>
          <div className="space-y-2">
            {items.map((s) => {
              const active = selected.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onToggle(s.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99]',
                    active
                      ? 'border-fuchsia-400 bg-fuchsia-50/70 ring-1 ring-fuchsia-300'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  )}
                >
                  <div
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition',
                      active ? 'border-fuchsia-500 bg-fuchsia-500 text-white' : 'border-slate-300'
                    )}
                  >
                    {active && <Check className="size-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{s.name}</p>
                    {s.durationMinutes > 0 && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="size-3" /> {formatDuration(s.durationMinutes)}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 font-semibold text-slate-900">{rupees(s.price)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Step: Date & Time ────────────────────────────────────────────────────────

function DateTimeStep({
  dates,
  date,
  time,
  slots,
  loading,
  onPickDate,
  onPickTime,
}: {
  dates: WebOption[];
  date: string | null;
  time: string | null;
  slots: WebOption[];
  loading: boolean;
  onPickDate: (d: string) => void;
  onPickTime: (t: string) => void;
}) {
  if (dates.length === 0) {
    return (
      <EmptyState
        icon={<Calendar className="size-7 text-fuchsia-500" />}
        title="No dates available"
        subtitle="This salon has no open days right now. Please check back later or contact them."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Pick a date</h2>
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {dates.map((d) => {
            const active = date === d.id;
            const [wd, dm] = d.title.includes(', ') ? d.title.split(', ') : [d.title, ''];
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onPickDate(d.id)}
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
        <h2 className="mb-3 text-lg font-bold text-slate-900">Pick a time</h2>
        {!date ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            Select a date to see available times.
          </p>
        ) : loading ? (
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
                  onClick={() => onPickTime(s.id)}
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
  );
}

// ── Step: Details ────────────────────────────────────────────────────────────

function DetailsStep({
  name,
  phone,
  nameValid,
  phoneValid,
  onName,
  onPhone,
}: {
  name: string;
  phone: string;
  nameValid: boolean;
  phoneValid: boolean;
  onName: (v: string) => void;
  onPhone: (v: string) => void;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-slate-900">Your details</h2>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Full name</label>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-fuchsia-400 focus-within:ring-1 focus-within:ring-fuchsia-300">
          <User className="size-4 shrink-0 text-slate-400" />
          <input
            type="text"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="e.g. Priya Sharma"
            autoComplete="name"
            className="h-12 w-full bg-transparent text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Mobile number</label>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-fuchsia-400 focus-within:ring-1 focus-within:ring-fuchsia-300">
          <Phone className="size-4 shrink-0 text-slate-400" />
          <span className="text-slate-500">+91</span>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => onPhone(e.target.value)}
            placeholder="10-digit number"
            autoComplete="tel-national"
            className="h-12 w-full bg-transparent text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
        {phone.length > 0 && !phoneValid && (
          <p className="text-xs text-rose-600">Enter a valid 10-digit Indian mobile number.</p>
        )}
        <p className="text-xs text-slate-400">We&apos;ll send your booking confirmation here.</p>
      </div>

      {!nameValid && name.length > 0 && (
        <p className="text-xs text-rose-600">Please enter your name.</p>
      )}
    </div>
  );
}

// ── Step: Review ─────────────────────────────────────────────────────────────

function ReviewStep({
  salon,
  services,
  totalPrice,
  totalDuration,
  date,
  time,
  name,
  phone,
}: {
  salon: SalonPublic;
  services: WebService[];
  totalPrice: number;
  totalDuration: number;
  date: string | null;
  time: string | null;
  name: string;
  phone: string;
}) {
  const dateLabel = date
    ? new Date(date + 'T12:00:00+05:30').toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : '';
  const timeLabel = time ? to12h(time) : '';

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900">Review &amp; confirm</h2>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Services</p>
        <div className="mt-2 space-y-2">
          {services.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{s.name}</span>
              <span className="font-medium text-slate-900">{rupees(s.price)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
          <span className="text-sm text-slate-500">
            Total{totalDuration > 0 && ` · ${formatDuration(totalDuration)}`}
          </span>
          <span className="text-base font-bold text-slate-900">{rupees(totalPrice)}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-600">
            <Calendar className="size-4" />
          </div>
          <div>
            <p className="font-medium text-slate-900">{dateLabel}</p>
            <p className="text-sm text-slate-500">{timeLabel} · {salon.name}</p>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-3 border-t border-slate-100 pt-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
            <User className="size-4" />
          </div>
          <div>
            <p className="font-medium text-slate-900">{name}</p>
            <p className="text-sm text-slate-500">+91 {phone}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Success ──────────────────────────────────────────────────────────────────

function SuccessView({
  salon,
  summary,
  onReset,
}: {
  salon: SalonPublic;
  summary: { services: string; dateTime: string };
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center pt-10 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg shadow-green-500/30">
        <CheckCircle2 className="size-11" />
      </div>
      <h2 className="mt-5 text-2xl font-bold text-slate-900">Booking confirmed!</h2>
      <p className="mt-1 max-w-xs text-sm text-slate-500">
        Your appointment at {salon.name} is booked. We&apos;ll send a WhatsApp confirmation shortly.
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
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">When</p>
            <p className="font-medium text-slate-900">{summary.dateTime}</p>
          </div>
        </div>
      </div>

      {salon.phone && (
        <a
          href={`tel:${salon.phone}`}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <Phone className="size-4" /> Call salon
        </a>
      )}

      <button
        type="button"
        onClick={onReset}
        className="mt-3 text-sm font-medium text-fuchsia-600 hover:underline"
      >
        Book another appointment
      </button>

      <p className="mt-8 text-xs text-slate-400">
        Powered by{' '}
        <a href="https://www.snipandglow.com" className="font-medium text-fuchsia-500 hover:underline">
          Snip &amp; Glow
        </a>
      </p>
    </div>
  );
}

// ── Shared ───────────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center pt-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-fuchsia-50">{icon}</div>
      <h2 className="mt-4 text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-1 max-w-xs text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function to12h(hhmmss: string): string {
  const [h, m] = hhmmss.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}
