// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  trackSignupConversion,
  SIGNUP_CONVERSION_SEND_TO,
  GOOGLE_ADS_ID,
} from './gtag';

// =============================================================================
// Conversion reporting must be exactly-once per signup. A double fire would
// inflate Google Ads data and skew cost-per-acquisition, so the guards are
// covered explicitly.
// =============================================================================

describe('Google Ads config', () => {
  it('uses the account tag and the Sign-up conversion label', () => {
    expect(GOOGLE_ADS_ID).toBe('AW-18361807295');
    expect(SIGNUP_CONVERSION_SEND_TO).toBe('AW-18361807295/-J1zCOfOgt4cEL_jy7NE');
    // The send_to must always be scoped to the account tag.
    expect(SIGNUP_CONVERSION_SEND_TO.startsWith(`${GOOGLE_ADS_ID}/`)).toBe(true);
  });
});

describe('trackSignupConversion', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.gtag = vi.fn();
  });

  it('sends the conversion with value and INR currency', () => {
    trackSignupConversion('tenant-1');
    expect(window.gtag).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith('event', 'conversion', {
      send_to: SIGNUP_CONVERSION_SEND_TO,
      value: 1.0,
      currency: 'INR',
    });
  });

  it('fires only once for the same signup', () => {
    trackSignupConversion('tenant-1');
    trackSignupConversion('tenant-1');
    trackSignupConversion('tenant-1');
    expect(window.gtag).toHaveBeenCalledTimes(1);
  });

  it('still reports separate signups', () => {
    trackSignupConversion('tenant-1');
    trackSignupConversion('tenant-2');
    expect(window.gtag).toHaveBeenCalledTimes(2);
  });

  it('no-ops safely when the tag has not loaded yet', () => {
    window.gtag = undefined;
    expect(() => trackSignupConversion('tenant-3')).not.toThrow();
    // Nothing was recorded, so a later attempt can still succeed.
    const spy = vi.fn();
    window.gtag = spy;
    trackSignupConversion('tenant-3');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not throw when localStorage is unavailable', () => {
    const spy = vi.fn();
    window.gtag = spy;
    const getItem = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => trackSignupConversion('tenant-4')).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
