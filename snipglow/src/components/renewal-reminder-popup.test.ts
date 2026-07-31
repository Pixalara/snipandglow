import { describe, it, expect } from 'vitest';
import { istDaysUntil, stageForDaysLeft } from './renewal-reminder-popup';

// =============================================================================
// Reminder cadence: 2 days before, 1 day before, and the day of expiry.
// These must be judged on the salon's IST calendar, not raw elapsed hours.
// =============================================================================

describe('istDaysUntil', () => {
  // 10 Jul 2026, 18:30 UTC == 11 Jul 2026, 00:00 IST
  const nowIst11Jul = new Date('2026-07-10T18:30:00Z');

  it('counts calendar days, not 24-hour blocks', () => {
    expect(istDaysUntil('2026-07-13T10:00:00Z', nowIst11Jul)).toBe(2);
    expect(istDaysUntil('2026-07-12T10:00:00Z', nowIst11Jul)).toBe(1);
    expect(istDaysUntil('2026-07-11T10:00:00Z', nowIst11Jul)).toBe(0);
  });

  it('treats an end date later the same IST day as 0 (expires today)', () => {
    // 11 Jul 23:00 IST - only hours away, but still "today".
    expect(istDaysUntil('2026-07-11T17:30:00Z', nowIst11Jul)).toBe(0);
  });

  it('treats an end date early tomorrow IST as 1, even if <24h away', () => {
    // 12 Jul 01:00 IST is ~1 hour after "now", but it is tomorrow on the calendar.
    expect(istDaysUntil('2026-07-11T19:30:00Z', nowIst11Jul)).toBe(1);
  });

  it('returns negatives once past', () => {
    expect(istDaysUntil('2026-07-09T10:00:00Z', nowIst11Jul)).toBe(-2);
  });

  it('handles month and year boundaries', () => {
    const lastDayOfMonth = new Date('2026-07-31T06:00:00Z'); // 31 Jul IST
    expect(istDaysUntil('2026-08-02T06:00:00Z', lastDayOfMonth)).toBe(2);
    const newYearEve = new Date('2026-12-31T06:00:00Z');
    expect(istDaysUntil('2027-01-02T06:00:00Z', newYearEve)).toBe(2);
  });

  it('uses IST, not the server timezone, for the day boundary', () => {
    // 10 Jul 20:00 UTC is already 11 Jul in IST (+05:30).
    const justAfterIstMidnight = new Date('2026-07-10T20:00:00Z');
    expect(istDaysUntil('2026-07-11T10:00:00Z', justAfterIstMidnight)).toBe(0);
  });
});

describe('stageForDaysLeft', () => {
  it('fires the three reminder stages', () => {
    expect(stageForDaysLeft(2)).toBe('two_days');
    expect(stageForDaysLeft(1)).toBe('tomorrow');
    expect(stageForDaysLeft(0)).toBe('today');
  });

  it('stays silent when renewal is further out', () => {
    for (const d of [3, 4, 7, 15, 30, 365]) {
      expect(stageForDaysLeft(d)).toBeNull();
    }
  });

  it('stays silent once expired (the lockout guard takes over)', () => {
    expect(stageForDaysLeft(-1)).toBeNull();
    expect(stageForDaysLeft(-30)).toBeNull();
  });
});
