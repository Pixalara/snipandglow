'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/data-table';
import { RoleGuard } from '@/components/role-guard';
import { EmployeeForm } from './employee-form';
import { deactivateEmployee } from './actions';
import {
  Users,
  Plus,
  UserCog,
  Shield,
  ShieldCheck,
  MapPin,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import type { Employee, Branch, UserRole } from '@/types';

// =============================================================================
// StaffClient — Interactive client wrapper for staff management page
// =============================================================================

/** Role badge config */
const ROLE_CONFIG: Record<UserRole, { color: string; icon: typeof Shield }> = {
  owner: {
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    icon: ShieldCheck,
  },
  manager: {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    icon: Shield,
  },
  staff: {
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    icon: UserCog,
  },
};

interface StaffClientProps {
  employees: Employee[];
  branches: Branch[];
  role: UserRole;
}

export function StaffClient({ employees, branches, role }: StaffClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>(undefined);
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null);
  const [deactivateError, setDeactivateError] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);

  function handleEdit(employee: Employee) {
    setEditingEmployee(employee);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingEmployee(undefined);
  }

  async function handleConfirmDeactivate() {
    if (!deactivateTarget) return;
    setIsDeactivating(true);
    setDeactivateError('');

    const result = await deactivateEmployee(deactivateTarget.id);

    setIsDeactivating(false);

    if (!result.success) {
      setDeactivateError(result.error);
      return;
    }

    setDeactivateTarget(null);
  }

  /** Get branch name by ID */
  function getBranchName(branchId: string): string {
    const branch = branches.find((b) => b.id === branchId);
    return branch?.name ?? 'Unknown';
  }

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-salon-rose/20 to-salon-gold/20 text-xs font-bold text-salon-rose">
            {row.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="font-medium text-foreground">{row.name}</span>
            <p className="text-xs text-muted-foreground">{row.phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => {
        const config = ROLE_CONFIG[row.role];
        const Icon = config.icon;
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${config.color}`}>
            <Icon className="size-3" />
            {row.role}
          </span>
        );
      },
    },
    {
      key: 'branch',
      header: 'Branch',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <MapPin className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{getBranchName(row.branch_id)}</span>
        </div>
      ),
    },
    {
      key: 'specializations',
      header: 'Specializations',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.specializations?.length > 0 ? (
            row.specializations.slice(0, 3).map((spec) => (
              <span key={spec} className="inline-flex items-center rounded-md bg-salon-gold/10 px-1.5 py-0.5 text-xs text-salon-gold dark:text-amber-400">
                {spec}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
          {row.specializations?.length > 3 && (
            <span className="text-xs text-muted-foreground">+{row.specializations.length - 3}</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            row.is_active
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          }`}
        >
          <span className={`size-1.5 rounded-full ${row.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          <RoleGuard role={role} action="update" resource="staff">
            <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={() => handleEdit(row)}>
              Edit
            </Button>
          </RoleGuard>
          <RoleGuard role={role} action="delete" resource="staff">
            {row.is_active && (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                onClick={() => {
                  setDeactivateTarget(row);
                  setDeactivateError('');
                }}
              >
                Deactivate
              </Button>
            )}
          </RoleGuard>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent border border-violet-200/50 dark:border-violet-800/30 p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
              <Users className="size-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Staff Management</h1>
              <p className="text-sm text-muted-foreground">
                {employees.filter(e => e.is_active).length} active · {employees.length} total team member{employees.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <RoleGuard role={role} action="create" resource="staff">
            <Button onClick={() => setShowForm(true)} className="rounded-xl gap-1.5">
              <Plus className="size-4" />
              Add Employee
            </Button>
          </RoleGuard>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-violet-500/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-violet-400/5" />
      </div>

      {/* Employee DataTable */}
      {employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-900/20 mb-4">
            <Sparkles className="size-6 text-violet-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No team members yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Add your first employee to start managing your salon team and assigning appointments.
          </p>
          <RoleGuard role={role} action="create" resource="staff">
            <Button onClick={() => setShowForm(true)} className="mt-4 rounded-xl gap-1.5" variant="outline">
              <Plus className="size-4" />
              Add First Employee
            </Button>
          </RoleGuard>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <DataTable
            columns={columns}
            data={employees}
            getRowKey={(row) => row.id}
            emptyMessage="No employees found. Add your first team member to get started."
          />
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <Modal onClose={handleCloseForm}>
          <EmployeeForm
            employee={editingEmployee}
            branches={branches}
            onClose={handleCloseForm}
          />
        </Modal>
      )}

      {/* Deactivate Confirmation Dialog */}
      {deactivateTarget && (
        <Modal onClose={() => setDeactivateTarget(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
                <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Deactivate Employee</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to deactivate{' '}
              <span className="font-medium text-foreground">{deactivateTarget.name}</span>?
              This will revoke their login access. The record will not be deleted.
            </p>
            {deactivateError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
                <p className="text-sm text-amber-800 dark:text-amber-200">{deactivateError}</p>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setDeactivateTarget(null)}
                disabled={isDeactivating}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={handleConfirmDeactivate}
                disabled={isDeactivating}
              >
                {isDeactivating ? 'Deactivating...' : 'Deactivate'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =============================================================================
// Modal — Simple overlay modal component
// =============================================================================

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
}

function Modal({ children, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Content */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
