'use client';

import { useState } from 'react';
import { formatINR } from '@/lib/utils';
import { RoleGuard } from '@/components/role-guard';
import { Button } from '@/components/ui/button';
import { ServiceForm } from './service-form';
import { RowActionsMenu, type RowAction } from '@/components/row-actions-menu';
import { softDeleteService } from './actions';
import {
  Scissors,
  Plus,
  Clock,
  Tag,
  IndianRupee,
  Pencil,
  Trash2,
  Sparkles,
} from 'lucide-react';
import type { Service, UserRole } from '@/types';

// =============================================================================
// ServicesClient — Interactive client wrapper for services page
// =============================================================================

/** Category icon color mapping */
const categoryColors: Record<string, { bg: string; text: string; gradient: string }> = {
  hair: { bg: 'bg-violet-100 dark:bg-violet-900/20', text: 'text-violet-600 dark:text-violet-400', gradient: 'from-violet-500/10 to-violet-600/5' },
  skin: { bg: 'bg-rose-100 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400', gradient: 'from-rose-500/10 to-rose-600/5' },
  nails: { bg: 'bg-pink-100 dark:bg-pink-900/20', text: 'text-pink-600 dark:text-pink-400', gradient: 'from-pink-500/10 to-pink-600/5' },
  makeup: { bg: 'bg-amber-100 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', gradient: 'from-amber-500/10 to-amber-600/5' },
  spa: { bg: 'bg-teal-100 dark:bg-teal-900/20', text: 'text-teal-600 dark:text-teal-400', gradient: 'from-teal-500/10 to-teal-600/5' },
};

function getCategoryStyle(category: string) {
  const key = category.toLowerCase();
  return categoryColors[key] ?? { bg: 'bg-gray-100 dark:bg-gray-900/20', text: 'text-gray-600 dark:text-gray-400', gradient: 'from-gray-500/10 to-gray-600/5' };
}

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
  const totalServices = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-salon-rose/10 via-salon-rose/5 to-transparent border border-salon-rose/20 p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-salon-rose/10">
              <Scissors className="size-5 text-salon-rose" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Services</h1>
              <p className="text-sm text-muted-foreground">
                {totalServices} service{totalServices !== 1 ? 's' : ''} across {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
              </p>
            </div>
          </div>
          <RoleGuard role={role} action="create" resource="services">
            <Button onClick={() => setShowForm(true)} className="rounded-xl gap-1.5">
              <Plus className="size-4" />
              Add Service
            </Button>
          </RoleGuard>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-salon-rose/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-salon-gold/5" />
      </div>

      {/* Empty state */}
      {categories.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-salon-rose/10 mb-4">
            <Sparkles className="size-6 text-salon-rose" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No services yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Add your first service to start building your salon catalog and booking appointments.
          </p>
          <RoleGuard role={role} action="create" resource="services">
            <Button onClick={() => setShowForm(true)} className="mt-4 rounded-xl gap-1.5" variant="outline">
              <Plus className="size-4" />
              Add Your First Service
            </Button>
          </RoleGuard>
        </div>
      )}

      {/* Services grouped by category */}
      {categories.map((category) => {
        const style = getCategoryStyle(category);
        return (
          <div key={category} className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`flex size-6 items-center justify-center rounded-md ${style.bg}`}>
                <Tag className={`size-3 ${style.text}`} />
              </div>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                {category}
              </h2>
              <span className="text-xs text-muted-foreground">({grouped[category].length})</span>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
        );
      })}

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
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <Trash2 className="size-5 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Delete Service</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-medium text-foreground">{deleteTarget.name}</span>?
              This will deactivate the service and it will no longer appear in the catalog.
            </p>
            {deleteError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
                <p className="text-sm text-amber-800 dark:text-amber-200">{deleteError}</p>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
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
  const style = getCategoryStyle(service.category);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md hover:border-border/80 hover:-translate-y-0.5">
      <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
      <div className="relative space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground truncate group-hover:text-salon-rose transition-colors">
              {service.name}
            </h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium mt-1.5 ${style.bg} ${style.text}`}>
              <Tag className="size-2.5" />
              {service.category}
            </span>
          </div>
          <div className="flex shrink-0 items-start gap-1">
            <span className="text-base font-bold text-foreground">
              {formatINR(service.price)}
            </span>
            {/* Actions menu — owner/manager only */}
            {(role === 'owner' || role === 'manager') && (
              <RowActionsMenu
                actions={[
                  { label: 'Edit', icon: <Pencil className="size-3.5" />, onClick: onEdit },
                  ...(role === 'owner'
                    ? [{ label: 'Delete', icon: <Trash2 className="size-3.5" />, danger: true, onClick: onDelete } as RowAction]
                    : []),
                ]}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Tag className="size-3.5" />
            {service.category}
          </span>
        </div>
      </div>
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
