import { describe, it, expect } from 'vitest';
import { clampWalletUse, externalPayable, isFullyWalletPaid } from './wallet';

describe('clampWalletUse', () => {
  it('caps the wallet use at the available balance', () => {
    expect(clampWalletUse(1000, 800, 500)).toBe(500); // balance is the limit
  });

  it('caps the wallet use at the bill total', () => {
    expect(clampWalletUse(1000, 600, 5000)).toBe(600); // total is the limit
  });

  it('returns the requested amount when within both caps', () => {
    expect(clampWalletUse(300, 800, 500)).toBe(300);
  });

  it('never returns a negative amount', () => {
    expect(clampWalletUse(-50, 800, 500)).toBe(0);
    expect(clampWalletUse(100, -10, 500)).toBe(0);
    expect(clampWalletUse(100, 800, -10)).toBe(0);
  });

  it('handles a zero balance (no wallet row yet)', () => {
    expect(clampWalletUse(500, 800, 0)).toBe(0);
  });

  it('rounds to whole rupees', () => {
    expect(clampWalletUse(199.6, 800, 500)).toBe(200);
  });
});

describe('externalPayable', () => {
  it('is the remainder after wallet use', () => {
    expect(externalPayable(800, 500)).toBe(300);
  });

  it('is zero when wallet covers the full bill', () => {
    expect(externalPayable(800, 800)).toBe(0);
    expect(externalPayable(800, 1000)).toBe(0); // never negative
  });

  it('is the full total when no wallet is used', () => {
    expect(externalPayable(800, 0)).toBe(800);
  });
});

describe('isFullyWalletPaid', () => {
  it('is true only when wallet >= total and total > 0', () => {
    expect(isFullyWalletPaid(800, 800)).toBe(true);
    expect(isFullyWalletPaid(800, 900)).toBe(true);
    expect(isFullyWalletPaid(800, 700)).toBe(false);
    expect(isFullyWalletPaid(0, 0)).toBe(false);
  });
});
