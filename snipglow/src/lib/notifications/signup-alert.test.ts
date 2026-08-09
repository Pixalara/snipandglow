import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_SIGNUP_ALERT_EMAIL,
  parseRecipients,
  signupAlertEmails,
  signupAlertWhatsAppNumbers,
  formatAlertDate,
  formatAlertLocation,
  adminTenantLink,
  signupAlertSubject,
  buildSignupAlertText,
  buildSignupAlertEmail,
  signupAlertTemplateParams,
  isSyntheticEmail,
  realEmail,
  type SignupAlert,
} from './signup-alert-content';

// =============================================================================
// The alert itself is best-effort I/O, but the recipient parsing and the message
// bodies are pure and worth locking down: a bad phone normalisation would send a
// signup alert to a stranger, and a missing recipient list would silently drop
// notifications.
// =============================================================================

const ENV_KEYS = [
  'SIGNUP_ALERT_EMAILS',
  'SIGNUP_ALERT_WHATSAPP',
  'PLATFORM_ADMIN_EMAILS',
  'NEXT_PUBLIC_APP_URL',
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const alert: SignupAlert = {
  tenantId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  tenantCode: 'SNG-042',
  salonName: 'Glow Studio',
  ownerName: 'Asha Rao',
  phone: '9876543210',
  email: 'asha@example.com',
  city: 'Pune',
  state: 'Maharashtra',
  pincode: '411001',
  planTier: 'starter',
  trialEnd: '2026-08-24T10:00:00.000Z',
};

describe('parseRecipients', () => {
  it('splits on commas, semicolons and whitespace', () => {
    expect(parseRecipients('a@x.com, b@x.com;c@x.com d@x.com')).toEqual([
      'a@x.com',
      'b@x.com',
      'c@x.com',
      'd@x.com',
    ]);
  });

  it('returns an empty list for blank or missing input', () => {
    expect(parseRecipients(undefined)).toEqual([]);
    expect(parseRecipients('')).toEqual([]);
    expect(parseRecipients('  ,  ; ')).toEqual([]);
  });
});

describe('signupAlertEmails', () => {
  it('prefers the explicit list', () => {
    process.env.SIGNUP_ALERT_EMAILS = 'Ops@Pixalara.com';
    expect(signupAlertEmails()).toEqual(['ops@pixalara.com']);
  });

  it('supports several addresses', () => {
    process.env.SIGNUP_ALERT_EMAILS = 'a@pixalara.com, b@pixalara.com';
    expect(signupAlertEmails()).toEqual(['a@pixalara.com', 'b@pixalara.com']);
  });

  it('deduplicates', () => {
    process.env.SIGNUP_ALERT_EMAILS = 'ops@pixalara.com, OPS@pixalara.com';
    expect(signupAlertEmails()).toEqual(['ops@pixalara.com']);
  });

  it('defaults to the sales mailbox so alerts are never silently dropped', () => {
    expect(signupAlertEmails()).toEqual([DEFAULT_SIGNUP_ALERT_EMAIL]);
    expect(DEFAULT_SIGNUP_ALERT_EMAIL).toBe('snipandglow.sales@pixalara.com');
  });

  it('ignores PLATFORM_ADMIN_EMAILS, which is an access list not an alert list', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'admin@pixalara.com';
    expect(signupAlertEmails()).toEqual([DEFAULT_SIGNUP_ALERT_EMAIL]);
  });
});

describe('signupAlertWhatsAppNumbers', () => {
  it('normalises 10-digit Indian numbers to 91XXXXXXXXXX', () => {
    process.env.SIGNUP_ALERT_WHATSAPP = '9876543210';
    expect(signupAlertWhatsAppNumbers()).toEqual(['919876543210']);
  });

  it('accepts already-prefixed and formatted numbers', () => {
    process.env.SIGNUP_ALERT_WHATSAPP = '+91 98765 43210';
    expect(signupAlertWhatsAppNumbers()).toEqual(['919876543210']);
  });

  it('drops anything that is not a valid 12-digit number', () => {
    process.env.SIGNUP_ALERT_WHATSAPP = '12345,9876543210,abc';
    expect(signupAlertWhatsAppNumbers()).toEqual(['919876543210']);
  });

  it('deduplicates numbers written in different formats', () => {
    process.env.SIGNUP_ALERT_WHATSAPP = '9876543210, +919876543210';
    expect(signupAlertWhatsAppNumbers()).toEqual(['919876543210']);
  });

  it('is empty when unset, so the channel simply no-ops', () => {
    expect(signupAlertWhatsAppNumbers()).toEqual([]);
  });
});

