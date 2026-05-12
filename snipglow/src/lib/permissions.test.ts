import { describe, it, expect } from 'vitest';
import { can, type Resource, type Action } from './permissions';
import type { UserRole } from '@/types';

const allResources: Resource[] = [
  'dashboard',
  'appointments',
  'customers',
  'services',
  'billing',
  'expenses',
  'memberships',
  'staff',
  'payroll',
  'branches',
  'analytics',
  'audit',
  'settings',
];

const allActions: Action[] = ['read', 'create', 'update', 'delete'];

describe('permissions', () => {
  describe('owner role', () => {
    it('has access to all resources with all actions', () => {
      for (const resource of allResources) {
        for (const action of allActions) {
          expect(can('owner', action, resource)).toBe(true);
        }
      }
    });
  });

  describe('manager role', () => {
    it('can read dashboard', () => {
      expect(can('manager', 'read', 'dashboard')).toBe(true);
    });

    it('can read, create, update appointments', () => {
      expect(can('manager', 'read', 'appointments')).toBe(true);
      expect(can('manager', 'create', 'appointments')).toBe(true);
      expect(can('manager', 'update', 'appointments')).toBe(true);
      expect(can('manager', 'delete', 'appointments')).toBe(false);
    });

    it('can read, create, update customers', () => {
      expect(can('manager', 'read', 'customers')).toBe(true);
      expect(can('manager', 'create', 'customers')).toBe(true);
      expect(can('manager', 'update', 'customers')).toBe(true);
      expect(can('manager', 'delete', 'customers')).toBe(false);
    });

    it('can read, create, update services', () => {
      expect(can('manager', 'read', 'services')).toBe(true);
      expect(can('manager', 'create', 'services')).toBe(true);
      expect(can('manager', 'update', 'services')).toBe(true);
      expect(can('manager', 'delete', 'services')).toBe(false);
    });

    it('can read and create billing', () => {
      expect(can('manager', 'read', 'billing')).toBe(true);
      expect(can('manager', 'create', 'billing')).toBe(true);
      expect(can('manager', 'update', 'billing')).toBe(false);
      expect(can('manager', 'delete', 'billing')).toBe(false);
    });

    it('can read memberships and analytics', () => {
      expect(can('manager', 'read', 'memberships')).toBe(true);
      expect(can('manager', 'read', 'analytics')).toBe(true);
    });

    it('can read and create expenses', () => {
      expect(can('manager', 'read', 'expenses')).toBe(true);
      expect(can('manager', 'create', 'expenses')).toBe(true);
      expect(can('manager', 'update', 'expenses')).toBe(false);
      expect(can('manager', 'delete', 'expenses')).toBe(false);
    });

    it('cannot access staff, payroll, branches, audit, or settings', () => {
      const deniedResources: Resource[] = ['staff', 'payroll', 'branches', 'audit', 'settings'];
      for (const resource of deniedResources) {
        for (const action of allActions) {
          expect(can('manager', action, resource)).toBe(false);
        }
      }
    });
  });

  describe('staff role', () => {
    it('can only read dashboard, appointments, customers, and services', () => {
      expect(can('staff', 'read', 'dashboard')).toBe(true);
      expect(can('staff', 'read', 'appointments')).toBe(true);
      expect(can('staff', 'read', 'customers')).toBe(true);
      expect(can('staff', 'read', 'services')).toBe(true);
    });

    it('cannot create, update, or delete anything', () => {
      const writeActions: Action[] = ['create', 'update', 'delete'];
      for (const resource of allResources) {
        for (const action of writeActions) {
          expect(can('staff', action, resource)).toBe(false);
        }
      }
    });

    it('cannot access billing, expenses, memberships, staff, payroll, branches, analytics, audit, or settings', () => {
      const deniedResources: Resource[] = [
        'billing',
        'expenses',
        'memberships',
        'staff',
        'payroll',
        'branches',
        'analytics',
        'audit',
        'settings',
      ];
      for (const resource of deniedResources) {
        for (const action of allActions) {
          expect(can('staff', action, resource)).toBe(false);
        }
      }
    });
  });

  describe('invalid role', () => {
    it('returns false for an unknown role', () => {
      // Cast to UserRole to simulate an invalid role at runtime
      const invalidRole = 'intern' as UserRole;
      for (const resource of allResources) {
        for (const action of allActions) {
          expect(can(invalidRole, action, resource)).toBe(false);
        }
      }
    });
  });
});
