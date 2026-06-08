'use client';

import { useState, type ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';

// =============================================================================
// RowActionsMenu — a compact "⋯" dropdown for table-row actions.
// Keeps busy tables clean by collapsing multiple action buttons into one menu.
// =============================================================================

export interface RowAction {
  /** Visible label. */
  label: string;
  /** Optional leading icon element. */
  icon?: ReactNode;
  /** Click handler. */
  onClick: () => void;
  /** Render in destructive (red) style + separated by a divider above. */
  danger?: boolean;
  /** Disable the item. */
  disabled?: boolean;
}

interface RowActionsMenuProps {
  actions: RowAction[];
  /** Optional alignment of the menu relative to the trigger. Default 'right'. */
  align?: 'left' | 'right';
}

export function RowActionsMenu({ actions, align = 'right' }: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);

  if (actions.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="relative flex justify-end">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical className="size-4" />
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className={`absolute top-9 z-20 w-44 overflow-hidden rounded-xl border border-border bg-card shadow-lg ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {actions.map((action, i) => (
              <button
                key={`${action.label}-${i}`}
                type="button"
                role="menuitem"
                disabled={action.disabled}
                onClick={() => { setOpen(false); action.onClick(); }}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  action.danger
                    ? 'border-t border-border text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                {action.icon && <span className="text-muted-foreground">{action.icon}</span>}
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
