# Implementation Plan: Employee Roles

## Overview

Replace PingFlow's generic three-role system (`admin | manager | employee`) with five granular gym-staff roles (`admin`, `branch_manager`, `trainer`, `sales_executive`, `receptionist`). Implementation follows a bottom-up approach: types → permission map → hook → UI components → backend → tests. Each step builds on the previous, ensuring no orphaned code.

## Tasks

- [ ] 1. Set up test infrastructure
  - [ ] 1.1 Install Vitest, fast-check, and testing dependencies
    - Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, and `fast-check` as devDependencies in `frontend/package.json`
    - Create `frontend/vitest.config.ts` extending the existing Vite config with test environment `jsdom`
    - Add a `"test"` script to `frontend/package.json`: `"test": "vitest --run"`
    - _Requirements: N/A (infrastructure)_

- [x] 2. Update type definitions and create permission map
  - [x] 2.1 Update `UserRole` type and `Employee` interface in `frontend/src/types/index.ts`
    - Change `UserRole` from `'admin' | 'employee' | 'manager'` to `'admin' | 'branch_manager' | 'trainer' | 'sales_executive' | 'receptionist'`
    - Verify the `Employee` interface `role` field uses the updated `UserRole` type (already does)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 Create the centralized permission map at `frontend/src/config/permissionMap.ts`
    - Define `CrudAction`, `SpecialAction`, `Action`, `Resource`, `SidebarItem`, and `PermissionSet` types
    - Define `PERMISSION_MAP: Record<UserRole, PermissionSet>` with entries for all five roles exactly as specified in the design document
    - Admin gets all sidebar items and all CRUD actions on all resources
    - Branch Manager gets dashboard, members, plans, billing, automations, broadcast
    - Trainer gets dashboard, members (read + checkin only)
    - Sales Executive gets dashboard, members (create + read), billing (create + read)
    - Receptionist gets dashboard, members (read + checkin), plans (read)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 2.3 Write property test: Permission map completeness (Property 1)
    - **Property 1: Permission map completeness**
    - For every valid `UserRole` and every `Resource`, verify `PERMISSION_MAP[role]` has a defined `sidebarItems` array and `PERMISSION_MAP[role].actions[resource]` is a defined array
    - Create test file at `frontend/src/__tests__/permissionMap.property.test.ts`
    - Use fast-check `fc.constantFrom(...)` to enumerate all roles and resources
    - **Validates: Requirements 2.1, 2.2**

- [x] 3. Enhance the useRole hook with `can()` API
  - [x] 3.1 Rewrite `frontend/src/hooks/useRole.ts` with permission-map-driven logic
    - Import `PERMISSION_MAP` and types from `permissionMap.ts`
    - Implement `LEGACY_ROLE_MAP` mapping `'manager'` → `'branch_manager'` and `'employee'` → `'receptionist'`
    - Implement `resolveRole(raw: string): UserRole` that maps legacy values, validates against PERMISSION_MAP keys, and defaults to `'receptionist'` for unknown strings
    - Expose `can(action, resource)` function that checks `permissions.actions[resource]?.includes(action)`
    - Expose `role`, `sidebarItems`, and `isAdmin` from the hook
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 9.1, 9.2, 9.3_

  - [ ]* 3.2 Write property test: `can()` faithfully reflects the permission map (Property 2)
    - **Property 2: `can()` faithfully reflects the permission map**
    - For any valid `UserRole`, any `Action`, and any `Resource`, verify `can(action, resource)` returns `true` iff `PERMISSION_MAP[role].actions[resource].includes(action)`
    - Create test file at `frontend/src/__tests__/useRole.property.test.ts`
    - Use fast-check to generate random (role, action, resource) triples
    - **Validates: Requirements 3.1, 3.3**

  - [ ]* 3.3 Write property test: `resolveRole` always returns a valid UserRole (Property 3)
    - **Property 3: `resolveRole` always returns a valid UserRole**
    - For any arbitrary string input, verify `resolveRole(input)` returns a key in `PERMISSION_MAP`
    - Verify `'manager'` → `'branch_manager'`, `'employee'` → `'receptionist'`, unknown → `'receptionist'`, and all five valid roles map to themselves
    - Add to `frontend/src/__tests__/useRole.property.test.ts`
    - Use fast-check `fc.string()` and `fc.constantFrom(...)` for inputs
    - **Validates: Requirements 3.4, 9.1, 9.2, 9.3**

- [ ] 4. Checkpoint — Verify core logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update Sidebar with permission-map-driven filtering
  - [x] 5.1 Refactor `frontend/src/components/layout/Sidebar.tsx` to use permission map
    - Add a `resource` field (of type `Resource`) to each item in the `allNavItems` array, mapping: `'/'` → `'dashboard'`, `'/members'` → `'members'`, `'/plans'` → `'plans'`, `'/billing'` → `'billing'`, `'/automations'` → `'automations'`, `'/broadcast'` → `'broadcast'`, `'/expenses'` → `'expenses'`, `'/analytics'` → `'analytics'`, `'/employees'` → `'employees'`, `'/branches'` → `'branches'`, `'/activity'` → `'activity'`, `'/settings'` → `'settings'`
    - Replace the old `roles` string-array filtering with: `const { sidebarItems } = useRole();` and `navItems = allNavItems.filter(item => sidebarItems.includes(item.resource));`
    - Remove the old `userRole` derivation logic (`isAdmin ? 'admin' : hasAdminAccess ? 'manager' : 'employee'`)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 5.2 Write property test: Sidebar filtering matches permission map (Property 4)
    - **Property 4: Sidebar filtering matches permission map**
    - For any valid `UserRole`, verify the set of sidebar items displayed equals `PERMISSION_MAP[role].sidebarItems`
    - Create test file at `frontend/src/__tests__/sidebar.property.test.ts`
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6**

