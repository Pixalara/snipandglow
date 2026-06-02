// =============================================================================
// IST Date/Time Formatting Helpers
// All platform timestamps are stored in UTC. These helpers render them in
// Asia/Kolkata (IST) consistently, regardless of where the server runs
// (Vercel runs in UTC). Use these everywhere a date/time is shown to users.
// =============================================================================

const IST = 'Asia/Kolkata';

/** Format an ISO/timestamp value as a date in IST, e.g. "2 Jun 2026". */
export function formatISTDate(
  value: string | number | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions
): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...opts,
  });
}

/** Format an ISO/timestamp value as date + time in IST, e.g. "2 Jun 2026, 9:30 PM". */
export function formatISTDateTime(
  value: string | number | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions
): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...opts,
  });
}

/** Format a compact date + time in IST, e.g. "2 Jun, 9:30 PM" (no year). */
export function formatISTShort(
  value: string | number | Date | null | undefined
): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Current date string (YYYY-MM-DD) in IST. */
export function todayIST(): string {
  return new Date().toLocaleString('en-CA', { timeZone: IST }).split(',')[0];
}