describe('formatAlertDate', () => {
  it('formats in IST', () => {
    expect(formatAlertDate('2026-08-24T10:00:00.000Z')).toBe('24 Aug 2026');
  });

  it('uses the IST calendar day, not UTC', () => {
    // 23:00 UTC is already the next day in IST (+5:30).
    expect(formatAlertDate('2026-08-24T23:00:00.000Z')).toBe('25 Aug 2026');
  });

  it('degrades to a dash for missing or invalid input', () => {
    expect(formatAlertDate(null)).toBe('-');
    expect(formatAlertDate('not-a-date')).toBe('-');
  });
});

describe('formatAlertLocation', () => {
  it('joins city, state and pincode', () => {
    expect(formatAlertLocation(alert)).toBe('Pune, Maharashtra - 411001');
  });

  it('omits missing parts', () => {
    expect(formatAlertLocation({ ...alert, pincode: null })).toBe('Pune, Maharashtra');
    expect(formatAlertLocation({ ...alert, city: null, state: null })).toBe('411001');
    expect(formatAlertLocation({ ...alert, city: null, state: null, pincode: null })).toBe('-');
  });
});

describe('adminTenantLink', () => {
  it('is absolute when the app URL is configured', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://snipandglow.com';
    expect(adminTenantLink('t1')).toBe('https://snipandglow.com/admin/tenants/t1');
  });

  it('tolerates a trailing slash', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://snipandglow.com/';
    expect(adminTenantLink('t1')).toBe('https://snipandglow.com/admin/tenants/t1');
  });

  it('falls back to a relative path', () => {
    expect(adminTenantLink('t1')).toBe('/admin/tenants/t1');
  });
});

describe('message bodies', () => {
  it('puts the salon and code in the subject', () => {
    expect(signupAlertSubject(alert)).toBe('New signup: Glow Studio (SNG-042)');
    expect(signupAlertSubject({ ...alert, tenantCode: null })).toBe('New signup: Glow Studio');
  });

  it('includes the key details in the WhatsApp text', () => {
    const text = buildSignupAlertText(alert);
    expect(text).toContain('Glow Studio (SNG-042)');
    expect(text).toContain('Asha Rao');
    expect(text).toContain('+919876543210');
    expect(text).toContain('Pune, Maharashtra - 411001');
    expect(text).toContain('24 Aug 2026');
  });

  it('skips optional lines that have no value', () => {
    const text = buildSignupAlertText({
      ...alert,
      email: null,
      trialEnd: null,
      city: null,
      state: null,
      pincode: null,
    });
    expect(text).not.toContain('Email:');
    expect(text).not.toContain('Trial ends:');
    expect(text).not.toContain('Location:');
  });

  it('renders an HTML email with a link to the admin panel', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://snipandglow.com';
    const html = buildSignupAlertEmail(alert);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('New salon signed up');
    expect(html).toContain(`https://snipandglow.com/admin/tenants/${alert.tenantId}`);
    expect(html).toContain('Glow Studio (SNG-042)');
  });

  it('supplies template params in the declared order', () => {
    // Order must match the approved WhatsApp template body, or values land in
    // the wrong placeholders.
    expect(signupAlertTemplateParams(alert)).toEqual([
      'Glow Studio (SNG-042)',
      'Asha Rao',
      '+919876543210',
      'asha@example.com',
      'Pune, Maharashtra - 411001',
      '24 Aug 2026',
    ]);
  });

  it('never leaves a template param empty, which Meta rejects', () => {
    const params = signupAlertTemplateParams({
      ...alert,
      email: null,
      city: null,
      state: null,
      pincode: null,
      trialEnd: null,
    });
    expect(params).toHaveLength(6);
    for (const p of params) expect(p.trim().length).toBeGreaterThan(0);
  });

  it('never surfaces a synthetic phone-signup email', () => {
    const phoneSignup = { ...alert, email: '919876543210@phone.snipandglow.com' };
    expect(realEmail(phoneSignup)).toBeNull();
    expect(signupAlertTemplateParams(phoneSignup)[3]).toBe('Not provided');
    expect(buildSignupAlertText(phoneSignup)).not.toContain('phone.snipandglow.com');
    expect(buildSignupAlertEmail(phoneSignup)).not.toContain('phone.snipandglow.com');
  });

  it('treats staff placeholder addresses as synthetic too', () => {
    expect(isSyntheticEmail('9876543210@staff.snipandglow.com')).toBe(true);
    expect(isSyntheticEmail('ASHA@Example.com')).toBe(false);
    expect(isSyntheticEmail(null)).toBe(false);
  });

  it('escapes HTML so a salon name cannot inject markup', () => {
    const html = buildSignupAlertEmail({
      ...alert,
      tenantCode: null,
      salonName: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
