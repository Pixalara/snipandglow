'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/data-table';
import { RoleGuard } from '@/components/role-guard';
import { BranchForm } from './branch-form';
import type { Branch, UserRole, OperatingHours } from '@/types';

// =============================================================================
// BranchesClient — Interactive client wrapper for branch management page
// =============================================================================

interface BranchesClientProps {
  branches: Branch[];
  role: UserRole;
}

/** Format operating hours into a short summary string */
function formatHoursSummary(hours: OperatingHours | null | undefined): string {
  if (!hours) return '—';
  // Use Monday as representative day
  const mon = hours.mon;
  if (!mon) return '—';
  return `${mon.open} – ${mon.close}`;
}

export function BranchesClient({ branches, role }: BranchesClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | undefined>(undefined);

  function handleEdit(branch: Branch) {
    setEditingBranch(branch);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingBranch(undefined);
  }

  const columns: Column<Branch>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{row.name}</span>
          {row.is_default && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Default
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Address',
      render: (row) => (
        <span className="text-muted-foreground">{row.address || '—'}</span>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => (
        <span className="text-muted-foreground">{row.phone || '—'}</span>
      ),
    },
    {
      key: 'hours',
      header: 'Operating Hours',
      render: (row) => (
        <span className="text-muted-foreground text-xs">
          {formatHoursSummary(row.operating_hours)}
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
        <RoleGuard role={role} action="update" resource="branches">
          <Button variant="ghost" size="sm" onClick={() => handleEdit(row)}>
            Edit
          </Button>
        </RoleGuard>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-foreground">Branch Management</h1>
        <RoleGuard role={role} action="create" resource="branches">
          <Button onClick={() => setShowForm(true)}>
            Add Branch
          </Button>
        </RoleGuard>
      </div>

      {/* Branch DataTable */}
      <DataTable
        columns={columns}
        data={branches}
        getRowKey={(row) => row.id}
        emptyMessage="No branches found. Add your first branch to get started."
      />

      {/* Create/Edit Modal */}
      {showForm && (
        <Modal onClose={handleCloseForm}>
          <BranchForm branch={editingBranch} onClose={handleCloseForm} />
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
