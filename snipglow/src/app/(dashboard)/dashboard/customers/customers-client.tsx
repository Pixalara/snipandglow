'use client';

import Link from 'next/link';
import { formatINR, formatDateIN } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import type { Customer } from '@/types';

/** Customer row with optional active membership info (serialized-safe) */
export interface CustomerRow extends Customer {
  has_active_membership: boolean;
}

interface CustomersTableProps {
  customers: CustomerRow[];
}

export function CustomersTable({ customers }: CustomersTableProps) {
  const columns: Column<CustomerRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <Link
          href={`/dashboard/customers/${row.id}`}
          className="font-medium text-foreground hover:text-primary transition-colors"
        >
          {row.name}
        </Link>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => <span className="text-muted-foreground">{row.phone}</span>,
    },
    {
      key: 'total_visits',
      header: 'Total Visits',
      render: (row) => <span>{row.total_visits}</span>,
    },
    {
      key: 'total_spent',
      header: 'Total Spent',
      render: (row) => <span>{formatINR(row.total_spent)}</span>,
    },
    {
      key: 'last_visit_at',
      header: 'Last Visit',
      render: (row) => (
        <span className="text-muted-foreground">
          {row.last_visit_at ? formatDateIN(row.last_visit_at) : '—'}
        </span>
      ),
    },
    {
      key: 'membership',
      header: 'Membership',
      render: (row) =>
        row.has_active_membership ? (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            Active
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={customers}
      getRowKey={(row) => row.id}
      emptyMessage="No customers found"
    />
  );
}
