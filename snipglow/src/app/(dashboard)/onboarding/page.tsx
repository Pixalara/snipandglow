'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { completeOnboarding } from './actions';
import { createClient as createBrowserSupabase } from '@/lib/supabase/client';
import { trackSignupConversion } from '@/lib/analytics/gtag';
import { realEmail, verifiedPhone } from '@/lib/auth/signup-state';
import { tenDigitPhone } from '@/lib/auth/otp';
import {
  Store,
  MapPin,
  Scissors,
  Check,
  CheckCircle2,
  Mail,
  MessageCircle,
  Plus,
  X,
  AlertTriangle,
  Loader2,
  Sparkles,
} from 'lucide-react';

// =============================================================================
// Salon setup — the final step of signup.
//
// By the time anyone reaches this page they have already proved BOTH factors:
// Google (a real email) and a WhatsApp OTP. The identity panel restates those so
// the owner can see exactly what the account is tied to, and the phone field is
// intentionally read-only — the verified number is authoritative, and
// `completeOnboarding` no longer accepts a phone from the form at all.
// =============================================================================

interface ServiceEntry {
  name: string;
  category: string;
  duration_minutes: number;
  price: number;
}

const CATEGORIES = ['Hair', 'Skin', 'Nails', 'Spa'] as const;

const STEPS = [
  { n: 1, label: 'Your salon', icon: Store },
  { n: 2, label: 'Location & hours', icon: MapPin },
  { n: 3, label: 'Services', icon: Scissors },
] as const;

