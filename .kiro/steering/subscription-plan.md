---
inclusion: manual
---

# PingFlow — Subscription & Pricing Implementation Plan
# Priority: Next session after testing

## PLAN DEFINITIONS

### Starter (₹499/mo)
- 100 Members max
- 2 Employees max  
- 1 Branch max
- Basic Billing (GST Invoices)
- WhatsApp Automations (D-3, D-0, D+2)
- NO Broadcasting, NO Expense Tracking, NO Advanced Analytics, NO Global View

### Pro (₹999/mo)
- Unlimited Members, Employees, Branches
- All Starter features
- WhatsApp Broadcasting
- Expense Tracking
- Advanced Revenue Analytics (P&L)
- Global View (All Branches)

## FILES TO CREATE

### 1. frontend/src/config/planConfig.ts
```typescript
export type PlanType = 'trial' | 'starter' | 'pro';

export const PLAN_LIMITS = {
  trial: { members: 100, employees: 2, branches: 1 },
  starter: { members: 100, employees: 2, branches: 1 },
  pro: { members: Infinity, employees: Infinity, branches: Infinity },
};

export const PLAN_FEATURES = {
  trial: ['billing', 'automations'],
  starter: ['billing', 'automations'],
  pro: ['billing', 'automations', 'broadcast', 'expenses', 'analytics', 'globalView'],
};

export const PLAN_PRICES = {
  starter: { monthly: 499, yearly: 4990 },
  pro: { monthly: 999, yearly: 9990 },
};
```

### 2. frontend/src/hooks/usePlan.ts
- Read `gym.plan` from auth store
- Return: planType, limits, features, canAccess(feature), isAtLimit(resource)

### 3. frontend/src/components/ui/PlanGuard.tsx
- Wrapper component that checks feature access
- If blocked: shows "Upgrade to Pro" modal with pricing
- Used around: Broadcast sidebar item, Expenses, All Branches

### 4. frontend/src/components/ui/UpgradeModal.tsx
- "Upgrade to Pro" modal with feature comparison
- CTA button linking to Razorpay checkout or contact

### 5. frontend/src/pages/Expenses.tsx (Pro only)
- Expense categories: Rent, Salary, Utilities, Equipment, Other
- CRUD for expense entries
- Monthly totals
- Stored in: gyms/{gymId}/expenses

### 6. frontend/src/pages/Analytics.tsx (Pro only)
- Revenue vs Expenses chart
- Net Profit calculation
- Category-wise spending breakdown
- Monthly trend

### 7. Landing Page Pricing Section Update
- Two-tier cards: Starter + Pro
- Monthly/Yearly toggle
- "Most Popular" badge on Pro
- Pixalara gradient border on Pro card
- "14-day free trial" badge on both

## ENFORCEMENT POINTS

### Sidebar
- Broadcast: PlanGuard (Pro only)
- Expenses: PlanGuard (Pro only)  
- Analytics: PlanGuard (Pro only)

### Branch Switcher
- "All Branches" option: PlanGuard (Pro only)

### Add Member
- Check member count vs PLAN_LIMITS.members
- Show upgrade modal if at limit

### Add Employee
- Check employee count vs PLAN_LIMITS.employees

### Add Branch
- Check branch count vs PLAN_LIMITS.branches

## GYM DOC FIELDS
```
plan: 'trial' | 'starter' | 'pro'
planStartDate: Timestamp
planEndDate: Timestamp
```
