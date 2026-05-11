'use client';

import { useState } from 'react';
import { formatINR } from '@/lib/utils';
import { RoleGuard } from '@/components/role-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MembershipForm } from './membership-form';
import { deleteMembership } from './actions';
import type { Membership, UserRole } from '@/types';

// =============================================================================
// MembershipsClient — Interactive client wrapper for memberships page
// Requirements: 8.1, 8.5
// =============================================================================

interface MembershipsClientProps {
  memberships: Membership[];
  activeMembershipCount: number;
  role: UserRole;
}

export function MembershipsClient({ memberships, activeMembershipCount, role }: MembershipsClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingMembership, setEditingMembership] = useState<Membership | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Membership | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  function handleEdit(membership: Membership) {
    setEditingMembership(membership);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingMembership(undefined);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');

    const result = await deleteMembership(deleteTarget.id);

    setIsDeleting(false);

    if (!result.success) {
      setDeleteError(result.error);
      return;
    }

    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">Memberships</h1>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {activeMembershipCount} active
          </span>
        </div>
        <RoleGuard role={role} action="create" resource="memberships">
          <Button onClick={() => setShowForm(true)}>
            Add Plan
          </Button>
        </RoleGuard>
      </div>

      {/* Empty state */}
      {memberships.length === 0 && (
        <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
          <p className="text-sm text-muted-foreground">No membership plans found. Create your first plan to get started.</p>
        </div>
      )}

      {/* Membership plans grid */}
      {memberships.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map((membership) => (
            <MembershipCard
              key={membership.id}
              membership={membership}
              role={role}
              onEdit={() => handleEdit(membership)}
              onDelete={() => {
                setDeleteTarget(membership);
                setDeleteError('');
              }}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <Modal onClose={handleCloseForm}>
          <MembershipForm membership={editingMembership} onClose={handleCloseForm} />
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Delete Membership Plan</h2>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-medium text-foreground">{deleteTarget.name}</span>?
              This will deactivate the plan. Existing customer memberships will remain active until they expire.
            </p>
            {deleteError && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
                <p className="text-sm text-amber-800 dark:text-amber-200">{deleteError}</p>
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =============================================================================
// MembershipCard — Individual membership plan display card
// =============================================================================

interface MembershipCardProps {
  membership: Membership;
  role: UserRole;
  onEdit: () => void;
  onDelete: () => void;
}

function MembershipCard({ membership, role, onEdit, onDelete }: MembershipCardProps) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-medium text-foreground truncate">{membership.name}</h3>
            {membership.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {membership.description}
              </p>
            )}
          </div>
          <span className="shrink-0 text-sm font-semibold text-foreground">
            {formatINR(membership.price)}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {membership.validity_days} days
          </span>
          <span className="flex items-center gap-1">
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            {membership.discount_pct}% off
          </span>
        </div>

        {/* Edit/Delete buttons — owner only */}
        <RoleGuard role={role} action="update" resource="memberships">
          <div className="flex items-center gap-2 pt-1 border-t border-border">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <RoleGuard role={role} action="delete" resource="memberships">
              <Button variant="destructive" size="sm" onClick={onDelete}>
                Delete
              </Button>
            </RoleGuard>
          </div>
        </RoleGuard>
      </CardContent>
    </Card>
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
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg mx-4">
        {children}
      </div>
    </div>
  );
}
