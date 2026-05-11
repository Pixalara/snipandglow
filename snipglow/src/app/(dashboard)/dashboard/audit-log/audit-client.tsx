'use client';

import { useState, useMemo } from 'react';
import { DataTable, type Column } from '@/components/data-table';
import { formatDateIN, formatTimeIST } from '@/lib/utils';
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

/** Action type badge colors */
function ActionBadge({ actionType }: { actionType: string }) {
  const normalized = actionType.toUpperCase();

  let colorClasses = 'bg-muted text-muted-foreground';
  if (normalized === 'INSERT') {
    colorClasses = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
  } else if (normalized === 'UPDATE') {
    colorClasses = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  } else if (normalized === 'DELETE') {
    colorClasses = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClasses}`}>
      {normalized}
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
      log.action_type,
      log.resource_type,
      log.description,
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
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDateIN(row.created_at)}, {formatTimeIST(row.created_at)}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (row) => (
        <span className="text-sm text-foreground">{row.actor_name}</span>
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
        <span className="text-sm capitalize text-foreground">{row.resource_type}</span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <span className="text-sm text-muted-foreground">{row.description}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filters and Export */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
        </div>

        {/* CSV Export Button */}
        <button
          onClick={exportCSV}
          disabled={filteredLogs.length === 0}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredLogs}
        getRowKey={(row) => row.id}
        emptyMessage="No audit logs found"
      />
    </div>
  );
}
