// PingFlow — Expenses Page (Pro Only)
// Track gym expenses by category with monthly filtering

import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import PlanGuard from '@/components/ui/PlanGuard';
import Modal from '@/components/ui/Modal';
import { PrimaryButton, GhostButton } from '@/components/ui/ModalButtons';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import {
  subscribeExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from '@/services/expense.service';
import type { ExpenseEntry, ExpenseCategory } from '@/types';

const CATEGORIES: ExpenseCategory[] = ['Rent', 'Salary', 'Utilities', 'Equipment', 'Repair & Maintenance', 'Other'];

const categoryConfig: Record<ExpenseCategory, { emoji: string; bg: string; color: string }> = {
  Rent:       { emoji: '🏠', bg: '#FFF7ED', color: '#EA580C' },
  Salary:     { emoji: '💰', bg: '#ECFDF5', color: '#059669' },
  Utilities:  { emoji: '⚡', bg: '#EFF6FF', color: '#2563EB' },
  Equipment:  { emoji: '🏋️', bg: '#F5F3FF', color: '#7C3AED' },
  'Repair & Maintenance': { emoji: '🔧', bg: '#FFF7ED', color: '#EA580C' },
  Other:      { emoji: '📋', bg: '#F1F5F9', color: '#475569' },
};

function getMonthOptions() {
  const options: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    options.push({ label, value });
  }
  return options;
}