/** Pretty-print a 12-digit number as +91 98765 43210. */
function prettyPhone(raw: string | null): string {
  if (!raw) return '';
  const ten = tenDigitPhone(raw);
  return ten.length === 10 ? `+91 ${ten.slice(0, 5)} ${ten.slice(5)}` : `+${raw}`;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verified identity, read from the session for display and prefill.
  const [identity, setIdentity] = useState<{ email: string | null; phone: string | null } | null>(null);

  // Step 1
  const [salonName, setSalonName] = useState('');
  const [ownerName, setOwnerName] = useState('');

  // Step 2
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('21:00');

  // Step 3
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [newService, setNewService] = useState<ServiceEntry>({
    name: '',
    category: 'Hair',
    duration_minutes: 30,
    price: 500,
  });

  // Which fields the user has left, so errors appear on blur rather than
  // shouting at someone who is still typing.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;
      setIdentity({ email: realEmail(user), phone: verifiedPhone(user) });
      // Seed the owner's name from Google so there is one less thing to type.
      const googleName = (user.user_metadata?.full_name || user.user_metadata?.name) as string | undefined;
      if (googleName) setOwnerName((cur) => cur || googleName);
    })();
    return () => { active = false; };
  }, []);

  // ─── Per-field validation ───────────────────────────────────────────────
  const errors: Record<string, string | null> = {
    salonName: !salonName.trim()
      ? 'Please enter your salon name.'
      : salonName.trim().length < 2
        ? 'That looks too short.'
        : null,
    ownerName: !ownerName.trim() ? 'Please enter your name.' : null,
    branchAddress: !branchAddress.trim() ? 'Please enter the street address.' : null,
    city: !city.trim() ? 'Please enter the city.' : null,
    state: !state.trim() ? 'Please enter the state.' : null,
    pincode: !/^\d{6}$/.test(pincode) ? 'Enter a 6-digit pincode.' : null,
    closeTime: closeTime <= openTime ? 'Closing time must be after opening time.' : null,
  };

  const stepFields: Record<number, string[]> = {
    1: ['salonName', 'ownerName'],
    2: ['branchAddress', 'city', 'state', 'pincode', 'closeTime'],
    3: [],
  };

  const stepValid = (n: number) => stepFields[n].every((f) => !errors[f]);

  /** Show an error only once the field has been touched. */
  const shown = (f: string) => (touched[f] ? errors[f] : null);

  function goNext() {
    // Reveal everything wrong on this step rather than silently refusing.
    setTouched((t) => ({ ...t, ...Object.fromEntries(stepFields[step].map((f) => [f, true])) }));
    if (!stepValid(step)) return;
    setError(null);
    setStep((s) => Math.min(3, s + 1));
  }

  const addService = () => {
    if (!newService.name.trim()) return;
    setServices((prev) => [...prev, { ...newService, name: newService.name.trim() }]);
    setNewService({ name: '', category: 'Hair', duration_minutes: 30, price: 500 });
  };

  const removeService = (index: number) => setServices((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Note: no `phone` — the server uses the WhatsApp-verified number.
    const result = await completeOnboarding({
      salonName,
      ownerName,
      branchName: branchName.trim() || salonName,
      branchAddress,
      city,
      state,
      pincode,
      openTime,
      closeTime,
      services: services.length > 0 ? services : undefined,
    });

    if (!result.success) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Signup is genuinely complete (tenant + branch exist), so this is the right
    // point to report the conversion. Deduped by tenant id.
    trackSignupConversion(result.data?.tenantId);

    // Refresh so the JWT carries the new tenant_id before we navigate, otherwise
    // middleware still sees a tenant-less session and bounces back here.
    const supabase = createBrowserSupabase();
    await supabase.auth.refreshSession();
    router.push('/dashboard?welcome=true');
  }, [salonName, ownerName, branchName, branchAddress, city, state, pincode, openTime, closeTime, services, router]);

  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts: { placeholder?: string; required?: boolean; inputMode?: 'numeric'; maxLength?: number; type?: string } = {}
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} {opts.required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        id={id}
        type={opts.type}
        value={value}
        inputMode={opts.inputMode}
        maxLength={opts.maxLength}
        placeholder={opts.placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => touch(id)}
        aria-invalid={!!shown(id)}
        aria-describedby={shown(id) ? `${id}-error` : undefined}
        className={shown(id) ? 'border-destructive focus-visible:ring-destructive/30' : undefined}
      />
      {shown(id) && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {shown(id)}
        </p>
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-fuchsia-600 shadow-lg shadow-fuchsia-500/25">
          <Sparkles className="size-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Set up your salon</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Last step — this takes about a minute, and you can change everything later.
        </p>
      </div>

      {/* Verified identity: shows exactly what the account is tied to. */}
      {identity && (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-800/40 dark:bg-emerald-900/10">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="size-3.5" />
            Verified
          </p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate text-sm text-foreground">{identity.email}</span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <MessageCircle className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate text-sm text-foreground">{prettyPhone(identity.phone)}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
            Invoices and renewal reminders go to this email. Bookings and customer messages use this
            WhatsApp number.
          </p>
        </div>
      )}

      {/* Stepper */}
      <ol className="mt-6 flex items-center gap-2" aria-label="Progress">
        {STEPS.map(({ n, label, icon: Icon }, i) => {
          const done = n < step;
          const active = n === step;
          return (
            <li key={n} className="flex flex-1 items-center gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  aria-current={active ? 'step' : undefined}
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    done
                      ? 'bg-emerald-500 text-white'
                      : active
                        ? 'bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {done ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                <span
                  className={`hidden truncate text-xs font-medium sm:block ${
                    active ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span className={`h-0.5 flex-1 rounded-full ${done ? 'bg-emerald-500' : 'bg-muted'}`} />
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className="space-y-4">
            {field('salonName', 'Salon name', salonName, setSalonName, {
              placeholder: 'e.g. Bhakti Beauty Care',
              required: true,
            })}
            {field('ownerName', 'Your name', ownerName, setOwnerName, {
              placeholder: 'e.g. Pranjal',
              required: true,
            })}

            {/* Read-only on purpose: the verified number is authoritative and the
                server ignores anything sent from here. */}
            <div className="space-y-1.5">
              <Label htmlFor="verifiedPhone">WhatsApp number</Label>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2.5">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                <span id="verifiedPhone" className="text-sm font-medium text-foreground">
                  {prettyPhone(identity?.phone ?? null) || 'Verified'}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">Verified</span>
              </div>
              <p className="text-xs text-muted-foreground">
                This is the number you just verified. Contact us if you need to change it.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <div className="space-y-4">
            {field('branchName', 'Branch name', branchName, setBranchName, {
              placeholder: salonName || 'Main branch',
            })}
            <p className="-mt-2 text-xs text-muted-foreground">
              Leave blank to use “{salonName || 'your salon name'}”.
            </p>

            {field('branchAddress', 'Address', branchAddress, setBranchAddress, {
              placeholder: 'Shop no., street, area',
              required: true,
            })}

            <div className="grid gap-4 sm:grid-cols-3">
              {field('city', 'City', city, setCity, { placeholder: 'Pune', required: true })}
              {field('state', 'State', state, setState, { placeholder: 'Maharashtra', required: true })}
              {field('pincode', 'Pincode', pincode, (v) => setPincode(v.replace(/\D/g, '').slice(0, 6)), {
                placeholder: '411001',
                required: true,
                inputMode: 'numeric',
                maxLength: 6,
              })}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {field('openTime', 'Opens at', openTime, setOpenTime, { type: 'time' })}
              {field('closeTime', 'Closes at', closeTime, setCloseTime, { type: 'time' })}
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Applies to every day for now — set per-day hours later in Settings.
            </p>
          </div>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add a few services so you can start billing straight away. You can skip this and add
              them later.
            </p>

            {services.length > 0 && (
              <ul className="space-y-2">
                {services.map((svc, i) => (
                  <li
                    key={`${svc.name}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{svc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {svc.category} · ₹{svc.price.toLocaleString('en-IN')} · {svc.duration_minutes} min
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeService(i)}
                      aria-label={`Remove ${svc.name}`}
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="rounded-xl border border-dashed border-border p-3">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Input
                  placeholder="Service name (e.g. Haircut)"
                  value={newService.name}
                  onChange={(e) => setNewService((s) => ({ ...s, name: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addService();
                    }
                  }}
                  aria-label="Service name"
                />
                <select
                  aria-label="Category"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={newService.category}
                  onChange={(e) => setNewService((s) => ({ ...s, category: e.target.value }))}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={0}
                  placeholder="Price (₹)"
                  aria-label="Price in rupees"
                  value={newService.price}
                  onChange={(e) => setNewService((s) => ({ ...s, price: Math.max(0, Number(e.target.value)) }))}
                />
                <Input
                  type="number"
                  min={5}
                  step={5}
                  placeholder="Minutes"
                  aria-label="Duration in minutes"
                  value={newService.duration_minutes}
                  onChange={(e) =>
                    setNewService((s) => ({ ...s, duration_minutes: Math.max(5, Number(e.target.value)) }))
                  }
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2.5 gap-1.5 rounded-xl"
                onClick={addService}
                disabled={!newService.name.trim()}
              >
                <Plus className="size-4" />
                Add service
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
          {step > 1 ? (
            <Button variant="outline" className="rounded-xl" onClick={() => setStep((s) => s - 1)} disabled={loading}>
              Back
            </Button>
          ) : (
            <span />
          )}

          {step < 3 ? (
            <Button className="rounded-xl" onClick={goNext}>
              Continue
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              {services.length === 0 && (
                <Button variant="ghost" className="rounded-xl" onClick={handleSubmit} disabled={loading}>
                  Skip for now
                </Button>
              )}
              <Button className="gap-1.5 rounded-xl" onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Setting up…
                  </>
                ) : (
                  <>
                    <Check className="size-4" />
                    Finish setup
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Your 15-day free trial starts once setup is complete. No card needed.
      </p>
    </div>
  );
}
