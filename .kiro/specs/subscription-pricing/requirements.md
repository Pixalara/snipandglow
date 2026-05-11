# Requirements Document

## Introduction

PingFlow is a WhatsApp-based Gym CRM. This feature introduces a tiered subscription and pricing system with three plan types — Trial, Starter, and Pro — each with defined resource limits and feature gates. The system enforces plan limits on members, employees, and branches, restricts access to Pro-only features (Broadcasting, Expense Tracking, Advanced Analytics, Global View), provides an expense tracking module for Pro subscribers, and presents a public pricing section on the Landing page. Plan metadata is stored on the Gym Firestore document.

## Glossary

- **Plan_Configuration**: A static TypeScript module (`planConfig.ts`) that defines resource limits, feature lists, and pricing for each plan tier
- **Plan_Type**: One of `'trial'`, `'starter'`, or `'pro'` — stored on the Gym document as `gym.plan`
- **Resource_Limit**: The maximum count of members, employees, or branches allowed under a given Plan_Type
- **Feature_Gate**: A boolean check that determines whether a specific feature (e.g., broadcast, expenses) is accessible under the current Plan_Type
- **Plan_Hook**: A React hook (`usePlan`) that reads the current gym's Plan_Type from the auth store and exposes limit checks and feature access helpers
- **Plan_Guard**: A React wrapper component that conditionally renders children or displays the Upgrade_Modal based on Feature_Gate results
- **Upgrade_Modal**: A modal dialog that displays plan comparison information and a call-to-action when a user attempts to access a gated feature or exceeds a Resource_Limit
- **Expense_Entry**: A Firestore document in `gyms/{gymId}/expenses` representing a single expense record with category, amount, date, and description
- **Expense_Category**: One of Rent, Salary, Utilities, Equipment, or Other
- **Pricing_Section**: The public-facing pricing UI on the Landing page showing Starter and Pro tier cards
- **Sidebar**: The main navigation component (`Sidebar.tsx`) that renders menu items for the authenticated dashboard
- **Branch_Switcher**: The dropdown component (`BranchSwitcher.tsx`) that allows switching between gym branches or viewing all branches
- **Gym_Document**: The Firestore document at `gyms/{gymId}` containing gym profile data including plan fields
- **Auth_Store**: The Zustand store (`authStore.ts`) holding the current user, gym, role, and branch state

## Requirements

### Requirement 1: Plan Configuration Definition

**User Story:** As a developer, I want a centralized plan configuration module, so that plan limits, features, and prices are defined in one place and reusable across the application.

#### Acceptance Criteria

1. THE Plan_Configuration SHALL define three Plan_Type values: `'trial'`, `'starter'`, and `'pro'`
2. THE Plan_Configuration SHALL define Resource_Limit values for each Plan_Type as follows: trial and starter allow 100 members, 2 employees, and 1 branch; pro allows unlimited members, employees, and branches
3. THE Plan_Configuration SHALL define Feature_Gate lists for each Plan_Type: trial and starter include `billing` and `automations`; pro includes `billing`, `automations`, `broadcast`, `expenses`, `analytics`, and `globalView`
4. THE Plan_Configuration SHALL define monthly and yearly prices: starter at ₹499 monthly and ₹4990 yearly; pro at ₹999 monthly and ₹9990 yearly
5. THE Plan_Configuration SHALL export typed constants that can be imported by the Plan_Hook and other modules without runtime computation

### Requirement 2: Plan Hook for Runtime Access

**User Story:** As a developer, I want a React hook that reads the current gym's plan and exposes limit-checking and feature-access helpers, so that any component can enforce plan rules.

#### Acceptance Criteria

1. THE Plan_Hook SHALL read the `plan` field from the Gym_Document via the Auth_Store
2. THE Plan_Hook SHALL return the current Plan_Type, the corresponding Resource_Limit object, and the Feature_Gate list
3. WHEN a component calls `canAccess(featureName)` on the Plan_Hook, THE Plan_Hook SHALL return `true` if the feature is in the current plan's Feature_Gate list and `false` otherwise
4. WHEN a component calls `isAtLimit(resourceName, currentCount)` on the Plan_Hook, THE Plan_Hook SHALL return `true` if `currentCount` is greater than or equal to the Resource_Limit for that resource under the current Plan_Type
5. IF the `plan` field is missing or undefined on the Gym_Document, THEN THE Plan_Hook SHALL default to `'trial'` as the Plan_Type

