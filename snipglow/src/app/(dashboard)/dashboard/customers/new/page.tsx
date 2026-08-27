'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createCustomerWithMembership, getAvailableMemberships } from '../actions';
import { isValidDateOfBirth } from '@/lib/utils';
import { UserPlus, ArrowLeft, Crown, Sparkles } from 'lucide-react';
import type { Membership } from '@/types';

const DOB_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function NewCustomerPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedMembership, setSelectedMembership] = useState('');
  const [memberships, setMemberships] = useState<Membership[]>([]);
  /** True when the membership list failed to load — not the same as none existing. */
  const [membershipsFailed, setMembershipsFailed] = useState(false);
  const [error, setError] = useState('');

  const currentYear = new Date().getFullYear();
  const dobYears = Array.from({ length: currentYear - 1950 + 1 }, (_, i) => currentYear - i);
  const dobDays = Array.from({ length: 31 }, (_, i) => i + 1);

  const isFormValid = name.trim() && phone.trim();

  // Fetch available memberships on mount.
  //
  // The picker is gated on memberships.length > 0, so an uncaught rejection here
  // silently removed the whole "Assign Membership" section and staff concluded
  // the salon had no plans configured.
  useEffect(() => {
    let active = true;
    getAvailableMemberships()
      .then((rows) => { if (active) setMemberships(rows); })
      .catch((err) => {
        console.error('[customers/new] could not load memberships:', err);
        if (active) setMembershipsFailed(true);
      });
    return () => { active = false; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;

    setError('');

    // Validate optional Date of Birth: require all three parts together, then strict-validate.
    let date_of_birth: string | undefined;
    const anyDob = dobDay || dobMonth || dobYear;
    const allDob = dobDay && dobMonth && dobYear;
    if (anyDob && !allDob) {
      setError('Please select day, month and year for date of birth, or leave all three blank.');
      return;
    }
    if (allDob) {
      const iso = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;
      if (!isValidDateOfBirth(iso)) {
        setError('Please enter a valid date of birth (year 1950 or later, and not in the future).');
        return;
      }
      date_of_birth = iso;
    }

    startTransition(async () => {
      const result = await createCustomerWithMembership(
        {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          gender: gender || undefined,
          date_of_birth,
          notes: notes.trim() || undefined,
        },
        selectedMembership || undefined
      );

      if (result.success) {
        toast.success(`${name.trim() || 'Customer'} added.`);
        router.push('/dashboard/customers');
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-2 sm:px-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Back to customers"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </div>

      {/* Form Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-6 py-4 bg-gradient-to-r from-emerald-500/5 via-emerald-500/3 to-transparent">
          <div className="flex items-center gap-2">
            <UserPlus className="size-4 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-base font-semibold text-foreground">Add New Customer</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
          {error && (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Name & Phone */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium text-foreground">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="phone" className="text-sm font-medium text-foreground">
                Phone <span className="text-destructive">*</span>
              </label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
              />
              <p className="text-xs text-muted-foreground">Indian mobile (starts with 6-9)</p>
            </div>
          </div>

          {/* Email & Gender */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="gender" className="text-sm font-medium text-foreground">
                Gender
              </label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Date of Birth (optional) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Date of Birth <span className="text-xs text-muted-foreground">(optional)</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <select
                value={dobDay}
                onChange={(e) => setDobDay(e.target.value)}
                aria-label="Day of birth"
                className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Day</option>
                {dobDays.map((d) => (
                  <option key={d} value={String(d)}>{d}</option>
                ))}
              </select>
              <select
                value={dobMonth}
                onChange={(e) => setDobMonth(e.target.value)}
                aria-label="Month of birth"
                className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Month</option>
                {DOB_MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>{m}</option>
                ))}
              </select>
              <select
                value={dobYear}
                onChange={(e) => setDobYear(e.target.value)}
                aria-label="Year of birth"
                className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Year</option>
                {dobYears.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              Used to send birthday wishes on WhatsApp (Pro &amp; Growth plans). Year must be 1950 or later.
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label htmlFor="notes" className="text-sm font-medium text-foreground">
              Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any preferences or notes..."
              rows={3}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Membership list failed to load — don't let it read as "no plans". */}
          {membershipsFailed && (
            <div
              role="alert"
              className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/15"
            >
              <p className="text-sm text-amber-900 dark:text-amber-200">
                Could not load membership plans. You can still save this customer and assign a
                membership from their profile later.
              </p>
            </div>
          )}

          {/* Membership Selection */}
          {memberships.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Crown className="size-4 text-amber-500" />
                <label className="text-sm font-medium text-foreground">
                  Assign Membership <span className="text-xs text-muted-foreground">(optional)</span>
                </label>
              </div>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                {/* No membership option */}
                <button
                  type="button"
                  onClick={() => setSelectedMembership('')}
                  className={`relative rounded-xl border p-4 text-left transition-all hover:shadow-sm min-h-[56px] ${
                    selectedMembership === ''
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-border/80'
                  }`}
                >
                  <p className="text-sm font-medium text-foreground">No Membership</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Add without membership</p>
                </button>

                {memberships.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMembership(m.id)}
                    className={`relative rounded-xl border p-4 text-left transition-all hover:shadow-sm ${
                      selectedMembership === m.id
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10 ring-2 ring-amber-500/20'
                        : 'border-border hover:border-amber-200 dark:hover:border-amber-800/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-amber-500" />
                          <p className="text-sm font-medium text-foreground">{m.name}</p>
                        </div>
                        {m.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{m.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs text-muted-foreground">
                            ₹{m.price.toLocaleString('en-IN')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {m.validity_days} days
                          </span>
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                            {m.discount_pct}% off
                          </span>
                        </div>
                      </div>
                      {selectedMembership === m.id && (
                        <div className="flex size-5 items-center justify-center rounded-full bg-amber-500 text-white">
                          <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Link href="/dashboard/customers" className="sm:order-first">
              <Button type="button" variant="outline" className="rounded-xl w-full sm:w-auto min-h-[48px]">Cancel</Button>
            </Link>
            <Button type="submit" className="rounded-xl min-h-[48px] flex-1 sm:flex-none" disabled={!isFormValid || isPending}>
              {isPending ? 'Adding...' : 'Add Customer'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
