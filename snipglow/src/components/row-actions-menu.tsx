'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { MoreVertical } from 'lucide-react';

// =============================================================================
// RowActionsMenu — a compact "⋯" dropdown for table-row actions.
// Keeps busy tables clean by collapsing multiple action buttons into one menu.
//
// The menu is rendered with FIXED positioning anchored to the trigger button so
// it is never clipped by a parent's overflow (e.g. a table's horizontal scroll
// container). It flips upward automatically when near the bottom of the screen.
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

const MENU_WIDTH = 176; // 11rem

export function RowActionsMenu({ actions, align = 'right' }: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Position the menu relative to the trigger using viewport coordinates.
  const positionMenu = () => {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? actions.length * 44 + 8;
    const margin = 8;

    // Horizontal: align right edge of menu to the trigger by default.
    let left = align === 'right' ? rect.right - MENU_WIDTH : rect.left;
    left = Math.min(Math.max(margin, left), window.innerWidth - MENU_WIDTH - margin);

    // Vertical: below the trigger, but flip above if it would overflow.
    let top = rect.bottom + 4;
    if (top + menuHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - menuHeight - 4);
    }
    setCoords({ top, left });
  };

  // Recompute position the moment the menu opens (after it has a measurable height).
  useLayoutEffect(() => {
    if (open) positionMenu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on scroll/resize so the menu never floats away from its row.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  if (actions.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex justify-end">
      <button
        ref={triggerRef}
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
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            role="menu"
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: MENU_WIDTH }}
            className="z-[70] overflow-hidden rounded-xl border border-border bg-card shadow-xl"
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