### Requirement 3: Plan Guard Component

**User Story:** As a developer, I want a wrapper component that checks feature access before rendering children, so that Pro-only features are gated consistently across the UI.

#### Acceptance Criteria

1. WHEN the Plan_Guard wraps a component and the required feature is in the current Feature_Gate list, THE Plan_Guard SHALL render the wrapped children
2. WHEN the Plan_Guard wraps a component and the required feature is not in the current Feature_Gate list, THE Plan_Guard SHALL render the Upgrade_Modal instead of the children
3. THE Plan_Guard SHALL accept a `feature` prop specifying which Feature_Gate to check

### Requirement 4: Upgrade Modal

**User Story:** As a gym owner on a Starter or Trial plan, I want to see a clear upgrade prompt when I hit a limit or try a Pro feature, so that I understand what I gain by upgrading.

#### Acceptance Criteria

1. WHEN the Upgrade_Modal is displayed, THE Upgrade_Modal SHALL show a comparison of Starter and Pro plan features
2. WHEN the Upgrade_Modal is displayed, THE Upgrade_Modal SHALL include a call-to-action button for upgrading
3. WHEN the user clicks the close button or backdrop of the Upgrade_Modal, THE Upgrade_Modal SHALL close without navigating away
4. THE Upgrade_Modal SHALL display the reason for the upgrade prompt (feature name or resource limit reached)

### Requirement 5: Gym Document Plan Fields

**User Story:** As a system administrator, I want plan metadata stored on the Gym document, so that the application can determine the current plan at login time.

#### Acceptance Criteria

1. THE Gym_Document SHALL include a `plan` field of type `'trial' | 'starter' | 'pro'`
2. THE Gym_Document SHALL include a `planStartDate` field of type Firestore Timestamp
3. THE Gym_Document SHALL include a `planEndDate` field of type Firestore Timestamp
4. WHEN a new gym is created during signup, THE Gym_Document SHALL default `plan` to `'trial'` with `planStartDate` set to the current time and `planEndDate` set to 14 days from the current time


### Requirement 6: Expense Tracking Module (Pro Only)

**User Story:** As a gym owner on the Pro plan, I want to track my gym's expenses by category, so that I can monitor monthly spending alongside revenue.

#### Acceptance Criteria

1. WHEN a Pro plan user navigates to the Expenses page, THE Expense Tracker SHALL display a list of Expense_Entry records for the current gym
2. WHEN a Pro plan user submits a new expense form with a valid category, amount, date, and optional description, THE Expense Tracker SHALL create an Expense_Entry document in `gyms/{gymId}/expenses`
3. WHEN a Pro plan user edits an existing Expense_Entry, THE Expense Tracker SHALL update the corresponding Firestore document
4. WHEN a Pro plan user deletes an Expense_Entry, THE Expense Tracker SHALL remove the corresponding Firestore document
5. THE Expense Tracker SHALL support exactly five Expense_Category values: Rent, Salary, Utilities, Equipment, and Other
6. THE Expense Tracker SHALL display a monthly total of all Expense_Entry amounts for the selected month
7. WHEN a non-Pro plan user attempts to access the Expenses page, THE Plan_Guard SHALL display the Upgrade_Modal instead of the Expenses page content

### Requirement 7: Landing Page Pricing Section

**User Story:** As a prospective gym owner visiting the Landing page, I want to see a clear pricing comparison of Starter and Pro plans, so that I can choose the right plan before signing up.

#### Acceptance Criteria

