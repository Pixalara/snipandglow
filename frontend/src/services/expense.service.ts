// PingFlow — Expense Service
// CRUD operations for gym expense tracking (Pro only)

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { ExpenseEntry, ExpenseCategory } from '@/types';

function expensesCollection(gymId: string) {
  return collection(db, 'gyms', gymId, 'expenses');
}

export function subscribeExpenses(
  gymId: string,
  onData: (expenses: ExpenseEntry[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(expensesCollection(gymId), orderBy('date', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const expenses = snap.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseEntry));
      onData(expenses);
    },
    (error) => onError(error)
  );
}

export async function createExpense(
  gymId: string,
  data: { category: ExpenseCategory; amount: number; date: Date; description?: string }
): Promise<void> {
  await addDoc(expensesCollection(gymId), {
    category: data.category,
    amount: data.amount,
    date: data.date,
    description: data.description || '',
    createdAt: serverTimestamp(),
  });
}

export async function updateExpense(
  gymId: string,
  expenseId: string,
  data: Partial<{ category: ExpenseCategory; amount: number; date: Date; description: string }>
): Promise<void> {
  await updateDoc(doc(db, 'gyms', gymId, 'expenses', expenseId), data);
}

export async function deleteExpense(gymId: string, expenseId: string): Promise<void> {
  await deleteDoc(doc(db, 'gyms', gymId, 'expenses', expenseId));
}
