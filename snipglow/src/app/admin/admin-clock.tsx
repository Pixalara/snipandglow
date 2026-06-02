'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

// =============================================================================
// Admin Clock — shows the current date & time in IST, updating every second.
// Renders nothing until mounted to avoid SSR/client hydration mismatch.
// =============================================================================

function nowIST(): string {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function AdminClock() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    setTime(nowIST());
    const id = setInterval(() => setTime(nowIST()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
      <Clock className="size-3.5" />
      <span>{time ?? '—'}</span>
      <span className="text-[10px] font-medium text-muted-foreground/70">IST</span>
    </div>
  );
}
