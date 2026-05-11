'use client';

import type { UserRole } from '@/types';
import { can, type Action, type Resource } from '@/lib/permissions';

interface RoleGuardProps {
  role: UserRole;
  action: Action;
  resource: Resource;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({ role, action, resource, children, fallback = null }: RoleGuardProps) {
  if (!can(role, action, resource)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
