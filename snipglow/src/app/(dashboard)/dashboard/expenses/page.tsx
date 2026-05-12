import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ExpensesClient, type ExpenseRow } from './expenses-client';
import { Wallet } from 'lucide-react';
import type { UserRole, ExpenseCategory, ExpensePaymentMethod } from '@/types';

// =============================================================================
// Expenses Page — Server Component
// =============================================================================

export default async function ExpensesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // Only owners and managers can access expenses
  if (role !== 'owner' && role !== 'manager') {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-destructive">Access denied. Only owners and managers can view expenses.</p>
      </div>
    );
  }

  // Fetch expenses (RLS enforces tenant scoping)
  const { data: expenses, error } = await (supabase as any)
    .from('expenses')
    .select('id, category, description, amount, expense_date, payment_method, receipt_note, created_at')
    .order('expense_date', { ascending: false });

  if (error) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent border border-orange-200/50 dark:border-orange-800/30 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
              <Wallet className="size-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Expenses</h1>
              <p className="text-sm text-destructive">Failed to load expenses</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const rows: ExpenseRow[] = (expenses ?? []).map((exp: any) => ({
    id: exp.id,
    category: exp.category as ExpenseCategory,
    description: exp.description,
    amount: exp.amount,
    expense_date: exp.expense_date,
    payment_method: (exp.payment_method ?? 'cash') as ExpensePaymentMethod,
    receipt_note: exp.receipt_note,
    created_at: exp.created_at ?? '',
  }));

  return <ExpensesClient expenses={rows} role={role} />;
}
