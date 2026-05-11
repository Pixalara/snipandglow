// PingFlow — Billing Service
// Firestore operations for payments, billing settings, and stats

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
  where,
  limit,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { calculateDueStatus } from '@/utils/billing.utils';
import { getDataPathSegments } from '@/hooks/useBranch';
import type {
  Payment,
  BillingSettings,
  BillingStats,
  CreatePaymentInput,
  PaymentStatus,
  Member,
} from '@/types';

// ─── Collection helpers ─────────────────────────────────────────────────────

function paymentsCollection(_gymId: string) {
  const segs = getDataPathSegments();
  return collection(db, segs[0], segs[1], ...segs.slice(2), 'payments');
}

function paymentDoc(_gymId: string, paymentId: string) {
  const segs = getDataPathSegments();
  return doc(db, segs[0], segs[1], ...segs.slice(2), 'payments', paymentId);
}

function billingSettingsDoc(_gymId: string) {
  const segs = getDataPathSegments();
  return doc(db, segs[0], segs[1], ...segs.slice(2), 'settings', 'billing');
}

// ─── Invoice Number Generation ──────────────────────────────────────────────

/**
 * Atomically increment the invoice counter and return the next invoice number.
 * Uses a Firestore transaction for safety.
 */
async function getNextInvoiceNumber(gymId: string): Promise<string> {
  const settingsRef = billingSettingsDoc(gymId);

  const invoiceNumber = await runTransaction(db, async (transaction) => {
    const settingsSnap = await transaction.get(settingsRef);
    let prefix = 'INV';
    let counter = 1;

    if (settingsSnap.exists()) {
      const data = settingsSnap.data() as BillingSettings;
      prefix = data.invoicePrefix || 'INV';
      counter = (data.invoiceCounter || 0) + 1;
      transaction.update(settingsRef, { invoiceCounter: counter });
    } else {
      // Settings doc doesn't exist yet — create it with defaults
      transaction.set(settingsRef, {
        gymName: 'My Gym',
        gymAddress: '',
        gymPhone: '',
        hsnCode: '99972',
        gstRate: 18,
        invoicePrefix: prefix,
        invoiceCounter: counter,
        sendInvoiceOnWhatsApp: false,
      });
    }

    // Format: INV-0001
    const paddedCounter = String(counter).padStart(4, '0');
    return `${prefix}-${paddedCounter}`;
  });

  return invoiceNumber;
}

// ─── Real-time Listeners ────────────────────────────────────────────────────

/**
 * Subscribe to all payments for a gym, ordered by creation date descending
 */
