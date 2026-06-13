import type { UserRole } from '@/types';

// =============================================================================
// Permission System — Role × Resource × Action Matrix
// =============================================================================

/** Dashboard resources that can be access-controlled */
export type Resource =
  | 'dashboard'
  | 'appointments'
  | 'customers'
  | 'leads'
  | 'services'
  | 'billing'
  | 'expenses'
  | 'inventory'
  | 'memberships'
  | 'staff'
  | 'payroll'
  | 'branches'
  | 'analytics'
  | 'audit'
  | 'settings';

/** CRUD actions that can be performed on resources */
export type Action = 'read' | 'create' | 'update' | 'delete';

/**
 * Permission matrix defining which actions each role can perform on each resource.
 *
 * - owner: ALL resources, ALL actions (unrestricted)
 * - manager: Full CRUD on customers/appointments/services, read+create on billing,
 *            read on dashboard/memberships/analytics. No access to staff/branches/audit/settings.
 * - staff: Read-only on dashboard/appointments/customers/services. No access to anything else.
 */
const permissionMatrix: Record<UserRole, Partial<Record<Resource, Action[]>>> = {
  owner: {
    dashboard: ['read', 'create', 'update', 'delete'],
    appointments: ['read', 'create', 'update', 'delete'],
    customers: ['read', 'create', 'update', 'delete'],
    leads: ['read', 'create', 'update', 'delete'],
    services: ['read', 'create', 'update', 'delete'],
    billing: ['read', 'create', 'update', 'delete'],
    expenses: ['read', 'create', 'update', 'delete'],
    inventory: ['read', 'create', 'update', 'delete'],
    memberships: ['read', 'create', 'update', 'delete'],
    staff: ['read', 'create', 'update', 'delete'],
    payroll: ['read', 'create', 'update', 'delete'],
    branches: ['read', 'create', 'update', 'delete'],
    analytics: ['read', 'create', 'update', 'delete'],
    audit: ['read', 'create', 'update', 'delete'],
    settings: ['read', 'create', 'update', 'delete'],
  },
  manager: {
    dashboard: ['read'],
    appointments: ['read', 'create', 'update'],
    customers: ['read', 'create', 'update'],
    leads: ['read', 'create', 'update'],
    services: ['read', 'create', 'update'],
    billing: ['read', 'create'],
    expenses: ['read', 'create'],
    inventory: ['read', 'create', 'update'],
    memberships: ['read'],
    analytics: ['read'],
  },
  staff: {
    dashboard: ['read'],
    appointments: ['read'],
    customers: ['read'],
    leads: ['read'],
    services: ['read'],
    inventory: ['read'],
  },
};

/**
 * Check whether a given role is allowed to perform an action on a resource.
 *
 * @param role - The user's role (owner, manager, staff)
 * @param action - The action being attempted (read, create, update, delete)
 * @param resource - The resource being accessed
 * @returns true if the role has permission, false otherwise
 */
export function can(role: UserRole, action: Action, resource: Resource): boolean {
  const rolePermissions = permissionMatrix[role];
  if (!rolePermissions) return false;

  const allowedActions = rolePermissions[resource];
  if (!allowedActions) return false;

  return allowedActions.includes(action);
}
