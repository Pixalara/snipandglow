// =============================================================================
// Customer Loyalty POINTS — pure helpers (shared by client + server).
//
// This is the redeemable-points system (earn on spend, redeem at billing),
// configured per tenant in tenants.settings. It is DISTINCT from the visit-based
// loyalty TIER in src/lib/loyalty.ts (new/regular/silver/gold/vip by visits),
// which is unrelated and stays as-is. Points here drive their own gamified tier
// (Bronze→Platinum by lifetime points) purely for display/motivation.
//
// No 'server-only' import: these are safe in both the POS client and server
// actions so the two never disagree about earn/redeem maths (the DB is still the
// single source of truth — see migration 054).
// =============================================================================

export interface LoyaltyPointsConfig {
  /** Master on/off for the whole feature. */
  enabled: boolean;
  /** Points earned per ₹100 of a service bill. */
  earnRate: number;
  /** Rupee value of one point when redeemed (e.g. 1 → 1 point = ₹1). */
  redeemValue: number;
  /** Points granted on a customer's first-ever service bill. */
  welcomeBonus: number;
  /** Minimum points a customer may redeem on a single bill. */
  minRedeem: number;
  /** Maximum share (%) of a bill that may be paid with points. */
  maxRedeemPct: number;
}

/** Sensible one-tap defaults: ~5% back, 1 point = ₹1, small welcome bonus. */
export const DEFAULT_LOYALTY_POINTS_CONFIG: LoyaltyPointsConfig = {
  enabled: false,
  earnRate: 5,
  redeemValue: 1,
  welcomeBonus: 50,
  minRedeem: 100,
  maxRedeemPct: 50,
};

/** Read + normalise the loyalty config out of a tenant's settings JSONB. */
export function readLoyaltyConfig(
  settings: Record<string, unknown> | null | undefined
): LoyaltyPointsConfig {
  const s = settings ?? {};
  const num = (v: unknown, d: number): number => {
    const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) && n >= 0 ? n : d;
  };
  return {
    enabled: (s.loyalty_enabled as boolean) ?? false,
    earnRate: num(s.loyalty_earn_rate, DEFAULT_LOYALTY_POINTS_CONFIG.earnRate),
    redeemValue: num(s.loyalty_redeem_value, DEFAULT_LOYALTY_POINTS_CONFIG.redeemValue),
    welcomeBonus: Math.round(num(s.loyalty_welcome_bonus, DEFAULT_LOYALTY_POINTS_CONFIG.welcomeBonus)),
    minRedeem: Math.round(num(s.loyalty_min_redeem, DEFAULT_LOYALTY_POINTS_CONFIG.minRedeem)),
    maxRedeemPct: Math.min(100, Math.round(num(s.loyalty_max_redeem_pct, DEFAULT_LOYALTY_POINTS_CONFIG.maxRedeemPct))),
  };
}

/** Points earned for a bill — the client/preview mirror of the SQL trigger. */
export function pointsForSpend(total: number, earnRate: number): number {
  if (!(total > 0) || !(earnRate > 0)) return 0;
  return Math.floor((total / 100) * earnRate);
}

/** Rupee value of a number of points. */
export function pointsToRupees(points: number, redeemValue: number): number {
  if (!(points > 0) || !(redeemValue > 0)) return 0;
  return Math.round(points * redeemValue * 100) / 100;
}

/** How many whole points a rupee amount is worth. */
export function rupeesToPoints(rupees: number, redeemValue: number): number {
  if (redeemValue <= 0 || rupees <= 0) return 0;
  return Math.floor(rupees / redeemValue);
}

/**
 * Clamp the points a customer may redeem on a bill so the client and server
 * always agree (the DB RPC still enforces balance + total as the hard limit):
 *   • never more than their balance,
 *   • never more than maxRedeemPct of the bill (in ₹ terms),
 *   • never worth more than the bill total.
 * Returns the number of POINTS to redeem (never negative).
 */
export function clampPointsUse(args: {
  requestedPoints: number;
  balance: number;
  billTotal: number;
  redeemValue: number;
  maxRedeemPct: number;
}): number {
  const { requestedPoints, balance, billTotal, redeemValue, maxRedeemPct } = args;
  if (redeemValue <= 0 || billTotal <= 0) return 0;
  let pts = Math.max(0, Math.floor(requestedPoints || 0));
  pts = Math.min(pts, Math.max(0, Math.floor(balance)));
  const pctRupees = Math.floor((billTotal * Math.min(100, Math.max(0, maxRedeemPct))) / 100);
  pts = Math.min(pts, rupeesToPoints(pctRupees, redeemValue));
  pts = Math.min(pts, rupeesToPoints(billTotal, redeemValue));
  return Math.max(0, pts);
}

// -----------------------------------------------------------------------------
// Points tier (gamification, display only) — Bronze → Platinum by lifetime pts.
// -----------------------------------------------------------------------------
export type PointsTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface PointsTierInfo {
  tier: PointsTier;
  label: string;
  emoji: string;
  /** Tailwind gradient for the tier card face. */
  gradient: string;
  ring: string;
  /** Lifetime-points floor for this tier. */
  min: number;
  /** Next tier target, or null at the top. */
  next: { label: string; at: number } | null;
  /** Progress toward the next tier, 0–100. */
  progressPct: number;
  /** Points still needed to reach the next tier (0 at the top). */
  toNext: number;
}

const POINTS_TIERS: { tier: PointsTier; label: string; emoji: string; min: number; gradient: string; ring: string }[] = [
  { tier: 'bronze', label: 'Bronze', emoji: '🥉', min: 0, gradient: 'from-amber-500 to-orange-600', ring: 'ring-amber-200 dark:ring-amber-900/40' },
  { tier: 'silver', label: 'Silver', emoji: '🥈', min: 500, gradient: 'from-slate-400 to-slate-600', ring: 'ring-slate-200 dark:ring-slate-700/50' },
  { tier: 'gold', label: 'Gold', emoji: '🥇', min: 1500, gradient: 'from-yellow-400 to-amber-600', ring: 'ring-yellow-200 dark:ring-yellow-900/40' },
  { tier: 'platinum', label: 'Platinum', emoji: '💎', min: 5000, gradient: 'from-fuchsia-500 via-purple-500 to-indigo-600', ring: 'ring-fuchsia-200 dark:ring-fuchsia-900/40' },
];

/** Resolve the gamified points tier for a lifetime-points total. */
export function getPointsTier(lifetimePoints: number): PointsTierInfo {
  const lp = Math.max(0, Math.floor(lifetimePoints || 0));
  let idx = 0;
  for (let i = POINTS_TIERS.length - 1; i >= 0; i--) {
    if (lp >= POINTS_TIERS[i].min) { idx = i; break; }
  }
  const cur = POINTS_TIERS[idx];
  const nxt = POINTS_TIERS[idx + 1] ?? null;
  let progressPct = 100;
  let toNext = 0;
  if (nxt) {
    const span = nxt.min - cur.min;
    progressPct = span > 0 ? Math.min(100, Math.round(((lp - cur.min) / span) * 100)) : 0;
    toNext = Math.max(0, nxt.min - lp);
  }
  return {
    tier: cur.tier,
    label: cur.label,
    emoji: cur.emoji,
    gradient: cur.gradient,
    ring: cur.ring,
    min: cur.min,
    next: nxt ? { label: nxt.label, at: nxt.min } : null,
    progressPct,
    toNext,
  };
}
