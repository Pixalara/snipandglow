'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

// =============================================================================
// SearchableSelect — combobox that works BOTH ways:
//   • Click the field / chevron  → browse the full list (classic dropdown)
//   • Start typing               → instantly filter by name (search)
//
// Groups are optional. Keyboard: ArrowUp/Down to move, Enter to pick, Esc to close.
// =============================================================================

export interface SelectOption {
  value: string;
  label: string;
  /** Right-aligned hint, e.g. a price or stock note. */
  hint?: string;
  disabled?: boolean;
  /** Optional group heading, e.g. 'Services' / 'Products'. */
  group?: string;
  /**
   * Category shown as a small tag and included in search, so typing "hair"
   * surfaces every item in the Hair category — not just names containing "hair".
   */
  category?: string | null;
}

interface Props {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Text shown when a search yields nothing. */
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Search or browse…',
  emptyText = 'No matches found',
  disabled = false,
  className = '',
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  // Filter on the typed query (empty query => full list, i.e. dropdown mode).
  // Matches name, category, and the hint text — so "hair" returns everything in
  // the Hair category as well as anything with "hair" in the name.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    // Support multi-word queries: every term must match somewhere.
    const terms = q.split(/\s+/).filter(Boolean);
    return options.filter((o) => {
      const haystack = `${o.label} ${o.category ?? ''} ${o.hint ?? ''} ${o.group ?? ''}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [options, query]);

  // Close on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(0);
  }, [filtered.length, activeIdx]);

  function pick(opt: SelectOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[activeIdx];
      if (opt) pick(opt);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  }

  // Render list with optional group headings.
  let lastGroup: string | undefined;

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <div
        className={`flex h-11 items-center gap-1.5 rounded-xl border border-border bg-transparent px-3 ${
          disabled ? 'opacity-50' : 'focus-within:ring-2 focus-within:ring-ring/50'
        }`}
      >
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel ?? placeholder}
          disabled={disabled}
          value={open ? query : selected?.label ?? ''}
          placeholder={selected ? selected.label : placeholder}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {selected && !open && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Clear selection"
          >
            <X className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => { setOpen((o) => !o); setQuery(''); inputRef.current?.focus(); }}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Show all options"
        >
          <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            filtered.map((opt, i) => {
              const showGroup = opt.group && opt.group !== lastGroup;
              lastGroup = opt.group;
              return (
                <div key={opt.value}>
                  {showGroup && (
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {opt.group}
                    </p>
                  )}
                  <button
                    type="button"
                    role="option"
                    aria-selected={opt.value === value}
                    disabled={opt.disabled}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => pick(opt)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      opt.disabled
                        ? 'cursor-not-allowed text-muted-foreground/50'
                        : i === activeIdx
                          ? 'bg-muted text-foreground'
                          : 'text-foreground hover:bg-muted/60'
                    } ${opt.value === value ? 'font-medium' : ''}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate">{opt.label}</span>
                      {opt.category && (
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {opt.category}
                        </span>
                      )}
                    </span>
                    {opt.hint && <span className="shrink-0 text-xs text-muted-foreground">{opt.hint}</span>}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
