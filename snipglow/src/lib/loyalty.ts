// =============================================================================
// Customer Loyalty Tier System
// Determines loyalty tier based on visit count and total spend.
// =============================================================================

export type LoyaltyTier = 'new' | 'regular' | 'silver' | 'gold' | 'vip';

export interface LoyaltyInfo {
  tier: LoyaltyTier;
  label: string;
  emoji: string;
  color: string;       // Tailwind bg class
  textColor: string;   // Tailwind text class
  nextTier: LoyaltyTier | null;
  visitsToNextTier: number;
}

/**
 * Determine customer loyalty tier based on total visits.
 *
 * Tiers:
 * - New: 0 visits
 * - Regular: 1-4 visits
 * - Silver: 5-9 visits
 * - Gold: 10-24 visits
 * - VIP: 25+ visits
 */
export function getLoyaltyTier(totalVisits: number): LoyaltyInfo {
  if (totalVisits === 0) {
    return {
      tier: 'new',
      label: 'New',
      emoji: '🆕',
      color: 'bg-blue-100 dark:bg-blue-900/30',
      textColor: 'text-blue-700 dark:text-blue-400',
      nextTier: 'regular',
      visitsToNextTier: 1,
    };
  }

  if (totalVisits < 5) {
    return {
      tier: 'regular',
      label: 'Regular',
      emoji: '👤',
      color: 'bg-slate-100 dark:bg-slate-800/50',
      textColor: 'text-slate-700 dark:text-slate-300',
      nextTier: 'silver',
      visitsToNextTier: 5 - totalVisits,
    };
  }

  if (totalVisits < 10) {
    return {
      tier: 'silver',
      label: 'Silver',
      emoji: '🥈',
      color: 'bg-gray-100 dark:bg-gray-800/50',
      textColor: 'text-gray-700 dark:text-gray-300',
      nextTier: 'gold',
      visitsToNextTier: 10 - totalVisits,
    };
  }

  if (totalVisits < 25) {
    return {
      tier: 'gold',
      label: 'Gold',
      emoji: '🥇',
      color: 'bg-amber-100 dark:bg-amber-900/30',
      textColor: 'text-amber-700 dark:text-amber-400',
      nextTier: 'vip',
      visitsToNextTier: 25 - totalVisits,
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

/**
 * Calculate average spend per visit.
 */
export function getAverageSpend(totalSpent: number, totalVisits: number): number {
  if (totalVisits === 0) return 0;
  return Math.round(totalSpent / totalVisits);
}

/**
 * Calculate visit frequency (visits per month since first visit).
 */
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

/**
 * Get days since last visit.
 */
export function getDaysSinceLastVisit(lastVisitAt: string | null): number | null {
  if (!lastVisitAt) return null;
  const last = new Date(lastVisitAt);
  const now = new Date();
  return Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
}
