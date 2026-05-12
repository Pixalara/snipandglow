'use client';

import Link from 'next/link';
import { formatINR, formatDateIN } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import {
  Users,
  Plus,
  Crown,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      header: 'Customer',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-salon-rose/20 to-salon-gold/20 text-xs font-bold text-salon-rose">
            {row.name.charAt(0).toUpperCase()}
          </div>
          <Link
            href={`/dashboard/customers/${row.id}`}
            className="font-medium text-foreground hover:text-salon-rose transition-colors"
          >
            {row.name}
          </Link>
        </div>
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
      render: (row) => (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
          {row.total_visits}
        </span>
      ),
    },
    {
      key: 'total_spent',
      header: 'Total Spent',
      render: (row) => <span className="font-medium text-foreground">{formatINR(row.total_spent)}</span>,
    },
    {
      key: 'last_visit_at',
      header: 'Last Visit',
      render: (row) => (
        <span className="text-muted-foreground text-sm">
          {row.last_visit_at ? formatDateIN(row.last_visit_at) : '—'}
        </span>
      ),
    },
    {
      key: 'membership',
      header: 'Membership',
      render: (row) =>
        row.has_active_membership ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <Crown className="size-3" />
            Active
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
  ];

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20 mb-4">
          <Users className="size-6 text-emerald-500" />
        </div>
        <h3 className="text-base font-semibold text-foreground">No customers yet</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Start building your customer database. Add your first customer to track visits, spending, and memberships.
        </p>
        <Link href="/dashboard/customers/new">
          <Button className="mt-4 rounded-xl gap-1.5" variant="outline">
            <UserPlus className="size-4" />
            Add First Customer
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <DataTable
        columns={columns}
        data={customers}
        getRowKey={(row) => row.id}
        emptyMessage="No customers found"
      />
    </div>
  );
}
