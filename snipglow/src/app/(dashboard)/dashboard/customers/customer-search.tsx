'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';

// =============================================================================
// Customer search box.
//
// Debounced on purpose. This used to call router.push() straight from onChange,
// so typing a 10-digit phone number fired ten navigations and ten server queries
// — and pushed ten entries onto history, meaning the back button needed ten
// presses to leave the page. Receptionists use this box constantly.
//
// router.replace is used rather than push for the same reason: refining a search
// term is not ten separate destinations.
// =============================================================================

const DEBOUNCE_MS = 300;

interface CustomerSearchProps {
  defaultValue: string;
}

export function CustomerSearch({ defaultValue }: CustomerSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(defaultValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    (term: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (term.trim()) {
        params.set('search', term.trim());
      } else {
        params.delete('search');
      }

      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `/dashboard/customers?${qs}` : '/dashboard/customers');
      });
    },
    [router, searchParams, startTransition]
  );

  function handleChange(next: string) {
    setValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runSearch(next), DEBOUNCE_MS);
  }

  // Don't leave a pending navigation queued after unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="relative">
      <Input
        type="search"
        placeholder="Search by name or phone..."
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          // Enter searches immediately rather than waiting out the debounce.
          if (e.key === 'Enter') {
            if (timerRef.current) clearTimeout(timerRef.current);
            runSearch(value);
          }
        }}
        className="w-full sm:w-64"
        aria-label="Search customers"
      />
      {isPending && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      )}
    </div>
  );
}
