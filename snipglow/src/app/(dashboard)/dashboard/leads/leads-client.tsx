'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type Column } from '@/components/data-table';
import { RoleGuard } from '@/components/role-guard';
import { createLead, updateLead, deleteLead, convertLeadToCustomer } from './actions';
import {
  Target,
  Plus,
  Pencil,
  Trash2,
  UserCheck,
  Filter,
  AlertTriangle,
  Phone,
  CalendarClock,
} from 'lucide-react';
import type { Lead, LeadSource, LeadStatus, UserRole } from '@/types';

// =============================================================================
// LeadsClient — Interactive client wrapper for lead management
// =============================================================================

const SOURCE_LABELS: Record<LeadSource, string> = {
  walk_in: 'Walk-in',
  social_media: 'Social Media',
  referral: 'Referral',
  website: 'Website',
  whatsapp: 'WhatsApp',
  other: 'Other',
};

const SOURCE_COLORS: Record<LeadSource, string> = {
  walk_in: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300',
  social_media: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  referral: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  website: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  whatsapp: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  interested: 'Interested',
  not_interested: 'Not Interested',
  converted: 'Converted',
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  contacted: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  interested: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  not_interested: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  converted: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

const STATUS_DOTS: Record<LeadStatus, string> = {
  new: 'bg-blue-500',
  contacted: 'bg-amber-500',
  interested: 'bg-emerald-500',
  not_interested: 'bg-red-500',
  converted: 'bg-purple-500',
};

interface LeadsClientProps {
  leads: Lead[];
  role: UserRole;
}

export function LeadsClient({ leads, role }: LeadsClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [convertTarget, setConvertTarget] = useState<Lead | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [convertError, setConvertError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Filter leads by status
  const filteredLeads = useMemo(() => {
    if (filterStatus === 'all') return leads;
    return leads.filter((l) => l.status === filterStatus);
  }, [leads, filterStatus]);

  // Pipeline counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      new: 0,
      contacted: 0,
      interested: 0,
      not_interested: 0,
      converted: 0,
    };
    leads.forEach((l) => {
      counts[l.status] = (counts[l.status] || 0) + 1;
    });
    return counts;
  }, [leads]);

  // Check if a lead has overdue or today follow-up
  function isFollowUpDue(followUpDate: string | null): boolean {
    if (!followUpDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fDate = new Date(followUpDate);
    fDate.setHours(0, 0, 0, 0);
    return fDate <= today;
  }

  function handleEdit(lead: Lead) {
    setEditingLead(lead);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingLead(undefined);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');

    const result = await deleteLead(deleteTarget.id);
    setIsDeleting(false);

    if (!result.success) {
      setDeleteError(result.error);
      return;
    }
    setDeleteTarget(null);
  }

  async function handleConfirmConvert() {
    if (!convertTarget) return;
    setIsConverting(true);
    setConvertError('');

    const result = await convertLeadToCustomer(convertTarget.id);
    setIsConverting(false);

    if (!result.success) {
      setConvertError(result.error);
      return;
    }
    setConvertTarget(null);
  }

  const columns: Column<Lead>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/20 text-xs font-bold text-orange-600 dark:text-orange-400">
            {row.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="font-medium text-foreground">{row.name}</span>
            {isFollowUpDue(row.follow_up_date) && row.status !== 'converted' && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                <CalendarClock className="size-2.5" />
                Follow-up due
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Phone className="size-3" />
          {row.phone}
        </span>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      render: (row) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SOURCE_COLORS[row.source]}`}>
          {SOURCE_LABELS[row.source]}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[row.status]}`}>
          <span className={`size-1.5 rounded-full ${STATUS_DOTS[row.status]}`} />
          {STATUS_LABELS[row.status]}
        </span>
      ),
    },
    {
      key: 'follow_up',
      header: 'Follow-up',
      render: (row) => {
        if (!row.follow_up_date) return <span className="text-muted-foreground text-xs">—</span>;
        const isDue = isFollowUpDue(row.follow_up_date);
        return (
          <span className={`text-sm ${isDue && row.status !== 'converted' ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
            {new Date(row.follow_up_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          {row.status !== 'converted' && (
            <RoleGuard role={role} action="update" resource="leads">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg h-8 w-8 p-0 text-purple-600 hover:text-purple-800 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
                onClick={() => { setConvertTarget(row); setConvertError(''); }}
                title="Convert to Customer"
              >
                <UserCheck className="size-3.5" />
              </Button>
            </RoleGuard>
          )}
          <RoleGuard role={role} action="update" resource="leads">
            <Button variant="ghost" size="sm" className="rounded-lg h-8 w-8 p-0" onClick={() => handleEdit(row)}>
              <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
            </Button>
          </RoleGuard>
          <RoleGuard role={role} action="delete" resource="leads">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => { setDeleteTarget(row); setDeleteError(''); }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </RoleGuard>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-transparent border border-orange-200/50 dark:border-orange-800/30 p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
              <Target className="size-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Leads</h1>
              <p className="text-sm text-muted-foreground">
                {leads.length} lead{leads.length !== 1 ? 's' : ''} in pipeline
              </p>
            </div>
          </div>
          <RoleGuard role={role} action="create" resource="leads">
            <Button onClick={() => setShowForm(true)} className="rounded-xl gap-1.5">
              <Plus className="size-4" />
              Add Lead
            </Button>
          </RoleGuard>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-orange-500/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-amber-400/5" />
      </div>

      {/* Pipeline Summary */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
        {(Object.entries(STATUS_LABELS) as [LeadStatus, string][]).map(([status, label]) => (
          <button
            key={status}
            onClick={() => setFilterStatus(filterStatus === status ? 'all' : status)}
            className={`rounded-xl border p-3 text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${
              filterStatus === status
                ? 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20'
                : 'border-border bg-card'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${STATUS_DOTS[status]}`} />
              <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
            </div>
            <span className="text-xl font-bold text-foreground mt-1 block">{statusCounts[status] || 0}</span>
          </button>
        ))}
      </div>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Filter className="size-4 text-muted-foreground hidden sm:block" />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full sm:w-auto rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        {filterStatus !== 'all' && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => setFilterStatus('all')}>
            Clear filter
          </Button>
        )}
      </div>

      {/* Leads Table */}
      {filteredLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-900/20 mb-4">
            <Target className="size-6 text-orange-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No leads found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {filterStatus !== 'all'
              ? 'No leads with this status. Try a different filter.'
              : 'Start tracking potential customers. Add walk-ins, social media inquiries, and referrals.'}
          </p>
          {filterStatus === 'all' && (
            <RoleGuard role={role} action="create" resource="leads">
              <Button onClick={() => setShowForm(true)} className="mt-4 rounded-xl gap-1.5" variant="outline">
                <Plus className="size-4" />
                Add First Lead
              </Button>
            </RoleGuard>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <DataTable
            columns={columns}
            data={filteredLeads}
            getRowKey={(row) => row.id}
            emptyMessage="No leads yet"
            emptyIcon={<Phone className="size-6 text-muted-foreground" />}
            emptyHint="Enquiries you capture here can be converted into customers once they book."
          />
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <Modal onClose={handleCloseForm}>
          <LeadForm lead={editingLead} onClose={handleCloseForm} />
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <Modal onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Delete Lead</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the lead{' '}
              <span className="font-medium text-foreground">&quot;{deleteTarget.name}&quot;</span>?
              This action cannot be undone.
            </p>
            {deleteError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
                <p className="text-sm text-red-800 dark:text-red-200">{deleteError}</p>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="destructive" className="rounded-xl" onClick={handleConfirmDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Convert Confirmation */}
      {convertTarget && (
        <Modal onClose={() => setConvertTarget(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/20">
                <UserCheck className="size-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Convert to Customer</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              This will create a new customer record from{' '}
              <span className="font-medium text-foreground">&quot;{convertTarget.name}&quot;</span>&apos;s
              lead data and mark the lead as converted.
            </p>
            <div className="rounded-xl border border-border bg-muted/50 p-3 space-y-1">
              <p className="text-sm"><span className="text-muted-foreground">Name:</span> <span className="font-medium">{convertTarget.name}</span></p>
              <p className="text-sm"><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{convertTarget.phone}</span></p>
              {convertTarget.email && (
                <p className="text-sm"><span className="text-muted-foreground">Email:</span> <span className="font-medium">{convertTarget.email}</span></p>
              )}
            </div>
            {convertError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
                <p className="text-sm text-red-800 dark:text-red-200">{convertError}</p>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setConvertTarget(null)} disabled={isConverting}>
                Cancel
              </Button>
              <Button className="rounded-xl gap-1.5 bg-purple-600 hover:bg-purple-700" onClick={handleConfirmConvert} disabled={isConverting}>
                <UserCheck className="size-4" />
                {isConverting ? 'Converting...' : 'Convert'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =============================================================================
// LeadForm — Add/Edit lead form
// =============================================================================

interface LeadFormProps {
  lead?: Lead;
  onClose: () => void;
}

function LeadForm({ lead, onClose }: LeadFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!lead;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;
    const email = formData.get('email') as string;
    const source = formData.get('source') as LeadSource;
    const notes = formData.get('notes') as string;
    const follow_up_date = formData.get('follow_up_date') as string;
    const status = formData.get('status') as LeadStatus | null;

    let result;
    if (isEditing) {
      result = await updateLead(lead.id, {
        name,
        phone,
        email: email || null,
        source,
        status: status || undefined,
        notes: notes || null,
        follow_up_date: follow_up_date || null,
      });
    } else {
      result = await createLead({
        name,
        phone,
        email: email || undefined,
        source,
        notes: notes || undefined,
        follow_up_date: follow_up_date || undefined,
      });
    }

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">
        {isEditing ? 'Edit Lead' : 'Add Lead'}
      </h2>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            name="name"
            defaultValue={lead?.name ?? ''}
            placeholder="e.g., Priya Sharma"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="phone">Phone *</Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={lead?.phone ?? ''}
            placeholder="e.g., 9876543210"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={lead?.email ?? ''}
            placeholder="e.g., priya@example.com"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="source">Source</Label>
          <select
            id="source"
            name="source"
            defaultValue={lead?.source ?? 'walk_in'}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {Object.entries(SOURCE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {isEditing && (
          <div>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={lead?.status ?? 'new'}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <Label htmlFor="follow_up_date">Follow-up Date</Label>
          <Input
            id="follow_up_date"
            name="follow_up_date"
            type="date"
            defaultValue={lead?.follow_up_date ?? ''}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            name="notes"
            defaultValue={lead?.notes ?? ''}
            placeholder="Any additional context about this lead..."
            rows={3}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" className="rounded-xl" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Lead' : 'Add Lead'}
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
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
