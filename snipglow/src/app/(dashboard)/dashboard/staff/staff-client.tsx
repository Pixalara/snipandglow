'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/data-table';
import { RoleGuard } from '@/components/role-guard';
import { EmployeeForm } from './employee-form';
import { deactivateEmployee } from './actions';
import type { Employee, Branch, UserRole } from '@/types';

// =============================================================================
// StaffClient — Interactive client wrapper for staff management page
// =============================================================================

/** Role badge color mapping */
const ROLE_COLORS: Record<UserRole, string> = {
  owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  staff: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
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
      header: 'Name',
      render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => <span className="text-muted-foreground">{row.phone}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ROLE_COLORS[row.role]}`}
        >
          {row.role}
        </span>
      ),
    },
    {
      key: 'branch',
      header: 'Branch',
      render: (row) => <span className="text-muted-foreground">{getBranchName(row.branch_id)}</span>,
    },
    {
      key: 'specializations',
      header: 'Specializations',
      render: (row) => (
        <span className="text-muted-foreground text-xs">
          {row.specializations?.length > 0 ? row.specializations.join(', ') : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            row.is_active
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          }`}
        >
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
            <Button variant="ghost" size="sm" onClick={() => handleEdit(row)}>
              Edit
            </Button>
          </RoleGuard>
          <RoleGuard role={role} action="delete" resource="staff">
            {row.is_active && (
              <Button
                variant="destructive"
                size="sm"
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
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-foreground">Staff Management</h1>
        <RoleGuard role={role} action="create" resource="staff">
          <Button onClick={() => setShowForm(true)}>
            Add Employee
          </Button>
        </RoleGuard>
      </div>

      {/* Employee DataTable */}
      <DataTable
        columns={columns}
        data={employees}
        getRowKey={(row) => row.id}
        emptyMessage="No employees found. Add your first team member to get started."
      />

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
            <h2 className="text-lg font-semibold text-foreground">Deactivate Employee</h2>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to deactivate{' '}
              <span className="font-medium text-foreground">{deactivateTarget.name}</span>?
              This will revoke their login access. The record will not be deleted.
            </p>
            {deactivateError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
                <p className="text-sm text-amber-800 dark:text-amber-200">{deactivateError}</p>
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeactivateTarget(null)}
                disabled={isDeactivating}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
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
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Content */}
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg mx-4 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