export function subscribePayments(
  gymId: string,
  onData: (payments: Payment[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(paymentsCollection(gymId), orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const payments: Payment[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Payment[];
      onData(payments);
    },
    (error) => {
      console.error('Payments subscription error:', error);
      onError(error);
    }
  );
}

/**
 * Subscribe to payments for a specific member
 */
export function subscribeMemberPayments(
  gymId: string,
  memberId: string,
  onData: (payments: Payment[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(
    paymentsCollection(gymId),
    where('memberId', '==', memberId),
    orderBy('createdAt', 'desc'),
    limit(20)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const payments: Payment[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Payment[];
      onData(payments);
    },
    (error) => {
      console.error('Member payments error:', error);
      onError(error);
    }
  );
}

/**
 * Subscribe to billing settings
 */
export function subscribeBillingSettings(
  gymId: string,
  onData: (settings: BillingSettings | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    billingSettingsDoc(gymId),
    (snapshot) => {
      if (snapshot.exists()) {
        onData(snapshot.data() as BillingSettings);
      } else {
        onData(null);
      }
    },
    (error) => {
      console.error('Billing settings error:', error);
      onError(error);
    }
  );
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

/**
 * Create a new payment record with auto-generated invoice number
 */
export async function createPayment(
  gymId: string,
  input: CreatePaymentInput,
  member: Member,
  plan: { name: string; durationDays: number },
  settings: BillingSettings
): Promise<string> {
  // Generate invoice number atomically
  const invoiceNumber = await getNextInvoiceNumber(gymId);

  // Calculate GST
  const gstAmount = Math.round(input.subtotal * settings.gstRate) / 100;
  const totalAmount = input.subtotal + gstAmount;
  const balanceDue = totalAmount - input.paidAmount;

  // Calculate status
  const dueDate = Timestamp.fromDate(input.membershipEndDate);
  const status: PaymentStatus = input.paidAmount >= totalAmount
    ? 'paid'
    : input.paidAmount > 0
      ? 'partial'
      : 'pending';

  const docRef = await addDoc(paymentsCollection(gymId), {
    memberId: input.memberId,
    memberName: member.name,
    memberPhone: member.phone,
    planId: input.planId,
    planName: plan.name,
    planDurationDays: plan.durationDays,
    invoiceNumber,
    invoiceDate: serverTimestamp(),
    dueDate,
    subtotal: input.subtotal,
    gstRate: settings.gstRate,
    gstAmount,
    totalAmount,
    paidAmount: input.paidAmount,
    balanceDue,
    paymentMode: input.paymentMode,
    upiTransactionId: input.upiTransactionId || null,
    status,
    membershipStartDate: Timestamp.fromDate(input.membershipStartDate),
    membershipEndDate: Timestamp.fromDate(input.membershipEndDate),
    notes: input.notes || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Record an additional payment against an existing invoice
 */
export async function recordAdditionalPayment(
  gymId: string,
  paymentId: string,
  additionalAmount: number
): Promise<void> {
  const ref = paymentDoc(gymId, paymentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Payment not found');

  const current = snap.data() as Payment;
  const newPaidAmount = current.paidAmount + additionalAmount;
  const newBalanceDue = current.totalAmount - newPaidAmount;
  const newStatus: PaymentStatus = newPaidAmount >= current.totalAmount
    ? 'paid'
    : newPaidAmount > 0
      ? 'partial'
      : 'pending';

  await updateDoc(ref, {
    paidAmount: newPaidAmount,
    balanceDue: Math.max(0, newBalanceDue),
    status: newStatus,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update payment status (e.g., mark overdue)
 */
export async function updatePaymentStatus(
  gymId: string,
  paymentId: string,
  status: PaymentStatus
): Promise<void> {
  await updateDoc(paymentDoc(gymId, paymentId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

// ─── Billing Settings ───────────────────────────────────────────────────────

/**
 * Save or update billing settings
 */
export async function saveBillingSettings(
  gymId: string,
  settings: Partial<BillingSettings>
): Promise<void> {
  await setDoc(billingSettingsDoc(gymId), settings, { merge: true });
}

/**
 * Get billing settings (one-time read)
 */
export async function getBillingSettings(
  gymId: string
): Promise<BillingSettings | null> {
  const snap = await getDoc(billingSettingsDoc(gymId));
  if (!snap.exists()) return null;
  return snap.data() as BillingSettings;
}

/**
 * Initialize default billing settings if not exists
 */
export async function initBillingSettings(
  gymId: string,
  gymName: string,
  gymPhone: string
): Promise<BillingSettings> {
  const existing = await getBillingSettings(gymId);
  if (existing) return existing;

  const defaults: BillingSettings = {
    gymName,
    gymAddress: '',
    gymPhone,
    hsnCode: '99972',
    gstRate: 18,
    invoicePrefix: 'INV',
    invoiceCounter: 0,
    sendInvoiceOnWhatsApp: false,
  };

  await setDoc(billingSettingsDoc(gymId), defaults);
  return defaults;
}

// ─── Billing Stats ──────────────────────────────────────────────────────────

/**
 * Calculate billing stats from a list of payments
 * (computed on the client from subscribed data to avoid extra queries)
 */
export function computeBillingStats(payments: Payment[]): BillingStats {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);

  let totalCollectedThisMonth = 0;
  let totalCollectedThisYear = 0;
  let pendingDues = 0;
  let overdueCount = 0;
  let paidCountThisMonth = 0;

  for (const payment of payments) {
    const createdAt = payment.createdAt?.toDate?.() || now;

    // This month's collections
    if (createdAt >= monthStart && createdAt <= monthEnd) {
      totalCollectedThisMonth += payment.paidAmount;
      if (payment.status === 'paid') {
        paidCountThisMonth++;
      }
    }

    // This year's collections
    if (createdAt >= yearStart && createdAt <= yearEnd) {
      totalCollectedThisYear += payment.paidAmount;
    }

    // Pending dues
    if (payment.balanceDue > 0) {
      pendingDues += payment.balanceDue;
    }

    // Overdue count — recalculate dynamically
    if (payment.status !== 'paid') {
      const currentStatus = calculateDueStatus(
        payment.dueDate,
        payment.paidAmount,
        payment.totalAmount
      );
      if (currentStatus === 'overdue') {
        overdueCount++;
      }
    }
  }

  return {
    totalCollectedThisMonth,
    totalCollectedThisYear,
    pendingDues,
    overdueCount,
    paidCountThisMonth,
  };
}
