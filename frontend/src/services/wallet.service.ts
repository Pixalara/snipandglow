// PingFlow — Wallet Service
// Manages wallet balance, top-ups, and deductions

import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import type { WalletTransaction } from '@/types';

const COST_PER_MESSAGE = 1.25;

function walletTransactionsCollection(gymId: string) {
  return collection(db, 'gyms', gymId, 'walletTransactions');
}

export function subscribeWalletBalance(
  gymId: string,
  onData: (balance: number) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'gyms', gymId),
    (snap) => {
      const data = snap.data();
      onData(data?.walletBalance || 0);
    },
    (error) => onError(error)
  );
}

export function subscribeWalletTransactions(
  gymId: string,
  onData: (txns: WalletTransaction[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(walletTransactionsCollection(gymId), orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snap) => {
      const txns = snap.docs.map(d => ({ id: d.id, ...d.data() } as WalletTransaction));
      onData(txns);
    },
    (error) => onError(error)
  );
}

export async function topUpWallet(gymId: string, amount: number): Promise<void> {
  const gymRef = doc(db, 'gyms', gymId);
  const snap = await getDoc(gymRef);
  const currentBalance = snap.data()?.walletBalance || 0;
  const newBalance = currentBalance + amount;

  await updateDoc(gymRef, { walletBalance: newBalance });
  await addDoc(walletTransactionsCollection(gymId), {
    type: 'topup',
    amount,
    description: `Wallet top-up ₹${amount}`,
    balanceAfter: newBalance,
    createdAt: serverTimestamp(),
  });
}

export async function deductWallet(gymId: string, amount: number, description: string): Promise<number> {
  const gymRef = doc(db, 'gyms', gymId);
  const snap = await getDoc(gymRef);
  const currentBalance = snap.data()?.walletBalance || 0;

  if (currentBalance < amount) throw new Error('Insufficient wallet balance');

  const newBalance = currentBalance - amount;
  await updateDoc(gymRef, { walletBalance: newBalance });
  await addDoc(walletTransactionsCollection(gymId), {
    type: 'debit',
    amount,
    description,
    balanceAfter: newBalance,
    createdAt: serverTimestamp(),
  });
  return newBalance;
}

export function calculateBroadcastCost(recipientCount: number): number {
  return Math.round(recipientCount * COST_PER_MESSAGE * 100) / 100;
}

export { COST_PER_MESSAGE };
