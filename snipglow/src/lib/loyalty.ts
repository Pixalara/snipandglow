// =============================================================================
// Customer Loyalty Tier System
// Determines loyalty tier based on visit count.
// Thresholds are customizable per tenant via tenant.settings.loyalty_tiers
// =============================================================================

export type LoyaltyTier = 'new' | 'regular' | 'silver' | 'gold' | 'vip';

export interface LoyaltyInfo {
  tier: LoyaltyTier;
  label: string;
  emoji: string;
  color: string;
  textColor: string;
  nextTier: LoyaltyTier | null;
  visitsToNextTier: number;
}

export interface LoyaltyTierConfig {
  regular_min: number;  // visits to become Regular (default: 1)
  silver_min: number;   // visits to become Silver (default: 5)
  gold_min: number;     // visits to become Gold (default: 10)
  vip_min: number;      // visits to become VIP (default: 25)
}

export const DEFAULT_LOYALTY_CONFIG: LoyaltyTierConfig = {
  regular_min: 1,
  silver_min: 5,
  gold_min: 10,
  vip_min: 25,
};

/**
 * Determine customer loyalty tier based on total visits and optional custom config.
 */
export function getLoyaltyTier(totalVisits: number, config?: Partial<LoyaltyTierConfig>): LoyaltyInfo {
  const c: LoyaltyTierConfig = {
    regular_min: config?.regular_min ?? DEFAULT_LOYALTY_CONFIG.regular_min,
    silver_min: config?.silver_min ?? DEFAULT_LOYALTY_CONFIG.silver_min,
    gold_min: config?.gold_min ?? DEFAULT_LOYALTY_CONFIG.gold_min,
    vip_min: config?.vip_min ?? DEFAULT_LOYALTY_CONFIG.vip_min,
  };

  if (totalVisits === 0) {
    return {
      tier: 'new',
      label: 'New',
      emoji: '🆕',
      color: 'bg-blue-100 dark:bg-blue-900/30',
      textColor: 'text-blue-700 dark:text-blue-400',
      nextTier: 'regular',
      visitsToNextTier: c.regular_min,
    };
  }

  if (totalVisits < c.regular_min) {
    return {
      tier: 'new',
      label: 'New',
      emoji: '🆕',
      color: 'bg-blue-100 dark:bg-blue-900/30',
      textColor: 'text-blue-700 dark:text-blue-400',
      nextTier: 'regular',
      visitsToNextTier: c.regular_min - totalVisits,
    };
  }

  if (totalVisits < c.silver_min) {
    return {
      tier: 'regular',
      label: 'Regular',
      emoji: '👤',
      color: 'bg-slate-100 dark:bg-slate-800/50',
      textColor: 'text-slate-700 dark:text-slate-300',
      nextTier: 'silver',
      visitsToNextTier: c.silver_min - totalVisits,
    };
  }

  if (totalVisits < c.gold_min) {
    return {
      tier: 'silver',
      label: 'Silver',
      emoji: '🥈',
      color: 'bg-gray-100 dark:bg-gray-800/50',
      textColor: 'text-gray-700 dark:text-gray-300',
      nextTier: 'gold',
      visitsToNextTier: c.gold_min - totalVisits,
    };
  }

  if (totalVisits < c.vip_min) {
    return {
      tier: 'gold',
      label: 'Gold',
      emoji: '🥇',
      color: 'bg-amber-100 dark:bg-amber-900/30',
      textColor: 'text-amber-700 dark:text-amber-400',
      nextTier: 'vip',
      visitsToNextTier: c.vip_min - totalVisits,
    };
  }

  return {
    tier: 'vip',
    label: 'VIP',
    emoji: '💎',
    color: 'bg-purple-100 dark:bg-purple-900/30',
    textColor: 'text-purple-700 dark:text-purple-400',
    nextTier: null,
    visitsToNextTier: 0,
  };
}

export function getAverageSpend(totalSpent: number, totalVisits: number): number {
  if (totalVisits === 0) return 0;
  return Math.round(totalSpent / totalVisits);
}

export function getVisitFrequency(totalVisits: number, createdAt: string): string {
  if (totalVisits === 0) return 'No visits yet';
  const firstDate = new Date(createdAt);
  const now = new Date();
  const monthsDiff = Math.max(1, (now.getFullYear() - firstDate.getFullYear()) * 12 + (now.getMonth() - firstDate.getMonth()));
  const perMonth = totalVisits / monthsDiff;
  if (perMonth >= 4) return 'Weekly';
  if (perMonth >= 2) return 'Bi-weekly';
  if (perMonth >= 1) return 'Monthly';
  if (perMonth >= 0.5) return 'Bi-monthly';
  return 'Occasional';
}

export function getDaysSinceLastVisit(lastVisitAt: string | null): number | null {
  if (!lastVisitAt) return null;
  const last = new Date(lastVisitAt);
  const now = new Date();
  return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
}
