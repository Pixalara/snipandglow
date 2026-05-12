'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RoleGuard } from '@/components/role-guard';
import { BranchForm } from './branch-form';
import { updateBranchHours } from './actions';
import type { BranchStats } from './actions';
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
  Users,
  Calendar,
  IndianRupee,
  BarChart3,
} from 'lucide-react';
import type { Branch, UserRole, OperatingHours } from '@/types';

// =============================================================================
// BranchesClient — Interactive client wrapper for branch management page
// =============================================================================

interface BranchesClientProps {
  branches: Branch[];
  branchStats: BranchStats[];
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

export function BranchesClient({ branches, branchStats, role }: BranchesClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | undefined>(undefined);
  const [hoursEditBranch, setHoursEditBranch] = useState<Branch | null>(null);

  function handleEdit(branch: Branch) {
    setEditingBranch(branch);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingBranch(undefined);
  }

  const activeBranches = branches.filter((b) => b.is_active).length;

  /** Get stats for a branch */
  function getStats(branchId: string): BranchStats | undefined {
    return branchStats.find((s) => s.branch_id === branchId);
  }

  // Total stats across all branches
  const totalRevenue = branchStats.reduce((sum, s) => sum + s.revenue, 0);
  const totalAppointments = branchStats.reduce((sum, s) => sum + s.appointment_count, 0);
  const totalCustomers = branchStats.reduce((sum, s) => sum + s.customer_count, 0);

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

      {/* Performance Summary */}
      {branchStats.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-muted-foreground">Performance Overview</h2>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
              <p className="text-xs font-medium text-muted-foreground">Total Revenue</p>
              <div className="flex items-center gap-1 mt-1">
                <IndianRupee className="size-4 text-emerald-600" />
                <span className="text-2xl font-bold text-foreground">{totalRevenue.toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
              <p className="text-xs font-medium text-muted-foreground">Total Appointments</p>
              <div className="flex items-center gap-1 mt-1">
                <Calendar className="size-4 text-blue-600" />
                <span className="text-2xl font-bold text-foreground">{totalAppointments.toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
              <p className="text-xs font-medium text-muted-foreground">Total Customers</p>
              <div className="flex items-center gap-1 mt-1">
                <Users className="size-4 text-violet-600" />
                <span className="text-2xl font-bold text-foreground">{totalCustomers.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

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
              stats={getStats(branch.id)}
              onEdit={() => handleEdit(branch)}
              onEditHours={() => setHoursEditBranch(branch)}
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

      {/* Operating Hours Editor Modal */}
      {hoursEditBranch && (
        <Modal onClose={() => setHoursEditBranch(null)}>
          <OperatingHoursEditor branch={hoursEditBranch} onClose={() => setHoursEditBranch(null)} />
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
  stats?: BranchStats;
  onEdit: () => void;
  onEditHours: () => void;
}

function BranchCard({ branch, role, stats, onEdit, onEditHours }: BranchCardProps) {
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

        {/* Quick Stats */}
        {stats && branch.is_active && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-xs text-muted-foreground">Customers</p>
              <p className="text-sm font-semibold text-foreground">{stats.customer_count}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-xs text-muted-foreground">Appts</p>
              <p className="text-sm font-semibold text-foreground">{stats.appointment_count}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2 text-center">
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="text-sm font-semibold text-foreground">₹{stats.revenue.toLocaleString('en-IN', { notation: 'compact' } as Intl.NumberFormatOptions)}</p>
            </div>
          </div>
        )}

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

        {/* Action buttons */}
        <RoleGuard role={role} action="update" resource="branches">
          <div className="pt-2 border-t border-border flex items-center gap-2">
            <Button variant="ghost" size="sm" className="rounded-lg gap-1.5 text-xs" onClick={onEdit}>
              <Pencil className="size-3" />
              Edit
            </Button>
            <Button variant="ghost" size="sm" className="rounded-lg gap-1.5 text-xs" onClick={onEditHours}>
              <Clock className="size-3" />
              Hours
            </Button>
          </div>
        </RoleGuard>
      </div>
    </div>
  );
}

// =============================================================================
// OperatingHoursEditor — Edit branch operating hours
// =============================================================================

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABELS: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

interface OperatingHoursEditorProps {
  branch: Branch;
  onClose: () => void;
}

function OperatingHoursEditor({ branch, onClose }: OperatingHoursEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const hours: OperatingHours = {};

    for (const day of DAYS) {
      const isOpen = formData.get(`${day}_enabled`) === 'on';
      if (isOpen) {
        const open = formData.get(`${day}_open`) as string;
        const close = formData.get(`${day}_close`) as string;
        if (open && close) {
          hours[day] = { open, close };
        }
      }
    }

    const result = await updateBranchHours(branch.id, hours);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/20">
          <Clock className="size-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Operating Hours</h2>
          <p className="text-sm text-muted-foreground">{branch.name}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="space-y-3 max-h-[50vh] overflow-y-auto">
        {DAYS.map((day) => {
          const currentHours = branch.operating_hours?.[day];
          const isOpen = !!currentHours;

          return (
            <div key={day} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <label className="flex items-center gap-2 min-w-[100px]">
                <input
                  type="checkbox"
                  name={`${day}_enabled`}
                  defaultChecked={isOpen}
                  className="rounded border-border"
                />
                <span className="text-sm font-medium text-foreground">{DAY_LABELS[day]}</span>
              </label>
              <div className="flex items-center gap-2 flex-1">
                <Input
                  name={`${day}_open`}
                  type="time"
                  defaultValue={currentHours?.open ?? '09:00'}
                  className="text-xs h-8"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  name={`${day}_close`}
                  type="time"
                  defaultValue={currentHours?.close ?? '21:00'}
                  className="text-xs h-8"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" className="rounded-xl" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Hours'}
        </Button>
      </div>
    </form>
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
