// Snip & Glow — Role-Based Access Hook
// Driven by the centralized permission map

import { useAuthStore } from '@/store/authStore';
import { PERMISSION_MAP, type Action, type Resource } from '@/config/permissionMap';
import type { UserRole } from '@/types';

// Maps legacy role strings to new roles
const LEGACY_ROLE_MAP: Record<string, UserRole> = {
  manager: 'branch_manager',
  employee: 'receptionist',
  trainer: 'stylist', // renamed for salon context
};

/** Resolves any raw role string to a valid UserRole */
export function resolveRole(raw: string): UserRole {
  if (raw in LEGACY_ROLE_MAP) return LEGACY_ROLE_MAP[raw];
  if (raw in PERMISSION_MAP) return raw as UserRole;
  return 'receptionist'; // safest default — most restrictive
}

export function useRole() {
  const { role: rawRole } = useAuthStore();
  const role = resolveRole(rawRole);
  const permissions = PERMISSION_MAP[role];

  const can = (action: Action, resource: Resource): boolean => {
    return permissions.actions[resource]?.includes(action) ?? false;
  };

  return {
    role,
    can,
    sidebarItems: permissions.sidebarItems,
    isAdmin: role === 'admin',
    hasAdminAccess: role === 'admin' || role === 'branch_manager',
    canAccessWallet: role === 'admin',
  };
}
