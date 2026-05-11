'use client';

import { useState } from 'react';
import { formatINR } from '@/lib/utils';
import { RoleGuard } from '@/components/role-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ServiceForm } from './service-form';
import { softDeleteService } from './actions';
import type { Service, UserRole } from '@/types';

// =============================================================================
// ServicesClient — Interactive client wrapper for services page
// =============================================================================

interface ServicesClientProps {
  grouped: Record<string, Service[]>;
  role: UserRole;
}

export function ServicesClient({ grouped, role }: ServicesClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  function handleEdit(service: Service) {
    setEditingService(service);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingService(undefined);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');

    const result = await softDeleteService(deleteTarget.id);

    setIsDeleting(false);

    if (!result.success) {
      setDeleteError(result.error);
      return;
    }

    setDeleteTarget(null);
  }

  const categories = Object.keys(grouped);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-foreground">Services</h1>
        <RoleGuard role={role} action="create" resource="services">
          <Button onClick={() => setShowForm(true)}>
            Add Service
          </Button>
        </RoleGuard>
      </div>

      {/* Empty state */}
      {categories.length === 0 && (
        <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
          <p className="text-sm text-muted-foreground">No services found. Add your first service to get started.</p>
        </div>
      )}

      {/* Services grouped by category */}
      {categories.map((category) => (
        <div key={category} className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {category}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grouped[category].map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                role={role}
                onEdit={() => handleEdit(service)}
                onDelete={() => {
                  setDeleteTarget(service);
                  setDeleteError('');
                }}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Create/Edit Modal */}
      {showForm && (
        <Modal onClose={handleCloseForm}>
          <ServiceForm service={editingService} onClose={handleCloseForm} />
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Delete Service</h2>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-medium text-foreground">{deleteTarget.name}</span>?
              This will deactivate the service and it will no longer appear in the catalog.
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
// ServiceCard — Individual service display card
// =============================================================================

interface ServiceCardProps {
  service: Service;
  role: UserRole;
  onEdit: () => void;
  onDelete: () => void;
}

function ServiceCard({ service, role, onEdit, onDelete }: ServiceCardProps) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-medium text-foreground truncate">{service.name}</h3>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary mt-1">
              {service.category}
            </span>
          </div>
          <span className="shrink-0 text-sm font-semibold text-foreground">
            {formatINR(service.price)}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {service.duration_minutes} min
          </span>
        </div>

        {/* Edit/Delete buttons — owner/manager only */}
        <RoleGuard role={role} action="update" resource="services">
          <div className="flex items-center gap-2 pt-1 border-t border-border">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <RoleGuard role={role} action="delete" resource="services">
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
