import { describe, it, expect } from 'vitest';
import {
  amountPayable,
  effectiveMonthlyPrice,
  effectiveYearlyTotal,
  getCustomPricing,
  hasCustomPrice,
  PLAN_PRICING,
} from './subscription';

// =============================================================================
// Per-tenant negotiated pricing — this decides what a customer is CHARGED,
// so the fallback and validation rules are covered explicitly.
// =============================================================================

describe('effectiveMonthlyPrice', () => {
  it('falls back to the plan list price when no override is set', () => {
    expect(effectiveMonthlyPrice('starter', 'monthly', {})).toBe(PLAN_PRICING.starter.monthly);
    expect(effectiveMonthlyPrice('starter', 'yearly', {})).toBe(PLAN_PRICING.starter.yearlyPerMonth);
  });

  it('uses the admin-set monthly rate for the monthly cycle', () => {
    expect(effectiveMonthlyPrice('starter', 'monthly', { custom_monthly_price: 799 })).toBe(799);
  });

  it('uses the admin-set yearly rate for the yearly cycle', () => {
    expect(effectiveMonthlyPrice('starter', 'yearly', { custom_yearly_per_month: 699 })).toBe(699);
  });

  it('keeps the two cycles independent', () => {
    const settings = { custom_monthly_price: 799 };
    expect(effectiveMonthlyPrice('starter', 'monthly', settings)).toBe(799);
    // Yearly untouched → list price.
    expect(effectiveMonthlyPrice('starter', 'yearly', settings)).toBe(PLAN_PRICING.starter.yearlyPerMonth);
  });

  it('ignores zero, negative and non-numeric overrides', () => {
    for (const bad of [0, -100, 'abc', null, undefined, '']) {
      expect(effectiveMonthlyPrice('starter', 'monthly', { custom_monthly_price: bad as never })).toBe(
        PLAN_PRICING.starter.monthly
      );
    }
  });

  it('accepts numeric strings (JSONB round-trips)', () => {
    expect(effectiveMonthlyPrice('starter', 'monthly', { custom_monthly_price: '849' })).toBe(849);
  });

  it('applies per-tier defaults correctly', () => {
    expect(effectiveMonthlyPrice('pro', 'monthly', {})).toBe(PLAN_PRICING.pro.monthly);
    expect(effectiveMonthlyPrice('enterprise', 'monthly', {})).toBe(PLAN_PRICING.enterprise.monthly);
  });
});

describe('amountPayable', () => {
  it('charges one month on the monthly cycle', () => {
    expect(amountPayable('starter', 'monthly', { custom_monthly_price: 799 })).toBe(799);
  });

  it('charges twelve months on the yearly cycle', () => {
    expect(amountPayable('starter', 'yearly', { custom_yearly_per_month: 699 })).toBe(699 * 12);
  });

  it('matches the list price when there is no override', () => {
    expect(amountPayable('starter', 'monthly', {})).toBe(PLAN_PRICING.starter.monthly);
    expect(amountPayable('starter', 'yearly', {})).toBe(PLAN_PRICING.starter.yearlyPerMonth * 12);
  });

  it('handles missing settings safely', () => {
    expect(amountPayable('starter', 'monthly', null)).toBe(PLAN_PRICING.starter.monthly);
    expect(amountPayable('starter', 'monthly', undefined)).toBe(PLAN_PRICING.starter.monthly);
  });
});

describe('effectiveYearlyTotal', () => {
  it('is twelve times the effective monthly rate', () => {
    expect(effectiveYearlyTotal('starter', { custom_yearly_per_month: 500 })).toBe(6000);
  });
});

describe('getCustomPricing / hasCustomPrice', () => {
  it('reports which cycles are overridden', () => {
    expect(getCustomPricing({ custom_monthly_price: 799 })).toEqual({ monthly: 799, yearlyPerMonth: null });
    expect(hasCustomPrice({ custom_monthly_price: 799 }, 'monthly')).toBe(true);
    expect(hasCustomPrice({ custom_monthly_price: 799 }, 'yearly')).toBe(false);
    expect(hasCustomPrice({}, 'monthly')).toBe(false);
  });

  it('rounds fractional rupee inputs', () => {
    expect(getCustomPricing({ custom_monthly_price: 799.6 }).monthly).toBe(800);
  });
});