- [ ] 6. Create PageGuard component and wire into routes
  - [x] 6.1 Create `frontend/src/components/layout/PageGuard.tsx`
    - Implement `PageGuard` component that accepts `resource: Resource` and `children: React.ReactNode`
    - Use `useRole().can('read', resource)` to check access
    - Render an `AccessDenied` UI (styled inline, matching PingFlow design) when access is denied
    - Render `children` when access is granted
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 6.2 Wrap page routes in `frontend/src/App.tsx` with `PageGuard`
    - Wrap each page route inside the AppShell `<Routes>` with `<PageGuard resource="...">` using the appropriate resource key
    - Dashboard route (`/`) uses `resource="dashboard"`
    - Members, Plans, Billing, Automations, Broadcast, Employees, Branches, Expenses, Analytics, Activity, Settings routes each use their corresponding resource key
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 7. Update Employee management page with new roles
  - [x] 7.1 Update the create employee form in `frontend/src/pages/Employees.tsx`
    - Add a `formRole` state variable with type matching the four non-admin roles
    - Add a role selection dropdown to the create modal with options: Branch Manager (`branch_manager`), Trainer (`trainer`), Sales Executive (`sales_executive`), Receptionist (`receptionist`)
    - Require role selection before submission (validate `formRole` is set)
    - Pass the selected `role` to the `createEmployee` cloud function call
    - Remove the old hardcoded warning banner about employee permissions
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 7.2 Update the edit employee form in `frontend/src/pages/Employees.tsx`
    - Change `editRole` state type from `'manager' | 'employee'` to `'branch_manager' | 'trainer' | 'sales_executive' | 'receptionist'`
    - Update the role dropdown in the edit modal with the four new role options
    - In `openEditModal`, use `resolveRole` logic (or inline mapping) to map legacy `'manager'`/`'employee'` values to new roles for pre-population
    - Update `handleEditSave` to write the new role value to both Firestore docs
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.4_

  - [x] 7.3 Update employee list role badge display in `frontend/src/pages/Employees.tsx`
    - Replace the old binary `'ADMIN'`/`'EMPLOYEE'` badge with a badge showing the actual role label (e.g., "BRANCH MANAGER", "TRAINER", "SALES EXEC", "RECEPTIONIST")
    - Use appropriate badge colors per role
    - _Requirements: 1.1_

- [ ] 8. Update action-level permission checks in page components
  - [x] 8.1 Add `can()` checks to `frontend/src/pages/Members.tsx` (or equivalent member-related components)
    - Use `useRole().can('create', 'members')` to conditionally render "Add Member" button
    - Use `can('update', 'members')` for "Edit" buttons
    - Use `can('delete', 'members')` for "Delete" buttons
    - Use `can('checkin', 'members')` for "Check In" action
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 8.2 Write property test: Action button visibility matches permission check (Property 6)
    - **Property 6: Action button visibility matches permission check**
    - For any valid `UserRole`, any `Resource`, and any CRUD action, verify the corresponding button renders iff `can(action, resource)` returns `true`
    - Create test file at `frontend/src/__tests__/actionButtons.property.test.ts`
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6**

- [ ] 9. Checkpoint — Verify frontend changes
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Update backend cloud function with role validation
  - [x] 10.1 Update `createEmployee` in `functions/src/auth/employeeManager.ts`
    - Define `VALID_EMPLOYEE_ROLES = ['branch_manager', 'trainer', 'sales_executive', 'receptionist']` constant
    - Add `role` to the destructured `request.data` fields
    - Add validation: if `role` is missing or not in `VALID_EMPLOYEE_ROLES`, throw `HttpsError('invalid-argument', ...)` with a descriptive message
    - Replace the hardcoded `role: 'employee'` in both the employee doc and employeeLink doc writes with the validated `role` value
    - _Requirements: 7.3, 7.4, 7.5_

  - [ ]* 10.2 Write property test: Role validation accepts exactly four valid employee roles (Property 5)
    - **Property 5: Role validation accepts exactly the four valid employee roles**
    - For any string, verify the validation logic accepts it iff it is one of `'branch_manager'`, `'trainer'`, `'sales_executive'`, `'receptionist'`
    - Create test file at `functions/src/__tests__/employeeRoleValidation.property.test.ts`
    - Test that `'admin'`, empty string, and arbitrary strings are rejected
    - **Validates: Requirements 1.3, 1.4, 7.4, 7.5**

- [x] 11. Update auth store type compatibility
  - [x] 11.1 Update `frontend/src/store/authStore.ts` default role type
    - Ensure the `role` field default value `'admin'` is compatible with the updated `UserRole` type (it already is since `'admin'` is still a valid value)
    - Verify `setRole` accepts the new `UserRole` type — no code change needed if types flow correctly from `types/index.ts`
    - _Requirements: 1.1_

- [ ] 12. Final checkpoint — Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- The `resolveRole` function should be exported from `useRole.ts` for direct testing
- Legacy role mapping happens at read-time only — no Firestore migration needed
