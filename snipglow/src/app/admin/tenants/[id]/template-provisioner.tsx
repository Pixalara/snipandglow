'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { adminCloneWhatsAppTemplates } from './actions';
import type { CloneResult } from '@/lib/whatsapp/template-clone';

interface Props {
  tenantId: string;
  /** True when the tenant is fully connected on a dedicated WhatsApp number. */
  connected: boolean;
}

export function AdminTemplateProvisioner({ tenantId, connected }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [result, setResult] = useState<CloneResult | null>(null);

  function handleClone() {
    setError('');
    setResult(null);
    startTransition(async () => {
      const res = await adminCloneWhatsAppTemplates(tenantId);
      if (res.result) setResult(res.result);
      if (!res.success) setError(res.error || 'Failed to clone templates.');
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <FileText className="size-4 text-fuchsia-600" />
        <h2 className="text-sm font-semibold text-foreground">Clone WhatsApp Templates (Admin)</h2>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Copies the standard transactional templates (booking, reschedule, reminders, receipt, feedback,
          owner alerts) from the shared account onto this tenant&apos;s own WhatsApp Business Account so they
          send from their number. Already-present templates are skipped, and document-header templates
          (bill_receipt_v2, wallet_recharge_v1) must be created manually in Meta. New templates enter Meta
          review — usually approved within a few hours.
        </p>

        {!connected && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="size-4 shrink-0" />
            Connect this tenant&apos;s dedicated WhatsApp number first — there&apos;s no account to create templates on yet.
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
                {result.created} created
              </span>
              <span className="rounded-full bg-slate-500/15 px-2 py-0.5 font-medium text-slate-600 dark:text-slate-300">
                {result.skipped} skipped
              </span>
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-medium text-red-600 dark:text-red-400">
                {result.failed} failed
              </span>
            </div>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {result.outcomes.length === 0 ? (
                <li className="px-3 py-2 text-xs text-muted-foreground">
                  No matching approved templates found on the platform account.
                </li>
              ) : (
                result.outcomes.map((o) => (
                  <li key={`${o.name}|${o.language}`} className="flex items-start gap-2 px-3 py-2 text-xs">
                    {o.status === 'created' ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                    ) : o.status === 'failed' ? (
                      <XCircle className="size-4 shrink-0 text-red-600" />
                    ) : (
                      <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                    )}
                    <div className="min-w-0">
                      <span className="font-mono text-foreground">{o.name}</span>
                      {o.reason && <span className="text-muted-foreground"> — {o.reason}</span>}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        <button
          onClick={handleClone}
          disabled={isPending || !connected}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-fuchsia-500 disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Cloning…
            </>
          ) : (
            'Clone templates to this number'
          )}
        </button>
      </div>
    </div>
  );
}
