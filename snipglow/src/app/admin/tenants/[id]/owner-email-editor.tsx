'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, CheckCircle2, AlertTriangle } from 'lucide-react';
import { adminUpdateOwnerEmail } from './actions';

interface Props {
  tenantId: string;
  currentEmail: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AdminOwnerEmailEditor({ tenantId, currentEmail }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState(currentEmail);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleSave() {
    setError('');
    setSuccess(false);
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    startTransition(async () => {
      const res = await adminUpdateOwnerEmail(tenantId, trimmed);
      if (res.success) {
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 2500);
      } else {
        setError(res.error || 'Failed to save.');
      }
    });
  }

  const inputCls =
    'w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Mail className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Owner Email (Admin Edit)</h2>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          The owner&apos;s contact email shown in the profile above and used for owner-facing
          communication. This does not change how the owner signs in.
        </p>

        {/* Stacks on mobile, input + button inline from sm up. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Email address</label>
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@example.com"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:opacity-50"
          >
            {isPending ? 'Saving...' : 'Save Email'}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
            <AlertTriangle className="size-4 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
            <CheckCircle2 className="size-4 shrink-0" /> Owner email updated.
          </div>
        )}
      </div>
    </div>
  );
}
