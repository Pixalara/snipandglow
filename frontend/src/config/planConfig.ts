// PingFlow — Plan Configuration
// Single source of truth for plan limits, features, and prices

export type PlanType = 'trial' | 'starter' | 'pro';

export type FeatureName =
  | 'billing'
  | 'automations'
  | 'broadcast'
  | 'expenses'
  | 'analytics'
  | 'globalView'
  | 'leads'
  | 'leads_analytics';

export type ResourceName = 'members' | 'employees' | 'branches' | 'leads';

export interface PlanLimits {
  members: number;
  employees: number;
  branches: number;
  leads: number;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  trial:   { members: Infinity, employees: Infinity, branches: Infinity, leads: 50 },
  starter: { members: 100, employees: 2, branches: 1, leads: 50 },
  pro:     { members: Infinity, employees: Infinity, branches: Infinity, leads: Infinity },
};

export const PLAN_FEATURES: Record<PlanType, FeatureName[]> = {
  trial:   ['billing', 'automations', 'broadcast', 'expenses', 'analytics', 'globalView', 'leads'],
  starter: ['billing', 'automations', 'leads'],
  pro:     ['billing', 'automations', 'broadcast', 'expenses', 'analytics', 'globalView', 'leads', 'leads_analytics'],
};

export const PLAN_PRICES = {
  starter: { monthly: 499, yearly: 4990 },
  pro:     { monthly: 999, yearly: 9990 },
} as const;
