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

  it('renders ticks as fixed-size table cells, not line-height divs', () => {
    const { html } = renderAnnouncementEmail(ONLINE_RENEWAL_CAMPAIGN, { salonName: 'X' });
    // Regression guard: the old markup centred the glyph with a div + line-height,
    // which mobile clients strip — the tick then escaped its coloured box.
    expect(html).not.toMatch(/<div[^>]*height:26px[^>]*>&#10003;<\/div>/);
    expect(html).toContain('valign="middle"');
    expect(html).toContain('mso-line-height-rule:exactly');
    // Every bullet must have a sized tick cell.
    const tickCells = html.match(/class="sg-tick"/g) ?? [];
    expect(tickCells.length).toBe(ONLINE_RENEWAL_CAMPAIGN.bullets.length);
  });

  it('keeps a gap between the tick and its text', () => {
    const { html } = renderAnnouncementEmail(ONLINE_RENEWAL_CAMPAIGN, { salonName: 'X' });
    // Text cell carries explicit left padding so the copy never touches the tick.
    expect(html).toContain('class="sg-bullet-text" style="padding:0 0 14px 14px;');
    expect(html).toContain('.sg-bullet-text { padding-left:12px !important; }');
  });

  it('includes mobile media queries and responsive hooks', () => {
    const { html } = renderAnnouncementEmail(ONLINE_RENEWAL_CAMPAIGN, { salonName: 'X' });
    expect(html).toContain('@media only screen and (max-width:600px)');
    expect(html).toContain('viewport');
    for (const cls of ['sg-pad', 'sg-head', 'sg-h1', 'sg-tick', 'sg-cta']) {
      expect(html, `missing responsive class ${cls}`).toContain(cls);
    }
  });

  it('falls back to brand fuchsia (not blue-violet) where gradients are unsupported', () => {
    const { html } = renderAnnouncementEmail(ONLINE_RENEWAL_CAMPAIGN, { salonName: 'X' });
    // Gmail's mobile app ignores linear-gradient and paints the solid `background`.
    // It must be the fuchsia mid-tone so mobile matches desktop instead of looking blue.
    const fallbacks = html.match(/background:#d946ef;background-image:linear-gradient/g) ?? [];
    expect(fallbacks.length).toBeGreaterThanOrEqual(3); // header + ticks + CTA
    // The old violet fallback read as blue on mobile - guard against it returning.
    expect(html).not.toContain('background:#8b5cf6;');
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
