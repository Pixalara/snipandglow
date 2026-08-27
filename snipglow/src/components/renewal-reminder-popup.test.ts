import { describe, it, expect } from 'vitest';
import {
  istDaysUntil,
  stageForDaysLeft,
  isUrgentStage,
  REMINDER_WINDOW_DAYS,
} from './renewal-reminder-popup';

// =============================================================================
// Reminder cadence: escalating BANDS across the final two weeks, judged on the
// salon's IST calendar rather than raw elapsed hours.
//
// The bands matter more than the exact wording: the stages used to be
// `days === 2 / 1 / 0`, so an owner who didn't log in on one of those three days
// was never warned before losing access.
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
  it('escalates through the five stages', () => {
    expect(stageForDaysLeft(0)).toBe('today');
    expect(stageForDaysLeft(1)).toBe('tomorrow');
    expect(stageForDaysLeft(2)).toBe('three_days');
    expect(stageForDaysLeft(3)).toBe('three_days');
    expect(stageForDaysLeft(4)).toBe('week');
    expect(stageForDaysLeft(7)).toBe('week');
    expect(stageForDaysLeft(8)).toBe('two_weeks');
    expect(stageForDaysLeft(14)).toBe('two_weeks');
  });

  it('warns on EVERY day inside the window, so a missed login cannot skip it', () => {
    // The whole point of the fix: no gaps between 0 and the window edge.
    for (let d = 0; d <= REMINDER_WINDOW_DAYS; d++) {
      expect(stageForDaysLeft(d), `day ${d} must warn`).not.toBeNull();
    }
  });

  it('stays silent when renewal is further out than the window', () => {
    for (const d of [REMINDER_WINDOW_DAYS + 1, 20, 30, 365]) {
      expect(stageForDaysLeft(d)).toBeNull();
    }
  });

  it('stays silent once expired (the lockout guard takes over)', () => {
    expect(stageForDaysLeft(-1)).toBeNull();
    expect(stageForDaysLeft(-30)).toBeNull();
  });

  it('is silent for nonsense input rather than throwing', () => {
    expect(stageForDaysLeft(NaN)).toBeNull();
    expect(stageForDaysLeft(Infinity)).toBeNull();
  });
});

describe('isUrgentStage', () => {
  it('takes over the screen only inside the last three days', () => {
    expect(isUrgentStage('today')).toBe(true);
    expect(isUrgentStage('tomorrow')).toBe(true);
    expect(isUrgentStage('three_days')).toBe(true);
  });

  it('leaves the earlier notices non-blocking', () => {
    // A salon two weeks from renewal is working normally; don't block the screen.
    expect(isUrgentStage('week')).toBe(false);
    expect(isUrgentStage('two_weeks')).toBe(false);
  });
});