function ExpensesContent() {
  const { user } = useAuthStore();
  const { isMobile } = useResponsive();
  const gymId = user?.uid;

  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<ExpenseEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Month picker — default to current month
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const monthOptions = useMemo(() => getMonthOptions(), []);

  // Form state
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('Other');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDescription, setFormDescription] = useState('');

  useEffect(() => {
    if (!gymId) return;
    setIsLoading(true);
    const unsub = subscribeExpenses(
      gymId,
      (data) => { setExpenses(data); setIsLoading(false); },
      (err) => { console.error(err); setIsLoading(false); }
    );
    return unsub;
  }, [gymId]);

  // Filter expenses by selected month
  const filteredExpenses = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return expenses.filter((e) => {
      const d = e.date?.toDate ? e.date.toDate() : new Date(e.date as any);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }, [expenses, selectedMonth]);

  // Monthly total
  const monthlyTotal = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
    [filteredExpenses]
  );

  const openCreateModal = () => {
    setEditingExpense(null);
    setFormCategory('Other');
    setFormAmount('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (expense: ExpenseEntry) => {
    setEditingExpense(expense);
    setFormCategory(expense.category);
    setFormAmount(String(expense.amount));
    const d = expense.date?.toDate ? expense.date.toDate() : new Date(expense.date as any);
    setFormDate(d.toISOString().split('T')[0]);
    setFormDescription(expense.description || '');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!gymId) return;
    const amount = parseFloat(formAmount);
    if (!formCategory || isNaN(amount) || amount <= 0 || !formDate) {
      toast('Please fill all required fields', 'error');
      return;
    }
    setIsSaving(true);
    try {
      if (editingExpense?.id) {
        await updateExpense(gymId, editingExpense.id, {
          category: formCategory,
          amount,
          date: new Date(formDate),
          description: formDescription.trim(),
        });
        toast('Expense updated', 'success');
      } else {
        await createExpense(gymId, {
          category: formCategory,
          amount,
          date: new Date(formDate),
          description: formDescription.trim(),
        });
        toast('Expense added', 'success');
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      toast('Failed to save expense', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!gymId || !deletingExpense?.id) return;
    setIsDeleting(true);
    try {
      await deleteExpense(gymId, deletingExpense.id);
      toast('Expense deleted', 'success');
      setDeletingExpense(null);
    } catch (err) {
      console.error(err);
      toast('Failed to delete expense', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', height: '46px', padding: '0 16px', borderRadius: '12px',
    border: '1px solid #E2E8F0', backgroundColor: '#FFF', color: '#0F172A',
    fontSize: '14px', fontFamily: "'Inter', sans-serif", outline: 'none',
    boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: '800', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px',
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '28px',
      }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Expenses
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '500' }}>
            Track and manage your gym's monthly expenses
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="btn-press"
          style={{
            width: isMobile ? '100%' : 'auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            background: 'linear-gradient(135deg, #E11D48, #BE123C)', border: 'none', borderRadius: '12px',
            padding: '12px 24px', cursor: 'pointer', fontSize: '14px', fontWeight: '800', color: '#FFFFFF',
            boxShadow: '0 4px 14px rgba(225,29,72,0.3)', transition: 'all 200ms',
          }}
        >
          + Add Expense
        </button>
      </div>

      {/* Monthly total + month picker */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: '16px',
        marginBottom: '24px',
      }}>
        {/* Monthly total card */}
        <div style={{
          flex: 1,
          background: 'linear-gradient(135deg, #FFF1F2, #FFFFFF)',
          border: '1px solid #FECDD3',
          borderRadius: '16px',
          padding: '20px 24px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>
            Monthly Total
          </p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '32px', fontWeight: '800', color: '#E11D48', margin: 0 }}>
            ₹{monthlyTotal.toLocaleString('en-IN')}
          </p>
        </div>

        {/* Month picker */}
        <div style={{ minWidth: isMobile ? '100%' : '220px' }}>
          <label style={labelStyle}>Select Month</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer', appearance: 'none', background: '#FFF url("data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E") no-repeat right 14px center' }}
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Expense list */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {isLoading ? (
          <div style={{ padding: '16px' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton" style={{ height: '56px', marginBottom: '8px', borderRadius: '8px' }} />
            ))}
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div style={{ padding: '80px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💸</div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: '0 0 6px' }}>
              No expenses this month
            </p>
            <p style={{ fontSize: '14px', color: '#64748B', maxWidth: '340px', margin: '0 auto' }}>
              Add your first expense to start tracking monthly spending.
            </p>
          </div>
        ) : (
          filteredExpenses.map((expense, i) => {
            const cfg = categoryConfig[expense.category] || categoryConfig.Other;
            const d = expense.date?.toDate ? expense.date.toDate() : new Date(expense.date as any);
            return (
              <div
                key={expense.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom: i < filteredExpenses.length - 1 ? '1px solid #F1F5F9' : 'none',
                  transition: 'background-color 150ms',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '12px',
                    backgroundColor: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', flexShrink: 0,
                  }}>
                    {cfg.emoji}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <p style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', margin: 0 }}>
                        {expense.category}
                      </p>
                      <span style={{
                        fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px',
                        backgroundColor: cfg.bg, color: cfg.color,
                      }}>
                        {d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    {expense.description && (
                      <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {expense.description}
                      </p>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <p style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                    ₹{expense.amount.toLocaleString('en-IN')}
                  </p>
                  <button
                    onClick={() => openEditModal(expense)}
                    style={{
                      width: '34px', height: '34px', borderRadius: '10px', border: '1px solid #E2E8F0',
                      backgroundColor: '#FFF', color: '#64748B', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#E11D48'; e.currentTarget.style.color = '#E11D48'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeletingExpense(expense)}
                    style={{
                      width: '34px', height: '34px', borderRadius: '10px', border: '1px solid #E2E8F0',
                      backgroundColor: '#FFF', color: '#64748B', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#EF4444'; e.currentTarget.style.color = '#EF4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExpense ? 'Edit Expense' : 'Add Expense'}
        subtitle="Record a gym expense entry"
        footer={
          <>
            <GhostButton onClick={() => setIsModalOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={handleSave} loading={isSaving}>
              {editingExpense ? 'Update' : 'Add Expense'}
            </PrimaryButton>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Category *</label>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
              style={{ ...inputStyle, cursor: 'pointer', appearance: 'none', background: '#FFF url("data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E") no-repeat right 14px center' }}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{categoryConfig[cat].emoji} {cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Amount (₹) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              style={inputStyle}
              placeholder="e.g. 15000"
            />
          </div>
          <div>
            <label style={labelStyle}>Date *</label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Description (optional)</label>
            <input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              style={inputStyle}
              placeholder="e.g. Monthly rent payment"
            />
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deletingExpense}
        onClose={() => setDeletingExpense(null)}
        onConfirm={handleDelete}
        title="Delete Expense"
        message={`Are you sure you want to delete this ${deletingExpense?.category} expense of ₹${deletingExpense?.amount?.toLocaleString('en-IN')}?`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <PlanGuard feature="expenses">
      <ExpensesContent />
    </PlanGuard>
  );
}
