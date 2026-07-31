import { describe, it, expect } from 'vitest';
import {
  renderAnnouncementEmail,
  ONLINE_RENEWAL_CAMPAIGN,
  DEFAULT_CAMPAIGN,
  CAMPAIGN_PRESETS,
} from './announcement';

describe('announcement templates', () => {
  it('uses plain hyphens, never em/en dashes', () => {
    for (const { label, campaign } of CAMPAIGN_PRESETS.map((p) => ({ label: p.label, campaign: p.campaign }))) {
      const { html, text, subject } = renderAnnouncementEmail(campaign, { salonName: 'Test Salon' });
      const blob = `${subject}\n${text}\n${html}`;
      expect(blob, `${label} contains an em dash`).not.toMatch(/\u2014/);
      expect(blob, `${label} contains an en dash`).not.toMatch(/\u2013/);
    }
  });

  it('shows the highlighted Razorpay badge on the renewal campaign', () => {
    const { html } = renderAnnouncementEmail(ONLINE_RENEWAL_CAMPAIGN, { salonName: 'Test Salon' });
    expect(html).toContain('SECURED BY');
    expect(html).toContain('Razorpay');
  });

  it('keeps the plain Product Update tag for campaigns without a partner badge', () => {
    const { html } = renderAnnouncementEmail(DEFAULT_CAMPAIGN, { salonName: 'Test Salon' });
    expect(html).toContain('Product Update');
    expect(html).not.toContain('SECURED BY');
  });

  it('personalises the greeting and includes the CTA link', () => {
    const { html } = renderAnnouncementEmail(ONLINE_RENEWAL_CAMPAIGN, { salonName: 'Bloom Salon' });
    expect(html).toContain('Bloom Salon team');
    expect(html).toContain('https://snipandglow.com/dashboard/settings');
  });

  it('escapes HTML in user-supplied copy', () => {
    const { html } = renderAnnouncementEmail(
      { ...ONLINE_RENEWAL_CAMPAIGN, headline: '<script>alert(1)</script>' },
      { salonName: 'X' }
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
