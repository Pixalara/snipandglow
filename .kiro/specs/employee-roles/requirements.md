# Requirements Document

## Introduction

PingFlow currently uses three generic roles (admin, manager, employee) for access control. This feature replaces the generic "manager" and "employee" roles with four specific gym staff roles — Branch Manager, Trainer, Sales Executive, and Receptionist — each with granular, well-defined permissions. The Admin (gym owner) retains full access. The system enforces role-based visibility in the sidebar, page-level access control, and action-level (CRUD) permission checks across the frontend and backend.

## Glossary

- **PingFlow**: The WhatsApp-based Gym CRM application
- **Admin**: The gym owner account with unrestricted access to all features and all branches
- **Branch_Manager**: An employee role with full access to their assigned branch's data (members, plans, billing, automations, broadcast) but no access to other branches, settings, or employee management
- **Trainer**: An employee role that can view members and member details for their assigned branch and check in members by updating lastVisitDate; cannot access billing, plans management, broadcast, or settings
- **Sales_Executive**: An employee role that can add new members, record payments, and view billing for their assigned branch; cannot access automations, broadcast, or settings
- **Receptionist**: An employee role with read-only access to members, check-in capability (update lastVisitDate), dashboard viewing, and read-only plan viewing for their assigned branch; cannot add, edit, or delete members, access billing, or settings
- **Permission_Map**: A centralized data structure that maps each role to its allowed sidebar items, page access, and CRUD actions
- **Sidebar**: The main navigation component that displays menu items based on the logged-in user's role
- **useRole_Hook**: The existing React hook (`useRole`) that exposes role-based permission flags to frontend components
- **Employee_Document**: The Firestore document stored at `gyms/{gymId}/employees/{uid}` containing employee profile and role data
- **EmployeeLink_Document**: The Firestore lookup document stored at `employeeLinks/{uid}` used for fast employee-to-gym resolution on login

## Requirements

### Requirement 1: Role Type Definition

**User Story:** As a developer, I want a single source of truth for all valid employee roles, so that role values are consistent across the frontend and backend.

#### Acceptance Criteria

1. THE PingFlow SHALL define the `UserRole` type as the union: `'admin' | 'branch_manager' | 'trainer' | 'sales_executive' | 'receptionist'`
2. THE PingFlow SHALL remove the legacy `'manager'` and `'employee'` values from the `UserRole` type
3. THE Employee_Document SHALL store the role field using exactly one value from the `UserRole` type
4. THE EmployeeLink_Document SHALL store the role field using exactly one value from the `UserRole` type

### Requirement 2: Permission Map Definition

**User Story:** As a developer, I want a centralized permission map, so that all role-based access decisions reference a single configuration.

#### Acceptance Criteria

1. THE PingFlow SHALL define a Permission_Map that maps each UserRole to a list of accessible sidebar items
2. THE Permission_Map SHALL map each UserRole to a set of allowed CRUD actions per resource (members, plans, billing, automations, broadcast, expenses, analytics, employees, branches, activity, settings, dashboard)
3. WHEN a new role is added to the UserRole type, THE Permission_Map SHALL require a corresponding entry for that role before the application compiles
4. THE Permission_Map SHALL grant Admin access to all sidebar items and all CRUD actions on all resources
5. THE Permission_Map SHALL grant Branch_Manager access to: dashboard, members (full CRUD), plans (full CRUD), billing (full CRUD), automations (read), and broadcast (full CRUD)
6. THE Permission_Map SHALL grant Trainer access to: dashboard (read), members (read, update lastVisitDate only)
7. THE Permission_Map SHALL grant Sales_Executive access to: dashboard (read), members (create, read), billing (create, read)
8. THE Permission_Map SHALL grant Receptionist access to: dashboard (read), members (read, update lastVisitDate only), plans (read)

### Requirement 3: useRole Hook Enhancement

**User Story:** As a frontend developer, I want the useRole hook to expose granular permission checks, so that components can conditionally render UI elements and guard actions.

#### Acceptance Criteria

1. THE useRole_Hook SHALL expose a `can(action, resource)` function that returns a boolean indicating whether the current user's role permits the specified action on the specified resource
2. THE useRole_Hook SHALL expose the current user's role as a typed value from the UserRole type
3. THE useRole_Hook SHALL derive all permission checks from the centralized Permission_Map
4. WHEN the role stored in the auth store is not a valid UserRole value, THE useRole_Hook SHALL default to the most restrictive permission set (no access to any resource)

### Requirement 4: Sidebar Visibility Filtering

**User Story:** As a gym staff member, I want to see only the sidebar items relevant to my role, so that I am not confused by inaccessible features.

#### Acceptance Criteria

