'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, type Column } from '@/components/data-table';
import { upsertPayroll, markPayrollPaid } from './actions';
import {
  BadgeDollarSign,
  Plus,
  IndianRupee,
  CheckCircle2,
  Clock,
  CreditCard,
} from 'lucide-react';
import type { Employee, UserRole } from '@/types';

// =============================================================================
// PayrollClient — Interactive client wrapper for payroll management
// =============================================================================

export interface PayrollRow {
  id: string;
  employee_id: string;
  employee_name: string;
  month: string;
  base_salary: number;
  bonus: number;
  deductions: number;
  net_salary: number;
  payment_status: string;
  paid_date: string | null;
  payment_method: string | null;
  notes: string | null;
}

interface PayrollClientProps {
  payrollRecords: PayrollRow[];
  employees: Employee[];
  currentMonth: string;
  role: UserRole;
}

export function PayrollClient({ payrollRecords, employees, currentMonth, role }: PayrollClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PayrollRow | undefined>(undefined);
  const [showPayModal, setShowPayModal] = useState<PayrollRow | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [payError, setPayError] = useState('');
  const [isPaying, setIsPaying] = useState(false);

  // Filter records by selected month
  const filteredRecords = useMemo(() => {
    return payrollRecords.filter((r) => r.month === selectedMonth);
  }, [payrollRecords, selectedMonth]);

  // Summary stats
  const totalPayroll = filteredRecords.reduce((sum, r) => sum + Number(r.net_salary), 0);
  const paidCount = filteredRecords.filter((r) => r.payment_status === 'paid').length;
  const pendingCount = filteredRecords.filter((r) => r.payment_status === 'pending').length;

  function handleEdit(record: PayrollRow) {
    setEditingRecord(record);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingRecord(undefined);
  }

  async function handleMarkPaid(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!showPayModal) return;
    setIsPaying(true);
    setPayError('');

    const formData = new FormData(e.currentTarget);
    const payment_method = formData.get('payment_method') as string;
    const paid_date = formData.get('paid_date') as string;

    const result = await markPayrollPaid({
      payroll_id: showPayModal.id,
      payment_method,
      paid_date,
    });

    setIsPaying(false);
    if (!result.success) {
      setPayError(result.error);
      return;
    }
    setShowPayModal(null);
  }

  const columns: Column<PayrollRow>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-salon-rose/20 to-salon-gold/20 text-xs font-bold text-salon-rose">
            {row.employee_name.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-foreground">{row.employee_name}</span>
        </div>
      ),
    },
    {
      key: 'base_salary',
      header: 'Base Salary',
      render: (row) => (
        <div className="flex items-center gap-1 text-muted-foreground">
          <IndianRupee className="size-3" />
          {Number(row.base_salary).toLocaleString('en-IN')}
        </div>
      ),
    },
    {
      key: 'bonus',
      header: 'Bonus',
      render: (row) => (
        <span className={Number(row.bonus) > 0 ? 'text-emerald-600 font-medium' : 'text-muted-foreground'}>
          {Number(row.bonus) > 0 ? `+₹${Number(row.bonus).toLocaleString('en-IN')}` : '—'}
        </span>
      ),
    },
    {
      key: 'deductions',
      header: 'Deductions',
      render: (row) => (
        <span className={Number(row.deductions) > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
          {Number(row.deductions) > 0 ? `-₹${Number(row.deductions).toLocaleString('en-IN')}` : '—'}
        </span>
      ),
    },
    {
      key: 'net_salary',
      header: 'Net Salary',
      render: (row) => (
        <div className="flex items-center gap-1 font-semibold text-foreground">
          <IndianRupee className="size-3.5" />
          {Number(row.net_salary).toLocaleString('en-IN')}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            row.payment_status === 'paid'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
          }`}
        >
          {row.payment_status === 'paid' ? (
            <CheckCircle2 className="size-3" />
          ) : (
            <Clock className="size-3" />
          )}
          {row.payment_status === 'paid' ? 'Paid' : 'Pending'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex items-center gap-1">
          {row.payment_status === 'pending' && (
            <>
              <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={() => handleEdit(row)}>
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-lg text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                onClick={() => { setShowPayModal(row); setPayError(''); }}
              >
                <CreditCard className="size-3.5 mr-1" />
                Pay
              </Button>
            </>
          )}
          {row.payment_status === 'paid' && row.paid_date && (
            <span className="text-xs text-muted-foreground">
              {new Date(row.paid_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border border-green-200/50 dark:border-green-800/30 p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
              <BadgeDollarSign className="size-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Payroll</h1>
              <p className="text-sm text-muted-foreground">
                {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} for {selectedMonth}
              </p>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)} className="rounded-xl gap-1.5">
            <Plus className="size-4" />
            Add Salary
          </Button>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-green-500/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-green-400/5" />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
          <p className="text-xs font-medium text-muted-foreground">Total Payroll</p>
          <div className="flex items-center gap-1 mt-1">
            <IndianRupee className="size-4 text-green-600" />
            <span className="text-2xl font-bold text-foreground">{totalPayroll.toLocaleString('en-IN')}</span>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
          <p className="text-xs font-medium text-muted-foreground">Paid</p>
          <span className="text-2xl font-bold text-emerald-600 mt-1 block">{paidCount}</span>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 hover:shadow-md hover:-translate-y-0.5 transition-all">
          <p className="text-xs font-medium text-muted-foreground">Pending</p>
          <span className="text-2xl font-bold text-amber-600 mt-1 block">{pendingCount}</span>
        </div>
      </div>

      {/* Month Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
        <Label htmlFor="month-select" className="text-sm font-medium">Month:</Label>
        <Input
          id="month-select"
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-full sm:w-auto rounded-lg"
        />
      </div>

      {/* Payroll Table */}
      {filteredRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-green-50 dark:bg-green-900/20 mb-4">
            <BadgeDollarSign className="size-6 text-green-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No payroll records</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            No salary records for {selectedMonth}. Add salary entries for your employees.
          </p>
          <Button onClick={() => setShowForm(true)} className="mt-4 rounded-xl gap-1.5" variant="outline">
            <Plus className="size-4" />
            Add Salary Entry
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <DataTable
            columns={columns}
            data={filteredRecords}
            getRowKey={(row) => row.id}
            emptyMessage="No payroll records found."
          />
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <Modal onClose={handleCloseForm}>
          <PayrollForm
            record={editingRecord}
            employees={employees}
            currentMonth={selectedMonth}
            onClose={handleCloseForm}
          />
        </Modal>
      )}

      {/* Mark as Paid Modal */}
      {showPayModal && (
        <Modal onClose={() => setShowPayModal(null)}>
          <form onSubmit={handleMarkPaid} className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Mark as Paid</h2>
            <p className="text-sm text-muted-foreground">
              Pay <span className="font-medium text-foreground">{showPayModal.employee_name}</span>{' '}
              — ₹{Number(showPayModal.net_salary).toLocaleString('en-IN')}
            </p>

            {payError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
                <p className="text-sm text-red-800 dark:text-red-200">{payError}</p>
              </div>
            )}

            <div>
              <Label htmlFor="pay_method">Payment Method</Label>
              <select
                id="pay_method"
                name="payment_method"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                required
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
              </select>
            </div>

            <div>
              <Label htmlFor="paid_date">Payment Date</Label>
              <Input
                id="paid_date"
                name="paid_date"
                type="date"
                defaultValue={new Date().toISOString().split('T')[0]}
                required
                className="mt-1"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setShowPayModal(null)} disabled={isPaying}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={isPaying}>
                {isPaying ? 'Processing...' : 'Confirm Payment'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// =============================================================================
// PayrollForm — Add/Edit payroll form
// =============================================================================

interface PayrollFormProps {
  record?: PayrollRow;
  employees: Employee[];
  currentMonth: string;
  onClose: () => void;
}

function PayrollForm({ record, employees, currentMonth, onClose }: PayrollFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!record;
  const activeEmployees = employees.filter((e) => e.is_active);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const employee_id = formData.get('employee_id') as string;
    const month = formData.get('month') as string;
    const base_salary = parseFloat(formData.get('base_salary') as string) || 0;
    const bonus = parseFloat(formData.get('bonus') as string) || 0;
    const deductions = parseFloat(formData.get('deductions') as string) || 0;
    const notes = formData.get('notes') as string;

    const result = await upsertPayroll({
      employee_id,
      month,
      base_salary,
      bonus,
      deductions,
      notes: notes || undefined,
    });

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
        {isEditing ? 'Edit Salary' : 'Add Salary Entry'}
      </h2>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <Label htmlFor="employee_id">Employee</Label>
          <select
            id="employee_id"
            name="employee_id"
            defaultValue={record?.employee_id ?? ''}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
            disabled={isEditing}
          >
            <option value="">Select employee...</option>
            {activeEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="month">Month</Label>
          <Input
            id="month"
            name="month"
            type="month"
            defaultValue={record?.month ?? currentMonth}
            required
            className="mt-1"
            disabled={isEditing}
          />
        </div>

        <div>
          <Label htmlFor="base_salary">Base Salary (₹)</Label>
          <Input
            id="base_salary"
            name="base_salary"
            type="number"
            step="0.01"
            min="0"
            defaultValue={record?.base_salary ?? ''}
            placeholder="0.00"
            required
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="bonus">Bonus (₹)</Label>
            <Input
              id="bonus"
              name="bonus"
              type="number"
              step="0.01"
              min="0"
              defaultValue={record?.bonus ?? '0'}
              placeholder="0.00"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="deductions">Deductions (₹)</Label>
            <Input
              id="deductions"
              name="deductions"
              type="number"
              step="0.01"
              min="0"
              defaultValue={record?.deductions ?? '0'}
              placeholder="0.00"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input
            id="notes"
            name="notes"
            defaultValue={record?.notes ?? ''}
            placeholder="Any additional notes"
            className="mt-1"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" className="rounded-xl" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Salary' : 'Add Salary'}
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
