'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createCustomerWithMembership, getAvailableMemberships } from '../actions';
import { UserPlus, ArrowLeft, Crown, Sparkles } from 'lucide-react';
import type { Membership } from '@/types';

export default function NewCustomerPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedMembership, setSelectedMembership] = useState('');
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [error, setError] = useState('');

  const isFormValid = name.trim() && phone.trim();

  // Fetch available memberships on mount
  useEffect(() => {
    getAvailableMemberships().then(setMemberships);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;

    setError('');

    startTransition(async () => {
      const result = await createCustomerWithMembership(
        {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          gender: gender || undefined,
          notes: notes.trim() || undefined,
        },
        selectedMembership || undefined
      );

      if (result.success) {
        router.push('/dashboard/customers');
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 px-0 sm:px-0">
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

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
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

          {/* Membership Selection */}
          {memberships.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Crown className="size-4 text-amber-500" />
                <label className="text-sm font-medium text-foreground">
                  Assign Membership <span className="text-xs text-muted-foreground">(optional)</span>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {/* No membership option */}
                <button
                  type="button"
                  onClick={() => setSelectedMembership('')}
                  className={`relative rounded-xl border p-4 text-left transition-all hover:shadow-sm ${
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
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" className="rounded-xl" disabled={!isFormValid || isPending}>
              {isPending ? 'Adding...' : 'Add Customer'}
            </Button>
            <Link href="/dashboard/customers">
              <Button type="button" variant="outline" className="rounded-xl">Cancel</Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
