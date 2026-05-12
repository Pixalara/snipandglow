'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateGstSettings } from './actions';
import { Receipt, CheckCircle2, AlertTriangle } from 'lucide-react';

interface GstSettingsProps {
  currentGstNumber: string;
  currentGstRate: number;
  gstEnabled: boolean;
}

/** Validate Indian GSTIN format: 2-digit state code + 10-char PAN + 1 entity + 1 Z + 1 check */
function isValidGSTIN(gstin: string): boolean {
  if (!gstin.trim()) return true; // Empty is valid (means GST disabled)
  const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return pattern.test(gstin.trim().toUpperCase());
}

export function GstSettingsCard({ currentGstNumber, currentGstRate, gstEnabled }: GstSettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [gstNumber, setGstNumber] = useState(currentGstNumber);
  const [gstRate, setGstRate] = useState(currentGstRate || 18);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const hasGst = gstNumber.trim().length > 0;
  const isValid = isValidGSTIN(gstNumber);

  function handleSave() {
    setError('');
    setSuccess(false);

    if (gstNumber.trim() && !isValidGSTIN(gstNumber)) {
      setError('Please enter a valid 15-character GSTIN (e.g., 29ABCDE1234F1Z5)');
      return;
    }

    startTransition(async () => {
      const result = await updateGstSettings({
        gst_number: gstNumber.trim().toUpperCase() || null,
        gst_rate: gstNumber.trim() ? gstRate : 0,
        gst_enabled: !!gstNumber.trim(),
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error);
      }
    });
  }

  function handleClear() {
    setGstNumber('');
    setGstRate(18);
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-6 py-4 bg-muted/30">
        <div className="flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">GST Configuration</h2>
          {gstEnabled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3" />
              Active
            </span>
          )}
        </div>
      </div>
      <div className="p-6 space-y-5">
        <p className="text-sm text-muted-foreground">
          Add your GSTIN to automatically apply GST on all invoices. Leave empty to disable GST.
        </p>

        {/* GST Number */}
        <div className="space-y-2">
          <label htmlFor="gst-number" className="text-sm font-medium text-foreground">
            GSTIN (GST Number)
          </label>
          <Input
            id="gst-number"
            value={gstNumber}
            onChange={(e) => {
              setGstNumber(e.target.value.toUpperCase());
              setError('');
              setSuccess(false);
            }}
            placeholder="e.g., 29ABCDE1234F1Z5"
            maxLength={15}
            className="font-mono uppercase"
          />
          <p className="text-xs text-muted-foreground">
            15-character Indian GST Identification Number. Leave empty to disable GST on invoices.
          </p>
        </div>

        {/* GST Rate — only show if GSTIN is provided */}
        {hasGst && isValid && (
          <div className="space-y-2">
            <label htmlFor="gst-rate" className="text-sm font-medium text-foreground">
              GST Rate (%)
            </label>
            <select
              id="gst-rate"
              value={gstRate}
              onChange={(e) => setGstRate(Number(e.target.value))}
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={5}>5%</option>
              <option value={12}>12%</option>
              <option value={18}>18% (Standard)</option>
              <option value={28}>28%</option>
            </select>
          </div>
        )}

        {/* Status indicator */}
        {hasGst && isValid && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                GST at {gstRate}% will be applied to all new invoices.
              </p>
            </div>
          </div>
        )}

        {!hasGst && (
          <div className="rounded-lg bg-muted/50 px-4 py-3">
            <p className="text-sm text-muted-foreground">
              No GSTIN configured. Invoices will be generated without GST.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
            <AlertTriangle className="size-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/20">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <p className="text-sm text-emerald-800 dark:text-emerald-200">GST settings saved!</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button className="rounded-xl" onClick={handleSave} disabled={isPending || (hasGst && !isValid)}>
            {isPending ? 'Saving...' : 'Save GST Settings'}
          </Button>
          {hasGst && (
            <Button variant="outline" className="rounded-xl" onClick={handleClear} disabled={isPending}>
              Remove GSTIN
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
