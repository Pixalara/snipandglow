# Implementation Plan: Subscription Pricing

## Overview

Implement a tiered subscription system (Trial, Starter, Pro) for PingFlow. The plan builds incrementally: static config → hook → guard/modal → type extensions → enforcement points → new pages → landing pricing section. Each step wires into the previous one so there's no orphaned code.

## Tasks

- [x] 1. Create plan configuration module and type extensions
  - [x] 1.1 Create `frontend/src/config/planConfig.ts` with `PlanType`, `FeatureName`, `ResourceName` types, `PLAN_LIMITS`, `PLAN_FEATURES`, and `PLAN_PRICES` constants
    - Export typed constants: `PlanType = 'trial' | 'starter' | 'pro'`, `FeatureName`, `ResourceName`
    - `PLAN_LIMITS`: trial/starter = 100 members, 2 employees, 1 branch; pro = Infinity for all
    - `PLAN_FEATURES`: trial/starter = `['billing', 'automations']`; pro = all six features
    - `PLAN_PRICES`: starter monthly=499, yearly=4990; pro monthly=999, yearly=9990
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Extend `Gym` interface in `frontend/src/types/index.ts` with `plan`, `planStartDate`, `planEndDate` fields and add `ExpenseEntry` / `ExpenseCategory` types
    - Add `plan?: 'trial' | 'starter' | 'pro'` to `Gym`
    - Add `planStartDate?: Timestamp` and `planEndDate?: Timestamp` to `Gym`
    - Add `ExpenseCategory` type and `ExpenseEntry` interface
    - _Requirements: 5.1, 5.2, 5.3, 6.5_

  - [ ]* 1.3 Write property test: Feature access correctness (Property 1)
    - **Property 1: Feature access correctness**
    - Generate random `(PlanType, FeatureName)` pairs using fast-check arbitraries
    - Assert that checking feature inclusion matches `PLAN_FEATURES[plan].includes(feature)`
    - Minimum 100 iterations
    - **Validates: Requirements 2.3**

  - [ ]* 1.4 Write property test: Resource limit correctness (Property 2)
    - **Property 2: Resource limit correctness**
    - Generate random `(PlanType, ResourceName, non-negative integer)` triples using fast-check
    - Assert that limit check matches `currentCount >= PLAN_LIMITS[plan][resource]`
    - Minimum 100 iterations
    - **Validates: Requirements 2.4**

- [x] 2. Implement usePlan hook
  - [x] 2.1 Create `frontend/src/hooks/usePlan.ts`
    - Read `gym.plan` from `useAuthStore()`
    - Default to `'trial'` if `gym.plan` is undefined or missing
    - Return `plan`, `limits`, `features`, `canAccess(feature)`, `isAtLimit(resource, currentCount)`
    - `canAccess` checks inclusion in `PLAN_FEATURES[plan]`
    - `isAtLimit` compares `currentCount >= PLAN_LIMITS[plan][resource]`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Implement UpgradeModal and PlanGuard components
  - [x] 3.1 Create `frontend/src/components/ui/UpgradeModal.tsx`
    - Reuse existing `Modal` component shell
    - Accept `isOpen`, `onClose`, `reason` props
    - Display two-column Starter vs Pro feature comparison
    - Show contextual reason message (feature name or limit reached)
    - Include CTA button for upgrade (placeholder link)
    - Close on backdrop click or close button without navigating
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 3.2 Create `frontend/src/components/ui/PlanGuard.tsx`
    - Accept `feature` prop of type `FeatureName` and `children`
    - Use `usePlan().canAccess(feature)` to check access
    - If access granted, render children
    - If access denied, render `UpgradeModal` with feature name as reason
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Integrate plan gating into Sidebar navigation
  - [x] 5.1 Modify `frontend/src/components/layout/Sidebar.tsx` to gate Pro-only features
    - Import `usePlan` hook
    - For Broadcast, Expenses, and Analytics nav items: if `!canAccess(feature)`, show a "PRO" badge and intercept click to open `UpgradeModal` instead of navigating
    - On Pro plan, render these items normally without badges
    - Add Expenses nav item to `allNavItems` array (path: `/expenses`)
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 6. Integrate plan gating into BranchSwitcher
  - [x] 6.1 Modify `frontend/src/components/ui/BranchSwitcher.tsx` to gate "All Branches" option
    - Import `usePlan` hook
    - If `!canAccess('globalView')`, show "PRO" badge on "All Branches" option
    - On click when gated, open `UpgradeModal` instead of setting `activeBranchId(null)`
    - On Pro plan, allow normal selection
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 7. Enforce resource limits on Members, Employees, and Branches pages
  - [x] 7.1 Modify `frontend/src/pages/Members.tsx` to enforce member limit
    - Import `usePlan` hook
    - Before opening the create member drawer, check `isAtLimit('members', members.length)`
    - If at limit, show `UpgradeModal` with "Member limit reached" reason instead of opening drawer
    - Skip limit check for Pro plan (Infinity)
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 7.2 Modify `frontend/src/pages/Employees.tsx` to enforce employee limit
    - Import `usePlan` hook
    - Before opening the create employee modal, check `isAtLimit('employees', employees.length)`
    - If at limit, show `UpgradeModal` with "Employee limit reached" reason instead of opening modal
    - Skip limit check for Pro plan
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 7.3 Modify `frontend/src/pages/Branches.tsx` to enforce branch limit
    - Import `usePlan` hook
    - Before opening the create branch modal, check `isAtLimit('branches', branches.length)`
    - If at limit, show `UpgradeModal` with "Branch limit reached" reason instead of opening modal
    - Skip limit check for Pro plan
    - _Requirements: 12.1, 12.2, 12.3_

