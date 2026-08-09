import { describe, it, expect } from 'vitest';
import {
  WELCOME_TEMPLATE,
  welcomeTemplateParams,
  buildWelcomeText,
} from './welcome-whatsapp';

// =============================================================================
// The send itself is network I/O, but the template parameter is worth pinning:
// Meta rejects a blank placeholder outright, so an unnamed salon must still
// produce a usable value rather than failing the send.
// =============================================================================

describe('welcomeTemplateParams', () => {
  it('passes the salon name through', () => {
    expect(welcomeTemplateParams({ salonName: 'Glow Studio', phone: '9876543210' })).toEqual([
      'Glow Studio',
    ]);
  });

  it('trims surrounding whitespace', () => {
    expect(welcomeTemplateParams({ salonName: '  Glow Studio  ', phone: '9876543210' })).toEqual([
      'Glow Studio',
    ]);
  });

  it('substitutes a readable fallback rather than sending an empty param', () => {
    expect(welcomeTemplateParams({ salonName: '', phone: '9876543210' })).toEqual(['your salon']);
    expect(welcomeTemplateParams({ salonName: '   ', phone: '9876543210' })).toEqual(['your salon']);
  });

  it('supplies exactly one param, matching the approved template', () => {
    expect(welcomeTemplateParams({ salonName: 'Glow Studio', phone: '9' })).toHaveLength(1);
  });
});

describe('buildWelcomeText', () => {
  const text = buildWelcomeText({ salonName: 'Glow Studio', phone: '9876543210' });

  it('personalises with the salon name', () => {
    expect(text).toContain('Glow Studio');
  });

  it('lists every feature promised in the template copy', () => {
    for (const feature of [
      'WhatsApp Bookings',
      'Automatic Appointment Reminders',
      'Customer Management',
      'Billing and Invoices',
      'Feedback and Follow-ups',
    ]) {
      expect(text).toContain(feature);
    }
  });

  it('signs off with the brand footer', () => {
    expect(text).toContain('Team SnipandGlow - Powered by Pixalara LLP');
  });

  it('uses plain hyphens, never em or en dashes', () => {
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });

  it('stays inside the 1024 character WhatsApp body limit', () => {
    expect(text.length).toBeLessThanOrEqual(1024);
  });

  it('defaults the template name', () => {
    expect(WELCOME_TEMPLATE).toBe('salon_welcome');
  });
});
