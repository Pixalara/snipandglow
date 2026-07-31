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
