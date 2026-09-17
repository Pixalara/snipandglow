import { describe, it, expect } from 'vitest';
import {
  normalizeTemplateName,
  extractPlaceholders,
  validateDefinition,
  mapMetaTemplateStatus,
  buildCreatePayload,
  metaTemplateToCreatePayload,
  type TemplateDefinition,
  type MetaTemplateFull,
} from './template-management';
import { MARKETING_TEMPLATE_PRESETS } from './template-presets';

describe('normalizeTemplateName', () => {
  it('lowercases and replaces runs of non-alphanumerics with a single underscore', () => {
    expect(normalizeTemplateName('Birthday Offer!')).toBe('birthday_offer');
    expect(normalizeTemplateName('  Festival   2025  ')).toBe('festival_2025');
    expect(normalizeTemplateName('a--b__c')).toBe('a_b_c');
  });

  it('trims leading/trailing underscores and falls back when empty', () => {
    expect(normalizeTemplateName('___hi___')).toBe('hi');
    expect(normalizeTemplateName('!!!')).toBe('template');
    expect(normalizeTemplateName('')).toBe('template');
  });
});

describe('extractPlaceholders', () => {
  it('returns positional indexes in order, tolerating whitespace', () => {
    expect(extractPlaceholders('Hi {{1}}, from {{2}} — {{1}} again')).toEqual([1, 2, 1]);
    expect(extractPlaceholders('Hi {{ 3 }}')).toEqual([3]);
    expect(extractPlaceholders('no vars here')).toEqual([]);
  });
});

describe('validateDefinition', () => {
  const base: TemplateDefinition = {
    name: 'promo',
    bodyText: 'Hi {{1}}, get {{2}}% off at {{3}}.',
    exampleParams: ['Priya', '20', 'Glow Salon'],
  };

  it('accepts a well-formed definition', () => {
    expect(validateDefinition(base).ok).toBe(true);
  });

  it('rejects an empty body', () => {
    const r = validateDefinition({ ...base, bodyText: '   ' });
    expect(r.ok).toBe(false);
  });

  it('rejects a missing name', () => {
    const r = validateDefinition({ ...base, name: '   ' });
    expect(r.ok).toBe(false);
  });

  it('rejects gaps in placeholder numbering', () => {
    const r = validateDefinition({
      ...base,
      bodyText: 'Hi {{1}} and {{3}}',
      exampleParams: ['a', 'b', 'c'],
    });
    expect(r.ok).toBe(false);
  });

  it('rejects a mismatch between placeholder count and example count', () => {
    const r = validateDefinition({ ...base, exampleParams: ['Priya', '20'] });
    expect(r.ok).toBe(false);
  });

  it('rejects blank example values', () => {
    const r = validateDefinition({ ...base, exampleParams: ['Priya', '  ', 'Glow Salon'] });
    expect(r.ok).toBe(false);
  });

  it('accepts a body with no placeholders and no examples', () => {
    expect(validateDefinition({ name: 'hello', bodyText: 'Hello from us!', exampleParams: [] }).ok).toBe(true);
  });
});

describe('mapMetaTemplateStatus', () => {
  it('normalises Meta statuses into the local enum', () => {
    expect(mapMetaTemplateStatus('APPROVED')).toBe('APPROVED');
    expect(mapMetaTemplateStatus('REINSTATED')).toBe('APPROVED');
    expect(mapMetaTemplateStatus('REJECTED')).toBe('REJECTED');
    expect(mapMetaTemplateStatus('FLAGGED')).toBe('PAUSED');
    expect(mapMetaTemplateStatus('LIMIT_EXCEEDED')).toBe('PAUSED');
    expect(mapMetaTemplateStatus('PENDING_DELETION')).toBe('DISABLED');
    expect(mapMetaTemplateStatus('IN_APPEAL')).toBe('PENDING');
    expect(mapMetaTemplateStatus('something_new')).toBe('PENDING');
    expect(mapMetaTemplateStatus(null)).toBe('PENDING');
  });
});

describe('buildCreatePayload', () => {
  it('builds body-only payload with the example row shape Meta expects', () => {
    const payload = buildCreatePayload({
      name: 'Promo Blast',
      bodyText: 'Hi {{1}}',
      exampleParams: ['Priya'],
    });
    expect(payload.name).toBe('promo_blast');
    expect(payload.category).toBe('MARKETING');
    expect(payload.language).toBe('en');
    expect(payload.components).toHaveLength(1);
    expect(payload.components[0]).toMatchObject({
      type: 'BODY',
      text: 'Hi {{1}}',
      example: { body_text: [['Priya']] },
    });
  });

  it('includes header and footer components when supplied', () => {
    const payload = buildCreatePayload({
      name: 'promo',
      bodyText: 'Body {{1}}',
      exampleParams: ['x'],
      headerText: 'Big News',
      footerText: 'Reply STOP to unsubscribe.',
    });
    const types = payload.components.map((c) => c.type);
    expect(types).toEqual(['HEADER', 'BODY', 'FOOTER']);
    expect(payload.components[0]).toMatchObject({ type: 'HEADER', format: 'TEXT', text: 'Big News' });
    expect(payload.components[2]).toMatchObject({ type: 'FOOTER', text: 'Reply STOP to unsubscribe.' });
  });

  it('omits the body example when there are no placeholders', () => {
    const payload = buildCreatePayload({ name: 'hi', bodyText: 'Hello!', exampleParams: [] });
    expect(payload.components[0].example).toBeUndefined();
  });
});

