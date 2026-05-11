// PingFlow — Plan Hook
// Reads gym.plan from auth store and exposes feature/limit helpers
// Trial users get full Pro access until planEndDate, then fall back to starter

import { useMemo, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  PLAN_LIMITS,
  PLAN_FEATURES,
  type PlanType,
  type PlanLimits,
  type FeatureName,
  type ResourceName,
} from '@/config/planConfig';

export interface UsePlanReturn {
  plan: PlanType;
  effectivePlan: PlanType;
  limits: PlanLimits;
  features: FeatureName[];
  canAccess: (feature: FeatureName) => boolean;
  isAtLimit: (resource: ResourceName, currentCount: number) => boolean;
  isTrialExpired: boolean;
}

export function usePlan(): UsePlanReturn {
  const gym = useAuthStore((s) => s.gym);

  const plan: PlanType = gym?.plan ?? 'trial';

  // Check if trial has expired
  const isTrialExpired = useMemo(() => {
    if (plan !== 'trial') return false;
    if (!gym?.planEndDate) return false;
    const endDate = gym.planEndDate.toDate ? gym.planEndDate.toDate() : new Date(gym.planEndDate as any);
    return endDate.getTime() < Date.now();
  }, [plan, gym?.planEndDate]);

  // If trial expired, downgrade to starter-level access
  const effectivePlan: PlanType = isTrialExpired ? 'starter' : plan;

  const limits = PLAN_LIMITS[effectivePlan];
  const features = PLAN_FEATURES[effectivePlan];

  const canAccess = useCallback(
    (feature: FeatureName): boolean => PLAN_FEATURES[effectivePlan].includes(feature),
    [effectivePlan]
  );

  const isAtLimit = useCallback(
    (resource: ResourceName, currentCount: number): boolean =>
      currentCount >= PLAN_LIMITS[effectivePlan][resource],
    [effectivePlan]
  );

  return useMemo(
    () => ({ plan, effectivePlan, limits, features, canAccess, isAtLimit, isTrialExpired }),
    [plan, effectivePlan, limits, features, canAccess, isAtLimit, isTrialExpired]
  );
}