- [x] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement Expense Tracking module (Pro only)
  - [x] 9.1 Create `frontend/src/services/expense.service.ts` with CRUD operations
    - Follow the same pattern as `wallet.service.ts`
    - Implement `subscribeExpenses`, `createExpense`, `updateExpense`, `deleteExpense` functions
    - Operate on `gyms/{gymId}/expenses` subcollection
    - Use `addDoc`, `updateDoc`, `deleteDoc`, `onSnapshot`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 9.2 Create `frontend/src/pages/Expenses.tsx` wrapped in PlanGuard
    - Wrap page content with `PlanGuard feature="expenses"`
    - List expense entries for current gym, filtered by selected month
    - Add/Edit/Delete expense forms via Modal
    - Support five categories: Rent, Salary, Utilities, Equipment, Other
    - Display monthly total at the top
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [x] 9.3 Add `/expenses` route to `frontend/src/App.tsx`
    - Import `ExpensesPage` and add route in the authenticated AppShell routes
    - _Requirements: 6.1_

  - [ ]* 9.4 Write property test: Monthly expense total correctness (Property 3)
    - **Property 3: Monthly expense total correctness**
    - Generate random lists of `{ amount: number, date: Date }` objects and a random target month using fast-check
    - Assert computed monthly total equals the filtered sum of amounts for entries in that month
    - Minimum 100 iterations
    - **Validates: Requirements 6.6**

- [x] 10. Add Landing page Pricing section
  - [x] 10.1 Add Pricing section to `frontend/src/pages/Landing.tsx`
    - Add section with `id="pricing"` after the features section
    - Import `PLAN_PRICES` from `planConfig.ts`
    - Two plan cards: Starter and Pro
    - Monthly/Yearly toggle using local state
    - Display correct prices: Starter ₹499/mo or ₹4990/yr, Pro ₹999/mo or ₹9990/yr
    - "Most Popular" badge on Pro card
    - "14-day free trial" badge on both cards
    - List included features for each plan per requirements
    - Pro card gradient border: `linear-gradient(135deg, #E11D48, #8B5CF6)`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [x] 11. Update Gym document defaults during signup
  - [x] 11.1 Modify the signup flow to set default plan fields on new Gym documents
    - Set `plan: 'trial'`, `planStartDate: serverTimestamp()`, `planEndDate: 14 days from now`
    - Apply to both Google signup and email/OTP signup paths
    - _Requirements: 5.4_

- [x] 12. Update Firestore security rules for expenses subcollection
  - [x] 12.1 Add security rules for `gyms/{gymId}/expenses/{expenseId}` in `firestore.rules`
    - Allow read/write if `request.auth != null && request.auth.uid == gymId`
    - _Requirements: 6.2, 6.3, 6.4_

- [x] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- All enforcement is frontend-only — no backend changes needed except Firestore rules for expenses
