import { describe, it, expect } from 'vitest';
import { computeAppointmentStats } from './appointment-stats';

// =============================================================================
// These counts replaced three `count: 'exact'` Postgres queries, so the window
// boundaries have to match what those queries asked for exactly:
//
//   today  → appointment_date = today (IST)
//   week   → Monday..Sunday containing today (IST)
//   month  → 1st..last day of the current month (IST)
//
// The windows overlap on purpose: an appointment today is also in this week and
// this month, exactly as three separate range queries would have counted it.
// =============================================================================

const rows = (...dates: (string | null)[]) => dates.map((appointment_date) => ({ appointment_date }));

describe('computeAppointmentStats', () => {
  // 27 Aug 2026 18:30 IST — a Thursday.
  const thursday = new Date('2026-08-27T13:00:00Z');

  it('counts today, and today also counts toward the week and month', () => {
    const s = computeAppointmentStats(rows('2026-08-27'), thursday);
    expect(s).toEqual({ today: 1, week: 1, month: 1 });
  });

  it('uses a Monday-based week', () => {
    // Week containing Thu 27 Aug 2026 is Mon 24 Aug .. Sun 30 Aug.
    const s = computeAppointmentStats(
      rows('2026-08-24', '2026-08-30', '2026-08-23', '2026-08-31'),
      thursday,
    );
    // 24th and 30th are inside; 23rd (previous Sunday) and 31st (next Monday) are not.
    expect(s.week).toBe(2);
    // All four are still in August.
    expect(s.month).toBe(4);
    expect(s.today).toBe(0);
  });

  it('bounds the month to the current calendar month', () => {
    const s = computeAppointmentStats(rows('2026-08-01', '2026-08-31', '2026-07-31', '2026-09-01'), thursday);
    expect(s.month).toBe(2);
  });

  it('handles a week that straddles a month boundary', () => {
    // Wed 2 Sep 2026 → week is Mon 31 Aug .. Sun 6 Sep.
    const wednesday = new Date('2026-09-02T13:00:00Z');
    const s = computeAppointmentStats(rows('2026-08-31', '2026-09-06'), wednesday);
    expect(s.week).toBe(2);
    // 31 Aug is in the week but NOT in September.
    expect(s.month).toBe(1);
  });

  it('handles a Sunday as the END of the week, not the start', () => {
    // Sun 30 Aug 2026 → week is still Mon 24 Aug .. Sun 30 Aug.
    const sunday = new Date('2026-08-30T13:00:00Z');
    const s = computeAppointmentStats(rows('2026-08-24', '2026-08-30', '2026-08-31'), sunday);
    expect(s.today).toBe(1);
    expect(s.week).toBe(2);
  });

  it('uses the IST calendar day, not UTC', () => {
    // 20:00 UTC on 26 Aug is already 01:30 IST on 27 Aug, so "today" is the 27th.
    const lateUtc = new Date('2026-08-26T20:00:00Z');
    const s = computeAppointmentStats(rows('2026-08-27', '2026-08-26'), lateUtc);
    expect(s.today).toBe(1);
  });

  it('handles a month end correctly', () => {
    // 31 Aug 2026 — month window must still end on the 31st.
    const lastDay = new Date('2026-08-31T13:00:00Z');
    const s = computeAppointmentStats(rows('2026-08-31', '2026-09-01'), lastDay);
    expect(s.today).toBe(1);
    expect(s.month).toBe(1);
  });

  it('handles February in a leap year', () => {
    const feb = new Date('2028-02-10T13:00:00Z');
    const s = computeAppointmentStats(rows('2028-02-29', '2028-03-01'), feb);
    expect(s.month).toBe(1);
  });

  it('ignores rows with no date instead of throwing', () => {
    const s = computeAppointmentStats(rows(null, '2026-08-27', null), thursday);
    expect(s).toEqual({ today: 1, week: 1, month: 1 });
  });

  it('tolerates a full timestamp where a date is expected', () => {
    const s = computeAppointmentStats(rows('2026-08-27T09:30:00+05:30'), thursday);
    expect(s.today).toBe(1);
  });

  it('returns zeroes for an empty schedule', () => {
    expect(computeAppointmentStats([], thursday)).toEqual({ today: 0, week: 0, month: 0 });
  });

  it('counts duplicates on the same day rather than de-duplicating', () => {
    // Three separate appointments today is a count of 3, matching COUNT(*).
    const s = computeAppointmentStats(rows('2026-08-27', '2026-08-27', '2026-08-27'), thursday);
    expect(s).toEqual({ today: 3, week: 3, month: 3 });
  });
});
