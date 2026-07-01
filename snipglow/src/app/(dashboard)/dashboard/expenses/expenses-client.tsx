'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type Column } from '@/components/data-table';
import { ExportButton } from '@/components/export-button';
import { RoleGuard } from '@/components/role-guard';
import { createExpense, updateExpense, deleteExpense } from './actions';
import {
  Wallet,
  Plus,
  Pencil,
  Trash2,
  IndianRupee,
  Calendar,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import type { Expense, ExpenseCategory, ExpensePaymentMethod, UserRole } from '@/types';

// =============================================================================
// ExpensesClient — Interactive client wrapper for expense tracking
// =============================================================================

export interface ExpenseRow {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date: string;
  payment_method: ExpensePaymentMethod;
  receipt_note: string | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: 'Rent',
  supplies: 'Supplies',
  utilities: 'Utilities',
  marketing: 'Marketing',
  maintenance: 'Maintenance',
  other: 'Other',
};

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  rent: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  supplies: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  utilities: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  marketing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  maintenance: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const PAYMENT_LABELS: Record<ExpensePaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
};

interface ExpensesClientProps {
  expenses: ExpenseRow[];
  role: UserRole;
}

export function ExpensesClient({ expenses, role }: ExpensesClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('');

  // Filter expenses by category + (optional) month.
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (filterCategory !== 'all' && e.category !== filterCategory) return false;
      if (filterMonth && !e.expense_date.startsWith(filterMonth)) return false;
      return true;
    });
  }, [expenses, filterCategory, filterMonth]);

  // Summary card reflects the selected month (defaults to the current month).
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const summaryMonth = filterMonth || currentMonth;
  const monthlyTotal = useMemo(() => {
    return expenses
      .filter((e) => e.expense_date.startsWith(summaryMonth))
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [expenses, summaryMonth]);
  const summaryMonthLabel = new Date(`${summaryMonth}-01T12:00:00+05:30`).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });

  function handleEdit(expense: ExpenseRow) {
    setEditingExpense(expense);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingExpense(undefined);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError('');

    const result = await deleteExpense(deleteTarget.id);
    setIsDeleting(false);

    if (!result.success) {
      setDeleteError(result.error);
      return;
    }
    setDeleteTarget(null);
  }

  const columns: Column<ExpenseRow>[] = [
    {
      key: 'description',
      header: 'Description',
      render: (row) => (
        <div>
          <span className="font-medium text-foreground">{row.description}</span>
          {row.receipt_note && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{row.receipt_note}</p>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[row.category]}`}>
          {CATEGORY_LABELS[row.category]}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => (
        <div className="flex items-center gap-1 font-semibold text-foreground">
          <IndianRupee className="size-3.5" />
          {Number(row.amount).toLocaleString('en-IN')}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (row) => (
        <span className="text-muted-foreground text-sm">
          {new Date(row.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      ),
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (row) => (
        <span className="text-muted-foreground text-sm capitalize">
          {PAYMENT_LABELS[row.payment_method]}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          <RoleGuard role={role} action="update" resource="expenses">
            <Button variant="ghost" size="sm" className="rounded-lg h-8 w-8 p-0" onClick={() => handleEdit(row)}>
              <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
            </Button>
          </RoleGuard>
          <RoleGuard role={role} action="delete" resource="expenses">
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent border border-orange-200/50 dark:border-orange-800/30 p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
              <Wallet className="size-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Expenses</h1>
              <p className="text-sm text-muted-foreground">
                {expenses.length} expense{expenses.length !== 1 ? 's' : ''} tracked
              </p>
            </div>
          </div>
          <RoleGuard role={role} action="create" resource="expenses">
            <Button onClick={() => setShowForm(true)} className="rounded-xl gap-1.5">
              <Plus className="size-4" />
              Add Expense
            </Button>
          </RoleGuard>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-orange-500/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-orange-400/5" />
      </div>

      {/* Monthly Summary */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
          <p className="text-xs font-medium text-muted-foreground">{filterMonth ? `${summaryMonthLabel} Total` : "This Month's Total"}</p>
          <div className="flex items-center gap-1 mt-1">
            <IndianRupee className="size-4 text-orange-600" />
            <span className="text-2xl font-bold text-foreground">{monthlyTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
          <p className="text-xs font-medium text-muted-foreground">Total Expenses</p>
          <div className="flex items-center gap-1 mt-1">
            <IndianRupee className="size-4 text-muted-foreground" />
            <span className="text-2xl font-bold text-foreground">
              {expenses.reduce((sum, e) => sum + Number(e.amount), 0).toLocaleString('en-IN')}
            </span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
          <p className="text-xs font-medium text-muted-foreground">Entries</p>
          <span className="text-2xl font-bold text-foreground mt-1 block">{expenses.length}</span>
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Filter className="size-4 text-muted-foreground hidden sm:block" />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="w-full sm:w-auto rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <input
            type="month"
            value={filterMonth}
            max={currentMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            aria-label="Filter expenses by month"
            className="w-full sm:w-auto rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
          {filterMonth && (
            <button
              type="button"
              onClick={() => setFilterMonth('')}
              className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <div className="sm:ml-auto w-full sm:w-auto">
          <ExportButton
            filename="expenses"
            label="Export to Excel"
            rows={filteredExpenses}
            columns={[
              { header: 'Date', value: (r) => r.expense_date },
              { header: 'Category', value: (r) => CATEGORY_LABELS[r.category] ?? r.category },
              { header: 'Description', value: (r) => r.description },
              { header: 'Amount (INR)', value: (r) => r.amount },
              { header: 'Payment Method', value: (r) => PAYMENT_LABELS[r.payment_method] ?? r.payment_method },
              { header: 'Note', value: (r) => r.receipt_note ?? '' },
            ]}
          />
        </div>
      </div>

      {/* Expenses Table */}
      {filteredExpenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-900/20 mb-4">
            <Calendar className="size-6 text-orange-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No expenses found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {filterCategory !== 'all' || filterMonth
              ? 'No expenses match the current filters. Try a different category or month.'
              : 'Start tracking your salon expenses to get insights into your spending.'}
          </p>
          {filterCategory === 'all' && !filterMonth && (
            <RoleGuard role={role} action="create" resource="expenses">
              <Button onClick={() => setShowForm(true)} className="mt-4 rounded-xl gap-1.5" variant="outline">
                <Plus className="size-4" />
                Add First Expense
              </Button>
            </RoleGuard>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <DataTable
            columns={columns}
            data={filteredExpenses}
            getRowKey={(row) => row.id}
            emptyMessage="No expenses found."
          />
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <Modal onClose={handleCloseForm}>
          <ExpenseForm expense={editingExpense} onClose={handleCloseForm} />
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
              <h2 className="text-lg font-semibold text-foreground">Delete Expense</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the expense{' '}
              <span className="font-medium text-foreground">&quot;{deleteTarget.description}&quot;</span>?
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
    </div>
  );
}

// =============================================================================
// ExpenseForm — Add/Edit expense form
// =============================================================================

interface ExpenseFormProps {
  expense?: ExpenseRow;
  onClose: () => void;
}

function ExpenseForm({ expense, onClose }: ExpenseFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!expense;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const category = formData.get('category') as ExpenseCategory;
    const description = formData.get('description') as string;
    const amount = parseFloat(formData.get('amount') as string);
    const expense_date = formData.get('expense_date') as string;
    const payment_method = formData.get('payment_method') as ExpensePaymentMethod;
    const receipt_note = formData.get('receipt_note') as string;

    let result;
    if (isEditing) {
      result = await updateExpense(expense.id, {
        category,
        description,
        amount,
        expense_date,
        payment_method,
        receipt_note: receipt_note || null,
      });
    } else {
      result = await createExpense({
        category,
        description,
        amount,
        expense_date,
        payment_method,
        receipt_note: receipt_note || undefined,
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
        {isEditing ? 'Edit Expense' : 'Add Expense'}
      </h2>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            name="category"
            defaultValue={expense?.category ?? 'supplies'}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          >
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            name="description"
            defaultValue={expense?.description ?? ''}
            placeholder="e.g., Monthly rent payment"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="amount">Amount (₹)</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={expense?.amount ?? ''}
            placeholder="0.00"
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="expense_date">Date</Label>
          <Input
            id="expense_date"
            name="expense_date"
            type="date"
            defaultValue={expense?.expense_date ?? new Date().toISOString().split('T')[0]}
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="payment_method">Payment Method</Label>
          <select
            id="payment_method"
            name="payment_method"
            defaultValue={expense?.payment_method ?? 'cash'}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {Object.entries(PAYMENT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="receipt_note">Note (optional)</Label>
          <Input
            id="receipt_note"
            name="receipt_note"
            defaultValue={expense?.receipt_note ?? ''}
            placeholder="Receipt number or additional notes"
            className="mt-1"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" className="rounded-xl" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Expense' : 'Add Expense'}
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
