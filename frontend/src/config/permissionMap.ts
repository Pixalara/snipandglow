// Snip & Glow — Centralized Permission Map
// Single source of truth for all role-based access decisions

import type { UserRole } from '@/types';

export type CrudAction = 'create' | 'read' | 'update' | 'delete';
export type SpecialAction = 'checkin';
export type Action = CrudAction | SpecialAction;

export type Resource =
  | 'dashboard' | 'members' | 'plans' | 'billing'
  | 'automations' | 'broadcast' | 'expenses' | 'analytics'
  | 'employees' | 'branches' | 'activity' | 'settings'
  | 'leads';

export type SidebarItem = Resource;

export interface PermissionSet {
  sidebarItems: SidebarItem[];
  actions: Record<Resource, Action[]>;
}

export const PERMISSION_MAP: Record<UserRole, PermissionSet> = {
  admin: {
    sidebarItems: ['dashboard','members','leads','plans','billing','automations','broadcast','expenses','analytics','employees','branches','activity','settings'],
    actions: {
      dashboard: ['read'],
      members: ['create','read','update','delete','checkin'],
      leads: ['create','read','update','delete'],
      plans: ['create','read','update','delete'],
      billing: ['create','read','update','delete'],
      automations: ['read'],
      broadcast: ['create','read','update','delete'],
      expenses: ['create','read','update','delete'],
      analytics: ['read'],
      employees: ['create','read','update','delete'],
      branches: ['create','read','update','delete'],
      activity: ['read'],
      settings: ['read','update'],
    },
  },
  branch_manager: {
    sidebarItems: ['dashboard','members','leads','plans','billing','automations','broadcast','activity'],
    actions: {
      dashboard: ['read'],
      members: ['create','read','update','delete','checkin'],
      leads: ['create','read','update','delete'],
      plans: ['create','read','update','delete'],
      billing: ['create','read','update','delete'],
      automations: ['read'],
      broadcast: ['create','read','update','delete'],
      expenses: [],
      analytics: [],
      employees: [],
      branches: [],
      activity: ['read'],
      settings: [],
    },
  },
  // stylist = was "trainer" — can view clients, check them in, manage leads
  stylist: {
    sidebarItems: ['dashboard','members','leads'],
    actions: {
      dashboard: ['read'],
      members: ['read','checkin'],
      leads: ['create','read','update','delete'],
      plans: [],
      billing: [],
      automations: [],
      broadcast: [],
      expenses: [],
      analytics: [],
      employees: [],
      branches: [],
      activity: [],
      settings: [],
    },
  },
  sales_executive: {
    sidebarItems: ['dashboard','members','leads','billing'],
    actions: {
      dashboard: ['read'],
      members: ['create','read'],
      leads: ['create','read','update','delete'],
      plans: [],
      billing: ['create','read'],
      automations: [],
      broadcast: [],
      expenses: [],
      analytics: [],
      employees: [],
      branches: [],
      activity: [],
      settings: [],
    },
  },
  receptionist: {
    sidebarItems: ['dashboard','members','leads','plans'],
    actions: {
      dashboard: ['read'],
      members: ['read','checkin'],
      leads: ['create','read','update','delete'],
      plans: ['read'],
      billing: [],
      automations: [],
      broadcast: [],
      expenses: [],
      analytics: [],
      employees: [],
      branches: [],
      activity: [],
      settings: [],
    },
  },
};
