import { describe, it, expect } from 'vitest';
import {
  isSyntheticEmail,
  hasGoogleVerified,
  hasPhoneVerified,
  verifiedPhone,
  realEmail,
  getSignupState,
  nextSignupStep,
  type SignupUserLike,
} from './signup-state';

// =============================================================================
// These helpers decide where a half-finished signup gets sent, so the two cases
// that matter most are:
//
//   • a phone-only account must NOT be able to reach onboarding (that is how a
//     tenant was created with a fabricated @phone.snipandglow.com address), and
//   • an account that already owns a salon must NEVER be re-gated, or existing
//     paying customers get locked out.
// =============================================================================

const googleUser: SignupUserLike = {
  email: 'pranjal@gmail.com',
  app_metadata: { provider: 'google', providers: ['google'] },
  user_metadata: {},
};

const phoneOnlyUser: SignupUserLike = {
  email: '919586616092@phone.snipandglow.com',
  phone: '919586616092',
  app_metadata: { provider: 'email', providers: ['email', 'phone'] },
  user_metadata: { phone: '919586616092', signup_method: 'phone_otp' },
};

describe('isSyntheticEmail', () => {
  it('flags the fabricated phone and staff addresses', () => {
    expect(isSyntheticEmail('919586616092@phone.snipandglow.com')).toBe(true);
    expect(isSyntheticEmail('9876543210@staff.snipandglow.com')).toBe(true);
    // The retired edge function used a different host.
    expect(isSyntheticEmail('919876543210@phone.snipglow.app')).toBe(true);
  });

  it('accepts real addresses and is case-insensitive', () => {
    expect(isSyntheticEmail('pranjal@gmail.com')).toBe(false);
    expect(isSyntheticEmail('ASHA@Example.com')).toBe(false);
    expect(isSyntheticEmail('Owner@PHONE.SnipAndGlow.com')).toBe(true);
  });

  it('treats empty input as not synthetic rather than throwing', () => {
    expect(isSyntheticEmail(null)).toBe(false);
    expect(isSyntheticEmail(undefined)).toBe(false);
    expect(isSyntheticEmail('')).toBe(false);
  });

  it('does not match a lookalike domain', () => {
    // Must anchor on the suffix, not a substring.
    expect(isSyntheticEmail('a@phone.snipandglow.com.evil.com')).toBe(false);
  });
});

describe('hasGoogleVerified', () => {
  it('is true when Google is in the provider list', () => {
    expect(hasGoogleVerified(googleUser)).toBe(true);
    expect(hasGoogleVerified({ app_metadata: { providers: ['email', 'google'] } })).toBe(true);
  });

  it('falls back to a real email for accounts predating provider metadata', () => {
    expect(hasGoogleVerified({ email: 'owner@gmail.com' })).toBe(true);
  });

  it('is false for a phone-only account', () => {
    expect(hasGoogleVerified(phoneOnlyUser)).toBe(false);
  });

  it('is false for staff placeholder logins', () => {
    expect(hasGoogleVerified({ email: '9876543210@staff.snipandglow.com' })).toBe(false);
  });

  it('is false for null/empty users', () => {
    expect(hasGoogleVerified(null)).toBe(false);
    expect(hasGoogleVerified({})).toBe(false);
  });
});

describe('hasPhoneVerified', () => {
  it('reads the metadata phone written by the verification step', () => {
    expect(hasPhoneVerified({ user_metadata: { phone: '919586616092' } })).toBe(true);
  });

  it('falls back to the native Supabase phone column', () => {
    expect(hasPhoneVerified({ phone: '919586616092' })).toBe(true);
  });

  it('is false when absent or blank', () => {
    expect(hasPhoneVerified({ user_metadata: { phone: '   ' } })).toBe(false);
    expect(hasPhoneVerified({ user_metadata: {} })).toBe(false);
    expect(hasPhoneVerified(null)).toBe(false);
  });

  it('ignores a non-string phone', () => {
    expect(hasPhoneVerified({ user_metadata: { phone: 919586616092 as unknown as string } })).toBe(false);
  });
});

describe('verifiedPhone / realEmail', () => {
  it('prefers the metadata phone', () => {
    expect(verifiedPhone({ user_metadata: { phone: '919999' }, phone: '918888' })).toBe('919999');
  });

  it('falls back to the native column, else null', () => {
    expect(verifiedPhone({ phone: '918888' })).toBe('918888');
    expect(verifiedPhone({})).toBeNull();
  });

  it('returns null for a placeholder email', () => {
    expect(realEmail(phoneOnlyUser)).toBeNull();
    expect(realEmail(googleUser)).toBe('pranjal@gmail.com');
  });
});

describe('getSignupState routing', () => {
  it('sends a brand new phone-only account back to Google signup', () => {
    // The critical fix: this used to land on /onboarding and create a tenant.
    const s = getSignupState(phoneOnlyUser);
    expect(s.google).toBe(false);
    expect(s.phone).toBe(true);
    expect(s.next).toBe('/signup');
  });

  it('sends a Google account with no phone to WhatsApp verification', () => {
    const s = getSignupState(googleUser);
    expect(s.google).toBe(true);
    expect(s.phone).toBe(false);
    expect(s.next).toBe('/verify-phone');
  });

  it('sends a fully verified account with no salon to onboarding', () => {
    const s = getSignupState({ ...googleUser, user_metadata: { phone: '919586616092' } });
    expect(s).toMatchObject({ google: true, phone: true, tenant: false, next: '/onboarding' });
  });

  it('sends a completed signup to the dashboard', () => {
    const s = getSignupState({
      ...googleUser,
      user_metadata: { phone: '919586616092', tenant_id: 'abc-123' },
    });
    expect(s.next).toBe('/dashboard');
  });

  it('NEVER re-gates an account that already owns a salon', () => {
    // Grandfathering. SNG-009 has a synthetic email and no Google, but it is a
    // live tenant — re-gating would lock a paying customer out of the product.
    const legacy = { ...phoneOnlyUser, user_metadata: { ...phoneOnlyUser.user_metadata, tenant_id: 'sng-009' } };
    const s = getSignupState(legacy);
    expect(s.google).toBe(false);
    expect(s.tenant).toBe(true);
    expect(s.next).toBe('/dashboard');
  });

  it('lets staff placeholder logins through once they have a tenant', () => {
    // Staff are created by the owner with a tenant_id already attached, so they
    // must never be pushed into the owner signup flow.
    const staff = {
      email: '9876543210@staff.snipandglow.com',
      user_metadata: { tenant_id: 'abc-123', role: 'staff', phone: '9876543210' },
    };
    expect(nextSignupStep(staff)).toBe('/dashboard');
  });

  it('treats a signed-out user as needing to start at signup', () => {
    expect(nextSignupStep(null)).toBe('/signup');
  });

  it('requires BOTH factors for every route other than /dashboard', () => {
    // Property check: if next is /onboarding then both factors must be true.
    const cases: SignupUserLike[] = [
      {},
      phoneOnlyUser,
      googleUser,
      { ...googleUser, user_metadata: { phone: '919586616092' } },
    ];
    for (const u of cases) {
      const s = getSignupState(u);
      if (s.next === '/onboarding') {
        expect(s.google && s.phone).toBe(true);
      }
    }
  });
});
