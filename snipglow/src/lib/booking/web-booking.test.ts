import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { toIndiaE164, webBookingUrl } from './web-booking';

describe('toIndiaE164', () => {
  it('accepts a bare 10-digit Indian mobile', () => {
    expect(toIndiaE164('9099111047')).toBe('+919099111047');
  });

  it('strips spaces, dashes and punctuation', () => {
    expect(toIndiaE164('90991-11047')).toBe('+919099111047');
    expect(toIndiaE164('+91 90991 11047')).toBe('+919099111047');
    expect(toIndiaE164('(909) 911-1047')).toBe('+919099111047');
  });

  it('normalises the 91 country prefix and a leading 0', () => {
    expect(toIndiaE164('919099111047')).toBe('+919099111047');
    expect(toIndiaE164('09099111047')).toBe('+919099111047');
  });

  it('rejects numbers that are not valid Indian mobiles', () => {
    expect(toIndiaE164('12345')).toBeNull();       // too short
    expect(toIndiaE164('1234567890')).toBeNull();   // does not start 6-9
    expect(toIndiaE164('5099111047')).toBeNull();   // starts with 5
    expect(toIndiaE164('90991110470')).toBeNull();   // 11 digits, no 0 prefix
    expect(toIndiaE164('')).toBeNull();
  });
});

describe('webBookingUrl', () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = original;
  });

  it('turns a tenant code into a lowercase, dash-free slug', () => {
    expect(webBookingUrl('SNG-009')).toBe('https://www.snipandglow.com/book/sng009');
  });

  it('honours NEXT_PUBLIC_APP_URL and trims a trailing slash', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://snipandglow.com/';
    expect(webBookingUrl('SNG-042')).toBe('https://snipandglow.com/book/sng042');
  });
});
