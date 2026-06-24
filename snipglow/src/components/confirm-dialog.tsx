'use client';

import { type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// =============================================================================
// ConfirmDialog — a reusable "are you sure?" warning popup.
// Use for destructive / irreversible actions (delete, cancel) so a stray click
// never performs the action. Renders nothing when `open` is false.
// =============================================================================

interface ConfirmDialogProps {
  /** Controls visibility. */
  open: boolean;
  /** Bold heading, e.g. "Cancel this appointment?". */
  title: string;
  /** Body text / nodes explaining the consequence. */
  message: ReactNode;
  /** Confirm button label. Default "Confirm". */
  confirmLabel?: string;
  /** Cancel/dismiss button label. Default "Cancel". */
  cancelLabel?: string;
  /** When true, buttons are disabled and the confirm shows the pending label. */
  pending?: boolean;
  /** Label shown on the confirm button while pending. Default "Working...". */
  pendingLabel?: string;
  /** Optional error message shown inside the dialog. */
  error?: string;
  /** Called when the user confirms the action. */
  onConfirm: () => void;
  /** Called when the user dismisses the dialog. */
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  pending = false,
  pendingLabel = 'Working...',
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={pending ? undefined : onClose}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        className="relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
      >
        <div className="p-6 space-y-5">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
              <AlertTriangle className="size-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              <div className="text-sm text-muted-foreground mt-1">{message}</div>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
              <AlertTriangle className="size-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={onClose}
              disabled={pending}
            >
              {cancelLabel}
            </Button>
            <Button
              className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white"
              onClick={onConfirm}
              disabled={pending}
            >
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
