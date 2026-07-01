'use client';

import { useRouter } from 'next/navigation';
import { CalendarRange } from 'lucide-react';

// =============================================================================
// BillingMonthFilter — month picker that scopes the billing dashboard's
// monthly stats + payment-methods bar to the chosen calendar month.
// =============================================================================

export function BillingMonthFilter({ selectedMonth }: { selectedMonth: string }) {
  const router = useRouter();
  // Can't select a future month.
  const maxMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7);

  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 h-11 sm:h-9">
      <CalendarRange className="size-4 text-muted-foreground shrink-0" />
      <input
        type="month"
        value={selectedMonth}
        max={maxMonth}
        onChange={(e) => {
          const v = e.target.value;
          if (v) router.push(`/dashboard/billing?month=${v}`);
        }}
        aria-label="Filter billing by month"
        className="bg-transparent text-sm text-foreground outline-none"
      />
    </div>
  );
}