describe('marketing presets', () => {
  it('are all valid, MARKETING, with matching example + label counts', () => {
    expect(MARKETING_TEMPLATE_PRESETS.length).toBeGreaterThan(0);
    for (const p of MARKETING_TEMPLATE_PRESETS) {
      expect(validateDefinition(p.definition).ok, `${p.key} should validate`).toBe(true);
      expect(p.definition.category).toBe('MARKETING');
      // Name is already canonical (normalising is a no-op).
      expect(normalizeTemplateName(p.definition.name)).toBe(p.definition.name);
      // One example + one human label per placeholder.
      const count = Math.max(0, ...extractPlaceholders(p.definition.bodyText));
      expect(p.definition.exampleParams.length).toBe(count);
      expect(p.variableLabels.length).toBe(count);
    }
  });

  it('use plain hyphens, never em/en dashes', () => {
    for (const p of MARKETING_TEMPLATE_PRESETS) {
      const blob = `${p.definition.bodyText}\n${p.definition.footerText ?? ''}`;
      expect(blob, `${p.key} em dash`).not.toMatch(/\u2014/);
      expect(blob, `${p.key} en dash`).not.toMatch(/\u2013/);
    }
  });
});

describe('metaTemplateToCreatePayload (clone transform)', () => {
  const base = (components: MetaTemplateFull['components']): MetaTemplateFull => ({
    name: 'booking_confirmation_v2',
    language: 'en',
    category: 'UTILITY',
    status: 'APPROVED',
    components,
  });

  it('carries over a body with its example, category and language', () => {
    const { payload, skipReason } = metaTemplateToCreatePayload(
      base([{ type: 'BODY', text: 'Hi {{1}}, booked for {{2}}.', example: { body_text: [['Priya', 'Haircut']] } }])
    );
    expect(skipReason).toBeUndefined();
    expect(payload).toBeDefined();
    expect(payload!.name).toBe('booking_confirmation_v2');
    expect(payload!.category).toBe('UTILITY');
    expect(payload!.language).toBe('en');
    expect(payload!.components[0]).toMatchObject({
      type: 'BODY',
      text: 'Hi {{1}}, booked for {{2}}.',
      example: { body_text: [['Priya', 'Haircut']] },
    });
  });

  it('carries text header, footer and quick-reply + dynamic URL buttons (with the URL example)', () => {
    const { payload } = metaTemplateToCreatePayload(
      base([
        { type: 'HEADER', format: 'TEXT', text: 'Booking at {{1}}', example: { header_text: ['Glow'] } },
        { type: 'BODY', text: 'Hi {{1}}', example: { body_text: [['Priya']] } },
        { type: 'FOOTER', text: 'See you soon' },
        {
          type: 'BUTTONS',
          buttons: [
            { type: 'QUICK_REPLY', text: 'Reschedule' },
            { type: 'QUICK_REPLY', text: 'Cancel' },
            { type: 'URL', text: 'Add to Calendar', url: 'https://www.snipandglow.com/cal/{{1}}', example: ['https://www.snipandglow.com/cal/abc'] },
          ],
        },
      ])
    );
    const types = payload!.components.map((c) => c.type);
    expect(types).toEqual(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']);
    expect(payload!.components[0]).toMatchObject({ type: 'HEADER', format: 'TEXT', example: { header_text: ['Glow'] } });
    const buttons = payload!.components[3].buttons!;
    expect(buttons.map((b) => b.type)).toEqual(['QUICK_REPLY', 'QUICK_REPLY', 'URL']);
    expect(buttons[2]).toMatchObject({ type: 'URL', text: 'Add to Calendar', url: 'https://www.snipandglow.com/cal/{{1}}', example: ['https://www.snipandglow.com/cal/abc'] });
  });

  it('synthesises a URL example when a dynamic URL button has none', () => {
    const { payload } = metaTemplateToCreatePayload(
      base([
        { type: 'BODY', text: 'Hi {{1}}', example: { body_text: [['Priya']] } },
        { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Add to Calendar', url: 'https://www.snipandglow.com/cal/{{1}}' }] },
      ])
    );
    expect(payload!.components[1].buttons![0].example).toEqual(['https://www.snipandglow.com/cal/sample']);
  });

  it('skips templates with a media (document) header', () => {
    const { payload, skipReason } = metaTemplateToCreatePayload(
      base([
        { type: 'HEADER', format: 'DOCUMENT', example: { header_handle: ['https://x/y.pdf'] } },
        { type: 'BODY', text: 'Hi {{1}}', example: { body_text: [['Priya']] } },
      ])
    );
    expect(payload).toBeUndefined();
    expect(skipReason).toMatch(/document header/i);
  });

  it('skips templates with no body component', () => {
    const { payload, skipReason } = metaTemplateToCreatePayload(base([{ type: 'FOOTER', text: 'x' }]));
    expect(payload).toBeUndefined();
    expect(skipReason).toMatch(/no body/i);
  });

  it('normalises category to UTILITY when Meta reports something unexpected', () => {
    const t = base([{ type: 'BODY', text: 'Hi' }]);
    t.category = 'SOMETHING_ELSE';
    const { payload } = metaTemplateToCreatePayload(t);
    expect(payload!.category).toBe('UTILITY');
  });
});
