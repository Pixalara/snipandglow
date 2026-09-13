'use client';

import { useState, useMemo } from 'react';
import { DataTable, type Column } from '@/components/data-table';
import { formatDateIN, formatTimeIST } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  ScrollText,
  Download,
  Filter,
  Calendar,
  FileText,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { AuditLog } from '@/types';

// =============================================================================
// Audit Log Client Component
// Handles filtering (date range, action type) and CSV export
//
// Requirements: 12.3, 12.4
// =============================================================================

interface AuditLogClientProps {
  logs: AuditLog[];
}

// =============================================================================
// Simplify description for salon owners
// =============================================================================

/** Simple past-tense verb per database action (no DB jargon like INSERT). */
const ACTION_LABELS: Record<string, string> = {
  insert: 'Added',
  update: 'Edited',
  delete: 'Removed',
};

/** Natural noun that reads well after Added / Edited / Removed. */
const RESOURCE_NOUNS: Record<string, string> = {
  invoices: 'a bill',
  invoice_items: 'a bill',
  appointments: 'an appointment',
  customers: 'a customer',
  services: 'a service',
  employees: 'a staff member',
  memberships: 'a membership plan',
  customer_memberships: "a customer's membership",
  branches: 'a branch',
  expenses: 'an expense',
  payroll: 'a payroll record',
  payroll_records: 'a payroll record',
  attendance: 'an attendance entry',
  leads: 'a lead',
  products: 'a product',
  inventory_movements: 'a stock change',
  customer_wallets: 'a wallet balance',
  wallet_transactions: 'a wallet entry',
  customer_loyalty: 'loyalty points',
  loyalty_transactions: 'loyalty points',
};

/** Friendly section name for the Resource column, e.g. invoices -> "Billing". */
const RESOURCE_SECTIONS: Record<string, string> = {
  invoices: 'Billing',
  invoice_items: 'Billing',
  appointments: 'Appointments',
  customers: 'Customers',
  services: 'Services',
  employees: 'Staff',
  memberships: 'Memberships',
  customer_memberships: 'Memberships',
  branches: 'Branches',
  expenses: 'Expenses',
  payroll: 'Payroll',
  payroll_records: 'Payroll',
  attendance: 'Payroll',
  leads: 'Leads',
  products: 'Inventory',
  inventory_movements: 'Inventory',
  customer_wallets: 'Wallet',
  wallet_transactions: 'Wallet',
  customer_loyalty: 'Loyalty Points',
  loyalty_transactions: 'Loyalty Points',
};

