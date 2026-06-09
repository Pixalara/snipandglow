'use client';

import { Download } from 'lucide-react';
import { downloadCsv, type ExportColumn } from '@/lib/export-csv';

// =============================================================================
// Reusable "Export to Excel" button. Downloads the given rows as a CSV that
// opens directly in Excel / Google Sheets. No external dependencies.
// =============================================================================

interface ExportButtonProps<T> {
  /** Base filename (date + .csv appended automatically). */
  filename: string;
  rows: T[];
  columns: ExportColumn<T>[];
  label?: string;
  className?: string;
}

export function ExportButton<T>({ filename, rows, columns, label = 'Export', className }: ExportButtonProps<T>) {
  const disabled = !rows || rows.length === 0;
  return (
    <button
      type="button"
      onClick={() => downloadCsv(filename, rows, columns)}
      disabled={disabled}
      title={disabled ? 'Nothing to export' : 'Download as Excel (CSV)'}
      className={
        className ??
        'inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px]'
      }
    >
      <Download className="size-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
