'use client';

import { cn } from '@/lib/utils';

// =============================================================================
// DataTable — Reusable responsive table component
// Shows as stacked cards on mobile (<sm) and as a table on sm+ screens.
// =============================================================================

export interface Column<T> {
  /** Unique key for the column */
  key: string;
  /** Column header label */
  header: string;
  /** Render function for cell content */
  render: (row: T) => React.ReactNode;
  /** Optional className for the column header and cells */
  className?: string;
  /** Hide this column in mobile card view (useful for actions rendered separately) */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  /** Column definitions */
  columns: Column<T>[];
  /** Data rows to render */
  data: T[];
  /** Unique key extractor for each row */
  getRowKey: (row: T) => string;
  /** Optional click handler for row */
  onRowClick?: (row: T) => void;
  /** Headline shown when data is empty. */
  emptyMessage?: string;
  /**
   * Optional icon for the empty state. Pass a lucide icon element.
   * Without it the empty state still renders, just without the visual anchor.
   */
  emptyIcon?: React.ReactNode;
  /** Optional supporting sentence explaining what to do next. */
  emptyHint?: string;
  /**
   * Optional call to action for the empty state (usually a Link styled as a
   * button). A first-time salon owner opening Customers or Billing used to get a
   * lone grey sentence and no way forward, even though the "Add" button existed
   * elsewhere on the page.
   */
  emptyAction?: React.ReactNode;
  /** Additional className for the wrapper */
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  onRowClick,
  emptyMessage = 'No data found',
  emptyIcon,
  emptyHint,
  emptyAction,
  className,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-lg border border-border bg-card p-12 text-center',
          className
        )}
      >
        {emptyIcon && (
          <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted">
            {emptyIcon}
          </div>
        )}
        <p className={cn('text-muted-foreground', emptyHint || emptyAction ? 'text-base font-semibold text-foreground' : 'text-sm')}>
          {emptyMessage}
        </p>
        {emptyHint && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{emptyHint}</p>}
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      {/* Desktop/Tablet: Traditional table view (hidden on mobile) */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left font-medium text-muted-foreground',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-border last:border-b-0 transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-muted/50'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn('px-4 py-3', col.className)}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Stacked card view (visible only on mobile) */}
      <div className="sm:hidden space-y-3">
        {data.map((row) => (
          <div
            key={getRowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn(
              'rounded-xl border border-border bg-card p-4 space-y-2.5 transition-colors',
              onRowClick && 'cursor-pointer active:bg-muted/50'
            )}
          >
            {columns.map((col) => {
              if (col.hideOnMobile) return null;
              // If header is empty (actions column), render without label
              if (!col.header) {
                return (
                  <div key={col.key} className="pt-2 border-t border-border">
                    {col.render(row)}
                  </div>
                );
              }
              return (
                <div key={col.key} className="flex items-start justify-between gap-3">
                  <span className="text-xs font-medium text-muted-foreground shrink-0 min-w-[80px] pt-0.5">
                    {col.header}
                  </span>
                  <div className="text-sm text-right flex-1 min-w-0">
                    {col.render(row)}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
