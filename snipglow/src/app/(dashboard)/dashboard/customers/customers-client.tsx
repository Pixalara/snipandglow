'use client';

import { useState, useTransition, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatINR, formatDateIN } from '@/lib/utils';
import { DataTable, type Column } from '@/components/data-table';
import {
  Users,
  Crown,
  UserPlus,
  Pencil,
  X,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateCustomer, getAvailableMemberships, getCustomerMembership, assignCustomerMembership } from './actions';
import type { Customer, Membership } from '@/types';

/** Customer row with optional active membership info (serialized-safe) */
export interface CustomerRow extends Customer {
  has_active_membership: boolean;
}

interface CustomersTableProps {
  customers: CustomerRow[];
}

export function CustomersTable({ customers }: CustomersTableProps) {
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);

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
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <button
          onClick={() => setEditingCustomer(row)}
          className="inline-flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Edit customer"
        >
          <Pencil className="size-4" />
        </button>
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
    <>
      <div className="rounded-xl border border-border overflow-hidden">
        <DataTable
          columns={columns}
          data={customers}
          getRowKey={(row) => row.id}
          emptyMessage="No customers found"
        />
      </div>

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <EditCustomerModal
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
        />
      )}
    </>
  );
}

// =============================================================================
// Edit Customer Modal (with Membership Assignment)
// =============================================================================

function EditCustomerModal({
  customer,
  onClose,
}: {
  customer: CustomerRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone.replace('+91', ''));
  const [email, setEmail] = useState(customer.email ?? '');
  const [gender, setGender] = useState(customer.gender ?? '');
  const [notes, setNotes] = useState(customer.notes ?? '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Membership state
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentMembershipId, setCurrentMembershipId] = useState<string>('');
  const [selectedMembershipId, setSelectedMembershipId] = useState<string>('');
  const [loadingMemberships, setLoadingMemberships] = useState(true);

  // Load memberships and current customer membership on mount
  useEffect(() => {
    async function load() {
      setLoadingMemberships(true);
      const [plans, current] = await Promise.all([
        getAvailableMemberships(),
        getCustomerMembership(customer.id),
      ]);
      setMemberships(plans);
      const currentId = current?.membershipId ?? '';
      setCurrentMembershipId(currentId);
      setSelectedMembershipId(currentId);
      setLoadingMemberships(false);
    }
    load();
  }, [customer.id]);

  function handleSave() {
    if (!name.trim() || !phone.trim()) {
      setError('Name and phone are required.');
      return;
    }

    setError('');
    setSuccess(false);

    startTransition(async () => {
      // Update customer info
      const result = await updateCustomer(customer.id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        gender: gender || null,
        notes: notes.trim() || null,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Update membership if changed
      if (selectedMembershipId !== currentMembershipId) {
        const membershipResult = await assignCustomerMembership(
          customer.id,
          selectedMembershipId || null
        );
        if (!membershipResult.success) {
          setError(membershipResult.error);
          return;
        }
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        router.refresh();
      }, 800);
    });
  }

  const selectedMembership = memberships.find((m) => m.id === selectedMembershipId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <Pencil className="size-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-foreground">Edit Customer</h2>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
              <AlertTriangle className="size-4 text-red-600 shrink-0" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-900/20">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <p className="text-sm text-emerald-800 dark:text-emerald-200">Customer updated!</p>
            </div>
          )}

          {/* Customer Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Phone *</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit number"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="h-9 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any preferences or notes..."
              rows={2}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {/* Membership Assignment */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-amber-500" />
              <label className="text-sm font-medium text-foreground">Membership</label>
            </div>

            {loadingMemberships ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                Loading memberships...
              </div>
            ) : memberships.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No membership plans available. Create plans in the Memberships section first.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {/* No membership option */}
                <button
                  type="button"
                  onClick={() => setSelectedMembershipId('')}
                  className={`relative rounded-xl border p-3 text-left transition-all hover:shadow-sm ${
                    selectedMembershipId === ''
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-border/80'
                  }`}
                >
                  <p className="text-sm font-medium text-foreground">No Membership</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Remove membership</p>
                </button>

                {memberships.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMembershipId(m.id)}
                    className={`relative rounded-xl border p-3 text-left transition-all hover:shadow-sm ${
                      selectedMembershipId === m.id
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10 ring-2 ring-amber-500/20'
                        : 'border-border hover:border-amber-200 dark:hover:border-amber-800/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="size-3 text-amber-500 shrink-0" />
                          <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-muted-foreground">
                            ₹{m.price.toLocaleString('en-IN')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {m.validity_days}d
                          </span>
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                            {m.discount_pct}% off
                          </span>
                        </div>
                      </div>
                      {selectedMembershipId === m.id && (
                        <div className="flex size-5 items-center justify-center rounded-full bg-amber-500 text-white shrink-0">
                          <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Show discount info if membership selected */}
            {selectedMembership && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Crown className="size-3.5 text-amber-600 dark:text-amber-400" />
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    <span className="font-medium">{selectedMembership.discount_pct}% discount</span> will be auto-applied on all bills for this customer
                  </p>
                </div>
              </div>
            )}

            {/* Show change indicator */}
            {selectedMembershipId !== currentMembershipId && (
              <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-blue-500" />
                Membership will be updated on save
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4 bg-muted/20">
          <Button variant="outline" className="rounded-xl" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button className="rounded-xl" onClick={handleSave} disabled={isPending}>
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