// =============================================================================
// Isolation guarantees.
//
// Business rule: ONLY salons with an admin-entered rate see a discount. Every
// other salon must always see/pay the standard list price. These tests assert
// there is no shared/leaking state between tenants.
// =============================================================================

describe('per-tenant isolation', () => {
  const DISCOUNTED = { custom_monthly_price: 799 };
  const NORMAL = {}; // no override — the vast majority of salons
  const LIST = PLAN_PRICING.starter.monthly; // 999

  it('a discounted tenant does not affect a normal tenant (same request order)', () => {
    expect(amountPayable('starter', 'monthly', DISCOUNTED)).toBe(799);
    // Immediately after, a tenant with no override still pays list price.
    expect(amountPayable('starter', 'monthly', NORMAL)).toBe(LIST);
  });

  it('is order-independent and repeatable (no memoised/global state)', () => {
    for (let i = 0; i < 50; i++) {
      expect(amountPayable('starter', 'monthly', NORMAL)).toBe(LIST);
      expect(amountPayable('starter', 'monthly', DISCOUNTED)).toBe(799);
      expect(amountPayable('starter', 'monthly', NORMAL)).toBe(LIST);
    }
  });

  it('does not mutate the settings object it is given', () => {
    const settings = { ...NORMAL } as Record<string, unknown>;
    amountPayable('starter', 'monthly', settings);
    expect(settings).toEqual({});
    const d = { ...DISCOUNTED } as Record<string, unknown>;
    amountPayable('starter', 'monthly', d);
    expect(d).toEqual({ custom_monthly_price: 799 });
  });

  it('ignores unrelated settings keys (GST, billing cycle, wallet, etc.)', () => {
    const noisy = {
      billing_cycle: 'monthly',
      gst_enabled: true,
      gst_rate: 18,
      legal_name: 'Some Salon LLP',
      loyalty_tiers: { gold_min: 5 },
      // Deliberately similar-looking but WRONG keys must not be honoured.
      custom_price: 1,
      customMonthlyPrice: 1,
      monthly_price: 1,
      discount: 500,
    };
    expect(amountPayable('starter', 'monthly', noisy)).toBe(LIST);
  });

  it('keeps every tier on its own list price when undiscounted', () => {
    expect(amountPayable('starter', 'monthly', NORMAL)).toBe(PLAN_PRICING.starter.monthly);
    expect(amountPayable('pro', 'monthly', NORMAL)).toBe(PLAN_PRICING.pro.monthly);
    expect(amountPayable('enterprise', 'monthly', NORMAL)).toBe(PLAN_PRICING.enterprise.monthly);
    expect(amountPayable('starter', 'yearly', NORMAL)).toBe(PLAN_PRICING.starter.yearlyPerMonth * 12);
    expect(amountPayable('pro', 'yearly', NORMAL)).toBe(PLAN_PRICING.pro.yearlyPerMonth * 12);
    expect(amountPayable('enterprise', 'yearly', NORMAL)).toBe(PLAN_PRICING.enterprise.yearlyPerMonth * 12);
  });

  it('a discount on one tier does not spill into another tier', () => {
    // The override is stored per tenant, so the tier is whatever that tenant is on.
    expect(amountPayable('pro', 'monthly', DISCOUNTED)).toBe(799);
    expect(amountPayable('pro', 'monthly', NORMAL)).toBe(PLAN_PRICING.pro.monthly);
  });

  it('flags custom rate only for the tenant that has one', () => {
    expect(hasCustomPrice(DISCOUNTED, 'monthly')).toBe(true);
    expect(hasCustomPrice(NORMAL, 'monthly')).toBe(false);
    expect(hasCustomPrice(null, 'monthly')).toBe(false);
    expect(hasCustomPrice(undefined, 'yearly')).toBe(false);
  });

  it('reverting an override restores the list price exactly', () => {
    // Admin "Revert to list price" deletes the keys from settings.
    const afterRevert: Record<string, unknown> = { ...DISCOUNTED };
    delete afterRevert.custom_monthly_price;
    expect(amountPayable('starter', 'monthly', afterRevert)).toBe(LIST);
    expect(hasCustomPrice(afterRevert, 'monthly')).toBe(false);
  });
});
