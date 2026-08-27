// =============================================================================
// Appointment volume counts for the analytics bar.
//
// Kept in its own module (not in page.tsx) so it can be unit tested without
// pulling in the server-only Supabase client that the page imports.
//
// These counts used to be three `count: 'exact', head: true` queries awaited
// AFTER the customer/service/employee lookups — a third sequential round trip to
// Postgres for numbers the page was already holding in memory. The page fetches
// every booked/confirmed appointment with no date filter and no limit, which is
// exactly the set these counts are over, so they are derived locally instead.
// =============================================================================

export interface AppointmentStats {
  today: number;
  week: number;
  month: number;
}

/**
 * Count ACTIVE appointments (booked/confirmed) scheduled today / this week
 * (Mon–Sun) / this month on the salon's IST calendar.
 *
 * @param rows Already-fetched booked/confirmed appointments. Cancelled and
 *             completed rows are never in this set, so the bar reflects what is
 *             still on the schedule.
 * @param now  Injectable for tests; defaults to the current instant.
 *
 * Dates are compared as `YYYY-MM-DD` strings, which sort lexicographically the
 * same way they sort chronologically, so there is no Date parsing per row.
 */
export function computeAppointmentStats(
  rows: { appointment_date: string | null }[],
  now: Date = new Date(),
): AppointmentStats {
  // "now" as a Date whose LOCAL fields hold IST wall-clock values, so the
  // day/week/month boundaries are the salon's, not the server's.
  const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const y = istNow.getFullYear();
  const m = istNow.getMonth();
  const d = istNow.getDate();
  const dow = istNow.getDay(); // 0=Sun … 6=Sat

  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  const todayStr = fmt(istNow);
  // Monday-based week: Sunday (0) is the LAST day of the week, not the first.
  const mondayOffset = (dow + 6) % 7;
  const weekStart = fmt(new Date(y, m, d - mondayOffset));
  const weekEnd = fmt(new Date(y, m, d - mondayOffset + 6));
  const monthStart = fmt(new Date(y, m, 1));
  // Day 0 of next month == last day of this month.
  const monthEnd = fmt(new Date(y, m + 1, 0));

  let today = 0;
  let week = 0;
  let month = 0;

  for (const row of rows) {
    // Tolerate a timestamp arriving where a plain date is expected.
    const date = row.appointment_date?.slice(0, 10);
    if (!date) continue;
    if (date === todayStr) today++;
    if (date >= weekStart && date <= weekEnd) week++;
    if (date >= monthStart && date <= monthEnd) month++;
  }

  return { today, week, month };
}
