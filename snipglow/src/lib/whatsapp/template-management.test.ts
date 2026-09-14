import { describe, it, expect } from 'vitest';
import {
  normalizeTemplateName,
  extractPlaceholders,
  validateDefinition,
  mapMetaTemplateStatus,
  buildCreatePayload,
  type TemplateDefinition,
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
