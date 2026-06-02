'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';
import { adminUpdateTenantGst } from './actions';

interface Props {
  tenantId: string;
  gstNumber: string;
  gstRate: number;
  legalName: string;
  tradeName: string;
  locked: boolean;
}

function isValidGSTIN(gstin: string): boolean {
  if (!gstin.trim()) return true;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.trim().toUpperCase());
}

export function AdminGstEditor({ tenantId, gstNumber, gstRate, legalName, tradeName, locked }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [gst, setGst] = useState(gstNumber);
  const [legal, setLegal] = useState(legalName);
  const [trade, setTrade] = useState(tradeName);
  const [rate, setRate] = useState(gstRate || 5);
  const [isLocked, setIsLocked] = useState(locked);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleSave() {
    setError('');
    setSuccess(false);
    if (gst.trim() && !isValidGSTIN(gst)) {
      setError('Invalid GSTIN format (e.g., 29ABCDE1234F1Z5).');
      return;
    }
    startTransition(async () => {
      const res = await adminUpdateTenantGst(tenantId, {
        gst_number: gst.trim().toUpperCase() || null,
        gst_rate: rate,
        legal_name: legal.trim() || null,
        trade_name: trade.trim() || null,
        locked: isLocked,
      });
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
        <Receipt className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">GST Details (Admin Edit)</h2>
        {locked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Lock className="size-3" /> Locked for tenant
          </span>
        )}
      </div>
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          As a platform admin you can edit these locked GST details on the tenant&apos;s behalf.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Legal Name</label>
            <input className={inputCls} value={legal} onChange={(e) => setLegal(e.target.value)} placeholder="Legal entity name" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Trade Name</label>
            <input className={inputCls} value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="Brand / trade name" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">GSTIN</label>
            <input className={`${inputCls} font-mono uppercase`} value={gst} maxLength={15} onChange={(e) => setGst(e.target.value.toUpperCase())} placeholder="29ABCDE1234F1Z5" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">GST Rate (%)</label>
            <select className={inputCls} value={rate} onChange={(e) => setRate(Number(e.target.value))}>
              <option value={5}>5% (Salon & Spa)</option>
              <option value={12}>12%</option>
              <option value={18}>18%</option>
              <option value={28}>28%</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-foreground/80 cursor-pointer">
          <input type="checkbox" checked={isLocked} onChange={(e) => setIsLocked(e.target.checked)} className="size-4 rounded border-border" />
          Keep locked (tenant cannot edit)
        </label>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
            <AlertTriangle className="size-4 shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
            <CheckCircle2 className="size-4 shrink-0" /> GST details updated.
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-500 disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save GST Details'}
        </button>
      </div>
    </div>
  );
}
