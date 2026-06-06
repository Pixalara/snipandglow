'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { adminActivateDedicatedWhatsApp } from './actions';

interface Props {
  tenantId: string;
  /** Current onboarding status, if a settings row exists. */
  onboardingStatus: string | null;
  /** Latest manual setup request summary, if any. */
  setupRequest: {
    contactPhone: string;
    contactName: string | null;
    notes: string | null;
    status: string;
    createdAt: string;
  } | null;
}

export function AdminWhatsAppActivator({ tenantId, onboardingStatus, setupRequest }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [accessToken, setAccessToken] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState(setupRequest?.contactPhone ?? '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const alreadyConnected = onboardingStatus === 'connected';

  function handleActivate() {
    setError('');
    setSuccess(false);

    if (!accessToken.trim() || !wabaId.trim() || !phoneNumberId.trim() || !displayPhoneNumber.trim()) {
      setError('All four fields are required.');
      return;
    }

    startTransition(async () => {
      const res = await adminActivateDedicatedWhatsApp(tenantId, {
        accessToken: accessToken.trim(),
        wabaId: wabaId.trim(),
        phoneNumberId: phoneNumberId.trim(),
        displayPhoneNumber: displayPhoneNumber.trim(),
      });
      if (res.success) {
        setSuccess(true);
        setAccessToken('');
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(res.error || 'Failed to activate.');
      }
    });
  }

  const inputCls =
    'w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <MessageCircle className="size-4 text-emerald-600" />
        <h2 className="text-sm font-semibold text-foreground">Manual WhatsApp Activation (Admin)</h2>
        {alreadyConnected && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3" /> Connected
          </span>
        )}
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Interim flow while Embedded Signup is pending. Provision the tenant&apos;s WhatsApp Cloud API
          number in Meta, then paste the resulting credentials here to connect their dedicated number.
          The access token is encrypted before storage.
        </p>

        {/* Pending setup request summary */}
        {setupRequest && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <p className="font-semibold">Setup requested by tenant</p>
            <p className="mt-0.5">
              Number: <span className="font-mono">{setupRequest.contactPhone}</span>
              {setupRequest.contactName ? ` · ${setupRequest.contactName}` : ''} · Status: {setupRequest.status}
            </p>
            {setupRequest.notes && <p className="mt-0.5 italic">“{setupRequest.notes}”</p>}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Permanent Access Token</label>
            <input
              className={`${inputCls} font-mono`}
              type="password"
              autoComplete="off"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="EAA..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">WABA ID</label>
            <input className={`${inputCls} font-mono`} value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="WhatsApp Business Account ID" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Phone Number ID</label>
            <input className={`${inputCls} font-mono`} value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Meta phone number ID" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Display Phone Number</label>
            <input className={inputCls} value={displayPhoneNumber} onChange={(e) => setDisplayPhoneNumber(e.target.value)} placeholder="+91 98765 43210" />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
            <AlertTriangle className="size-4 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
            <CheckCircle2 className="size-4 shrink-0" /> Dedicated WhatsApp activated for this tenant.
          </div>
        )}

        <button
          onClick={handleActivate}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          {isPending ? 'Activating...' : alreadyConnected ? 'Update Credentials & Re-activate' : 'Activate Dedicated WhatsApp'}
        </button>
      </div>
    </div>
  );
}