1. THE Sidebar SHALL display only the menu items that the current user's role has access to according to the Permission_Map
2. WHEN a user with the Trainer role logs in, THE Sidebar SHALL display only Dashboard and Members
3. WHEN a user with the Sales_Executive role logs in, THE Sidebar SHALL display only Dashboard, Members, and Billing
4. WHEN a user with the Receptionist role logs in, THE Sidebar SHALL display only Dashboard, Members, and Plans
5. WHEN a user with the Branch_Manager role logs in, THE Sidebar SHALL display Dashboard, Members, Plans, Billing, Automations, and Broadcast
6. WHEN a user with the Admin role logs in, THE Sidebar SHALL display all menu items

### Requirement 5: Page-Level Access Control

**User Story:** As a gym owner, I want employees to be blocked from accessing pages outside their role's scope, so that sensitive data is protected.

#### Acceptance Criteria

1. WHEN a user navigates to a page that the Permission_Map does not grant access to for their role, THE PingFlow SHALL display an "Access Denied" message instead of the page content
2. WHEN a user navigates to a page that the Permission_Map does not grant access to for their role, THE PingFlow SHALL not load or fetch any data for that page
3. THE PingFlow SHALL check page access permissions before rendering any page component within the AppShell

### Requirement 6: Action-Level Permission Enforcement

**User Story:** As a gym owner, I want action buttons (add, edit, delete) to be hidden or disabled for employees whose role does not permit those actions, so that unauthorized modifications are prevented.

#### Acceptance Criteria

1. WHEN the current user's role does not permit the "create" action on a resource, THE PingFlow SHALL hide the "Add" or "Create" button for that resource
2. WHEN the current user's role does not permit the "update" action on a resource, THE PingFlow SHALL hide or disable the "Edit" button for that resource
3. WHEN the current user's role does not permit the "delete" action on a resource, THE PingFlow SHALL hide the "Delete" button for that resource
4. WHEN a Trainer views the Members page, THE PingFlow SHALL display a "Check In" action but SHALL hide "Add Member", "Edit Member", and "Delete Member" actions
5. WHEN a Receptionist views the Members page, THE PingFlow SHALL display a "Check In" action but SHALL hide "Add Member", "Edit Member", and "Delete Member" actions
6. WHEN a Sales_Executive views the Members page, THE PingFlow SHALL display "Add Member" and hide "Edit Member" and "Delete Member" actions

### Requirement 7: Role Assignment During Employee Creation

**User Story:** As a gym owner, I want to assign a specific role when creating an employee, so that the employee has the correct permissions from the start.

#### Acceptance Criteria

1. THE Employee creation form SHALL include a role selection dropdown with the options: Branch Manager, Trainer, Sales Executive, and Receptionist
2. THE Employee creation form SHALL require exactly one role to be selected before submission
3. WHEN the admin submits the employee creation form, THE createEmployee Cloud Function SHALL store the selected role in both the Employee_Document and the EmployeeLink_Document
4. THE createEmployee Cloud Function SHALL validate that the provided role is one of: `branch_manager`, `trainer`, `sales_executive`, `receptionist`
5. IF the provided role is not a valid non-admin role, THEN THE createEmployee Cloud Function SHALL reject the request with a descriptive error

### Requirement 8: Role Modification via Employee Edit

**User Story:** As a gym owner, I want to change an employee's role after creation, so that I can adjust permissions as staff responsibilities change.

#### Acceptance Criteria

1. THE Employee edit form SHALL display a role selection dropdown pre-populated with the employee's current role
2. THE Employee edit form SHALL allow the admin to change the role to any of: Branch Manager, Trainer, Sales Executive, or Receptionist
3. WHEN the admin saves the employee edit form with a changed role, THE PingFlow SHALL update the role field in both the Employee_Document and the EmployeeLink_Document
4. WHEN the admin saves the employee edit form with a changed role, THE PingFlow SHALL apply the new role's permissions on the employee's next page load or login

### Requirement 9: Legacy Role Migration

**User Story:** As a gym owner with existing employees, I want legacy "manager" and "employee" roles to be handled gracefully, so that existing accounts continue to function after the update.

#### Acceptance Criteria

1. WHEN the system encounters an Employee_Document with role value `'manager'`, THE PingFlow SHALL treat the employee as having the `branch_manager` role
2. WHEN the system encounters an Employee_Document with role value `'employee'`, THE PingFlow SHALL treat the employee as having the `receptionist` role (most restrictive safe default)
3. THE useRole_Hook SHALL map legacy role values to their new equivalents before performing permission checks
4. THE Employee edit form SHALL display the mapped new role for employees with legacy role values, allowing the admin to confirm or change the role