function titleCase(s: string): string {
  return (s ?? '').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "Added" / "Edited" / "Removed" (falls back to a title-cased action). */
function friendlyAction(actionType: string): string {
  return ACTION_LABELS[actionType?.toLowerCase() ?? ''] ?? titleCase(actionType ?? '');
}

/** Friendly section name for the Resource column. */
function friendlyResource(resourceType: string): string {
  const key = resourceType?.toLowerCase() ?? '';
  return RESOURCE_SECTIONS[key] ?? titleCase(key.replace(/_/g, ' '));
}

/** Human-friendly field names for the "changed X, Y" part of an edit. */
const FIELD_LABELS: Record<string, string> = {
  payment_method: 'payment method',
  payment_status: 'payment status',
  delivery_status: 'delivery status',
  total: 'total',
  subtotal: 'total',
  discount_amount: 'discount',
  discount_pct: 'discount',
  gst_amount: 'GST',
  gst_rate: 'GST rate',
  wallet_amount: 'wallet payment',
  loyalty_amount: 'points redeemed',
  status: 'status',
  appointment_date: 'date',
  start_time: 'time',
  end_time: 'time',
  employee_id: 'assigned staff',
  service_id: 'service',
  name: 'name',
  phone: 'phone',
  email: 'email',
  gender: 'gender',
  date_of_birth: 'birthday',
  notes: 'notes',
  price: 'price',
  stock_quantity: 'stock',
  is_active: 'active status',
  amount: 'amount',
  category: 'category',
};

/** Row fields that change on their own and aren't worth reporting. */
const IGNORED_FIELDS = new Set(['id', 'tenant_id', 'branch_id', 'created_at', 'updated_at', 'invoice_number']);

/** A recognisable name for the specific record, pulled from the row snapshot. */
function recordName(resourceType: string, data: Record<string, unknown> | null): string | null {
  if (!data) return null;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  switch (resourceType?.toLowerCase() ?? '') {
    case 'invoices': {
      const n = str(data.invoice_number);
      return n ? `bill ${n}` : null;
    }
    case 'customers': {
      const n = str(data.name);
      return n ? `${n}'s details` : null;
    }
    case 'services':
    case 'memberships':
    case 'products': {
      const n = str(data.name);
      return n ? `"${n}"` : null;
    }
    case 'employees': {
      const n = str(data.name);
      return n ? `staff member ${n}` : null;
    }
    case 'expenses': {
      const n = str(data.category) ?? str(data.title);
      return n ? `an expense (${n})` : null;
    }
    case 'leads': {
      const n = str(data.name);
      return n ? `lead ${n}` : null;
    }
    default:
      return null;
  }
}

/** Human list of what changed between the old and new row (max 3 shown). */
function changedFields(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): string[] {
  if (!oldData || !newData) return [];
  const labels: string[] = [];
  for (const key of Object.keys(newData)) {
    if (IGNORED_FIELDS.has(key)) continue;
    if (JSON.stringify(oldData[key]) === JSON.stringify(newData[key])) continue;
    const label = FIELD_LABELS[key] ?? key.replace(/_/g, ' ');
    if (!labels.includes(label)) labels.push(label);
  }
  return labels;
}

/**
 * Turn a raw audit row into a plain sentence such as "Edited bill INV-1042 —
 * changed payment method". App-level entries that already carry a human
 * description are shown as-is; only the database-trigger pattern
 * ("UPDATE on invoices") gets rewritten. Uses the row snapshot to name the exact
 * record and, for edits, list what changed.
 */
function simplifyDescription(
  log: Pick<AuditLog, 'action_type' | 'resource_type' | 'description' | 'old_data' | 'new_data'>
): string {
  const { action_type, resource_type, description, old_data, new_data } = log;
  if (description && !/^(INSERT|UPDATE|DELETE) on \w+$/i.test(description)) {
    return description;
  }
  const verb = friendlyAction(action_type);
  const snapshot = (new_data ?? old_data) as Record<string, unknown> | null;
  const specific = recordName(resource_type, snapshot);
  const noun = specific ?? RESOURCE_NOUNS[resource_type?.toLowerCase() ?? ''] ?? friendlyResource(resource_type).toLowerCase();
  let text = `${verb} ${noun}`;
  if (action_type?.toLowerCase() === 'update') {
    const fields = changedFields(old_data, new_data).slice(0, 3);
    if (fields.length > 0) text += ` — changed ${fields.join(', ')}`;
  }
  return text;
}

/** Action type badge with icons */
function ActionBadge({ actionType }: { actionType: string }) {
  const normalized = actionType.toUpperCase();

  let colorClasses = 'bg-muted text-muted-foreground';
  let Icon = FileText;

  if (normalized === 'INSERT') {
    colorClasses = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    Icon = Plus;
  } else if (normalized === 'UPDATE') {
    colorClasses = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    Icon = Pencil;
  } else if (normalized === 'DELETE') {
    colorClasses = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    Icon = Trash2;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClasses}`}>
      <Icon className="size-3" />
      {friendlyAction(actionType)}
    </span>
  );
}

export function AuditLogClient({ logs }: AuditLogClientProps) {
  // Filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('');

  // Apply filters
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Date range filter
      if (dateFrom) {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        if (logDate < dateFrom) return false;
      }
      if (dateTo) {
        const logDate = new Date(log.created_at).toISOString().split('T')[0];
        if (logDate > dateTo) return false;
      }

      // Action type filter
      if (actionTypeFilter) {
        if (log.action_type.toUpperCase() !== actionTypeFilter) return false;
      }

      return true;
    });
  }, [logs, dateFrom, dateTo, actionTypeFilter]);

  // CSV export function
  function exportCSV() {
    const headers = ['Timestamp', 'Actor', 'Action', 'Resource', 'Description'];
    const rows = filteredLogs.map((log) => [
      `${formatDateIN(log.created_at)}, ${formatTimeIST(log.created_at)}`,
      log.actor_name,
      friendlyAction(log.action_type),
      friendlyResource(log.resource_type),
      simplifyDescription(log),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${(cell ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // DataTable columns
  const columns: Column<AuditLog>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
            <Calendar className="size-3.5 text-muted-foreground" />
          </div>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateIN(row.created_at)}, {formatTimeIST(row.created_at)}
          </span>
        </div>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-salon-rose/20 to-salon-gold/20 text-xs font-bold text-salon-rose">
            {row.actor_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <span className="text-sm font-medium text-foreground">{row.actor_name}</span>
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => <ActionBadge actionType={row.action_type} />,
    },
    {
      key: 'resource',
      header: 'Resource',
      render: (row) => (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
          {friendlyResource(row.resource_type)}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="text-sm text-muted-foreground line-clamp-1">{simplifyDescription(row)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-500/10 via-slate-500/5 to-transparent border border-slate-200/50 dark:border-slate-800/30 p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900/30">
              <ScrollText className="size-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Audit Log</h1>
              <p className="text-sm text-muted-foreground">
                {filteredLogs.length} entr{filteredLogs.length !== 1 ? 'ies' : 'y'} found
              </p>
            </div>
          </div>
          <Button
            onClick={exportCSV}
            disabled={filteredLogs.length === 0}
            className="rounded-xl gap-1.5"
            variant="outline"
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-slate-500/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-slate-400/5" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="size-4" />
          <span className="font-medium">Filters</span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end flex-1">
          {/* Date From */}
          <div className="flex flex-col gap-1">
            <label htmlFor="date-from" className="text-xs font-medium text-muted-foreground">
              From
            </label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Date To */}
          <div className="flex flex-col gap-1">
            <label htmlFor="date-to" className="text-xs font-medium text-muted-foreground">
              To
            </label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Action Type Dropdown */}
          <div className="flex flex-col gap-1">
            <label htmlFor="action-type" className="text-xs font-medium text-muted-foreground">
              Action Type
            </label>
            <select
              id="action-type"
              value={actionTypeFilter}
              onChange={(e) => setActionTypeFilter(e.target.value)}
              className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Actions</option>
              <option value="INSERT">Added</option>
              <option value="UPDATE">Edited</option>
              <option value="DELETE">Removed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      {filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-900/20 mb-4">
            <ScrollText className="size-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No audit logs found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            No activity matches your current filters. Try adjusting the date range or action type.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <DataTable
            columns={columns}
            data={filteredLogs}
            getRowKey={(row) => row.id}
            emptyMessage="No audit logs found"
          />
        </div>
      )}
    </div>
  );
}