1. THE Pricing_Section SHALL display two plan cards: one for Starter and one for Pro
2. THE Pricing_Section SHALL include a toggle that switches displayed prices between monthly and yearly billing cycles
3. WHEN the monthly toggle is selected, THE Pricing_Section SHALL display ₹499/mo for Starter and ₹999/mo for Pro
4. WHEN the yearly toggle is selected, THE Pricing_Section SHALL display ₹4990/yr for Starter and ₹9990/yr for Pro
5. THE Pricing_Section SHALL display a "Most Popular" badge on the Pro plan card
6. THE Pricing_Section SHALL display a "14-day free trial" badge on both plan cards
7. THE Pricing_Section SHALL list the included features for each plan: Starter lists 100 members, 2 employees, 1 branch, basic billing, and WhatsApp automations; Pro lists unlimited members, unlimited employees, unlimited branches, and all Starter features plus broadcasting, expense tracking, advanced analytics, and global view
8. THE Pro plan card SHALL have a gradient border styled with the Pixalara brand gradient

### Requirement 8: Sidebar Feature Gating

**User Story:** As a gym owner on a Starter or Trial plan, I want Pro-only sidebar items to be visually distinguished and gated, so that I know which features require an upgrade.

#### Acceptance Criteria

1. WHILE the current Plan_Type is `'trial'` or `'starter'`, THE Sidebar SHALL display a "PRO" badge next to the Broadcast, Expenses, and Analytics navigation items
2. WHEN a trial or starter plan user clicks a Pro-gated Sidebar item, THE Sidebar SHALL display the Upgrade_Modal instead of navigating to the page
3. WHILE the current Plan_Type is `'pro'`, THE Sidebar SHALL render Broadcast, Expenses, and Analytics navigation items without badges and with normal navigation behavior

### Requirement 9: Branch Switcher Global View Gating

**User Story:** As a gym owner on a Starter or Trial plan, I want the "All Branches" option in the Branch Switcher to be gated, so that the global aggregated view is reserved for Pro subscribers.

#### Acceptance Criteria

1. WHILE the current Plan_Type is `'pro'`, THE Branch_Switcher SHALL display the "All Branches" option and allow selection
2. WHILE the current Plan_Type is `'trial'` or `'starter'`, THE Branch_Switcher SHALL display the "All Branches" option with a "PRO" badge and prevent selection
3. WHEN a trial or starter plan user clicks the "All Branches" option, THE Branch_Switcher SHALL display the Upgrade_Modal

### Requirement 10: Member Limit Enforcement

**User Story:** As a gym owner, I want the system to prevent adding members beyond my plan's limit, so that I am prompted to upgrade when I reach capacity.

#### Acceptance Criteria

1. WHEN a user attempts to add a new member and the current member count is below the Resource_Limit for the current Plan_Type, THE Members page SHALL allow the member creation to proceed
2. WHEN a user attempts to add a new member and the current member count equals or exceeds the Resource_Limit for the current Plan_Type, THE Members page SHALL display the Upgrade_Modal with a message indicating the member limit has been reached
3. IF the current Plan_Type is `'pro'`, THEN THE Members page SHALL allow member creation without any count check

### Requirement 11: Employee Limit Enforcement

**User Story:** As a gym owner, I want the system to prevent adding employees beyond my plan's limit, so that I am prompted to upgrade when I reach capacity.

#### Acceptance Criteria

1. WHEN a user attempts to add a new employee and the current employee count is below the Resource_Limit for the current Plan_Type, THE Employees page SHALL allow the employee creation to proceed
2. WHEN a user attempts to add a new employee and the current employee count equals or exceeds the Resource_Limit for the current Plan_Type, THE Employees page SHALL display the Upgrade_Modal with a message indicating the employee limit has been reached
3. IF the current Plan_Type is `'pro'`, THEN THE Employees page SHALL allow employee creation without any count check

### Requirement 12: Branch Limit Enforcement

**User Story:** As a gym owner, I want the system to prevent adding branches beyond my plan's limit, so that I am prompted to upgrade when I reach capacity.

#### Acceptance Criteria

1. WHEN a user attempts to add a new branch and the current branch count is below the Resource_Limit for the current Plan_Type, THE Branches page SHALL allow the branch creation to proceed
2. WHEN a user attempts to add a new branch and the current branch count equals or exceeds the Resource_Limit for the current Plan_Type, THE Branches page SHALL display the Upgrade_Modal with a message indicating the branch limit has been reached
3. IF the current Plan_Type is `'pro'`, THEN THE Branches page SHALL allow branch creation without any count check
