'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RoleGuard } from '@/components/role-guard';
import { BranchForm } from './branch-form';
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  Clock,
  Pencil,
  CheckCircle2,
  XCircle,
  Star,
} from 'lucide-react';
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
  if (!hours) return 'Not set';
  const mon = hours.mon;
  if (!mon) return 'Not set';
  return `${mon.open} – ${mon.close}`;
}

/** Get day abbreviations for operating hours display */
function getOpenDays(hours: OperatingHours | null | undefined): string[] {
  if (!hours) return [];
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
  return days.filter((day) => hours[day] != null).map((d) => d.charAt(0).toUpperCase() + d.slice(1));
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

  const activeBranches = branches.filter((b) => b.is_active).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-200/50 dark:border-emerald-800/30 p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <Building2 className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Branch Management</h1>
              <p className="text-sm text-muted-foreground">
                {activeBranches} active · {branches.length} total branch{branches.length !== 1 ? 'es' : ''}
              </p>
            </div>
          </div>
          <RoleGuard role={role} action="create" resource="branches">
            <Button onClick={() => setShowForm(true)} className="rounded-xl gap-1.5">
              <Plus className="size-4" />
              Add Branch
            </Button>
          </RoleGuard>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-emerald-500/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-emerald-400/5" />
      </div>

      {/* Empty state */}
      {branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20 mb-4">
            <Building2 className="size-6 text-emerald-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No branches yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Add your first branch to start managing multiple salon locations.
          </p>
          <RoleGuard role={role} action="create" resource="branches">
            <Button onClick={() => setShowForm(true)} className="mt-4 rounded-xl gap-1.5" variant="outline">
              <Plus className="size-4" />
              Add First Branch
            </Button>
          </RoleGuard>
        </div>
      ) : (
        /* Branch Cards Grid */
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((branch) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              role={role}
              onEdit={() => handleEdit(branch)}
            />
          ))}
        </div>
      )}

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
// BranchCard — Individual branch display card
// =============================================================================

interface BranchCardProps {
  branch: Branch;
  role: UserRole;
  onEdit: () => void;
}

function BranchCard({ branch, role, onEdit }: BranchCardProps) {
  const openDays = getOpenDays(branch.operating_hours);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md hover:border-border/80 hover:-translate-y-0.5">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {branch.name}
              </h3>
              {branch.is_default && (
                <span className="inline-flex items-center gap-1 rounded-full bg-salon-gold/10 px-2 py-0.5 text-xs font-medium text-salon-gold">
                  <Star className="size-2.5" />
                  Default
                </span>
              )}
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              branch.is_active
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {branch.is_active ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <XCircle className="size-3" />
            )}
            {branch.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-2">
          {branch.address && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="size-3.5 mt-0.5 shrink-0" />
              <span className="line-clamp-2">{branch.address}</span>
            </div>
          )}
          {branch.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="size-3.5 shrink-0" />
              <span>{branch.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            <span>{formatHoursSummary(branch.operating_hours)}</span>
          </div>
        </div>

        {/* Open days */}
        {openDays.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {openDays.map((day) => (
              <span key={day} className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {day}
              </span>
            ))}
          </div>
        )}

        {/* Edit button */}
        <RoleGuard role={role} action="update" resource="branches">
          <div className="pt-2 border-t border-border">
            <Button variant="ghost" size="sm" className="rounded-lg gap-1.5 text-xs" onClick={onEdit}>
              <Pencil className="size-3" />
              Edit Branch
            </Button>
          </div>
        </RoleGuard>
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
