'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateIN } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createSupportTicket } from './actions';
import {
  HelpCircle,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageCircle,
  Shield,
  Headphones,
  X,
  Send,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface TicketRow {
  id: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
}

interface SupportClientProps {
  tickets: TicketRow[];
  userName: string;
  userPhone: string;
  tenantId: string;
  branchId: string;
}

// =============================================================================
// Status & Priority Badges
// =============================================================================

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: typeof Clock }> = {
    open: { label: 'Open', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
    in_progress: { label: 'In Progress', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
    resolved: { label: 'Resolved', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
    closed: { label: 'Closed', className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400', icon: CheckCircle2 },
  };

  const { label, className, icon: Icon } = config[status] ?? config.open;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      <Icon className="size-3" />
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { label: string; className: string }> = {
    low: { label: 'Low', className: 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400' },
    medium: { label: 'Medium', className: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    high: { label: 'High', className: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
    urgent: { label: 'Urgent', className: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
  };

  const { label, className } = config[priority] ?? config.medium;

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// =============================================================================
// Support Client Component
// =============================================================================

export function SupportClient({ tickets, userName, userPhone, tenantId, branchId }: SupportClientProps) {
  const [showForm, setShowForm] = useState(false);

  const columns: Column<TicketRow>[] = [
    {
      key: 'subject',
      header: 'Issue',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-foreground line-clamp-1">{row.subject}</p>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{row.description}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => (
        <span className="text-xs text-muted-foreground capitalize">{row.category.replace('_', ' ')}</span>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (row) => <PriorityBadge priority={row.priority} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'date',
      header: 'Submitted',
      render: (row) => (
        <span className="text-xs text-muted-foreground">{formatDateIN(row.created_at)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-200/50 dark:border-blue-800/30 p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Headphones className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Help & Support</h1>
              <p className="text-sm text-muted-foreground">
                Report issues, get help — we respond within 24 hours
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="rounded-xl gap-1.5 min-h-[44px]"
          >
            <Plus className="size-4" />
            Report Issue
          </Button>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-blue-500/5" />
      </div>

      {/* Trust Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Clock className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">24hr Response</p>
            <p className="text-xs text-muted-foreground">We reply within 24 hours</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
            <MessageCircle className="size-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">WhatsApp Support</p>
            <p className="text-xs text-muted-foreground">Direct team communication</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
            <Shield className="size-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Priority Handling</p>
            <p className="text-xs text-muted-foreground">Critical issues resolved first</p>
          </div>
        </div>
      </div>

      {/* Tickets Table or Empty State */}
      {tickets.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <DataTable
            columns={columns}
            data={tickets}
            getRowKey={(row) => row.id}
            emptyMessage="No tickets yet"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/20 mb-4">
            <HelpCircle className="size-6 text-blue-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No issues reported</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Everything running smoothly? If you face any issue, click &quot;Report Issue&quot; and our team will help you within 24 hours.
          </p>
        </div>
      )}

      {/* New Ticket Modal */}
      {showForm && (
        <NewTicketModal onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}

// =============================================================================
// New Ticket Modal
// =============================================================================

function NewTicketModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleSubmit() {
    if (!subject.trim() || !description.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setError('');
    startTransition(async () => {
      const result = await createSupportTicket({
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          router.refresh();
        }, 2000);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-4 text-blue-600" />
            <h2 className="text-base font-semibold text-foreground">Report an Issue</h2>
          </div>
          <button onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {success ? (
            <div className="flex flex-col items-center text-center py-6 gap-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/20">
                <CheckCircle2 className="size-7 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Ticket Submitted!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Our team has been notified and will respond within 24 hours on WhatsApp.
                </p>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
                  <AlertTriangle className="size-4 text-red-600 shrink-0" />
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Subject <span className="text-destructive">*</span>
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief title of your issue..."
                />
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="general">General</option>
                    <option value="billing">Billing Issue</option>
                    <option value="appointments">Appointments</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="bug">Bug / Error</option>
                    <option value="feature_request">Feature Request</option>
                    <option value="account">Account / Login</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Describe your issue <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us what happened, what you expected, and any steps to reproduce the issue..."
                  rows={4}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              {/* Info note */}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 px-4 py-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  💬 Our team will respond on WhatsApp within 24 hours. For urgent issues, mark priority as &quot;Urgent&quot;.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4 bg-muted/20 shrink-0">
            <Button variant="outline" className="rounded-xl" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button className="rounded-xl gap-1.5" onClick={handleSubmit} disabled={isPending}>
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Submitting...
                </span>
              ) : (
                <>
                  <Send className="size-4" />
                  Submit Ticket
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
