// PingFlow — Billing Utility Functions
// Indian-style formatting, status colors, and due calculations

import { format, startOfDay, differenceInDays } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';
import type { PaymentStatus } from '@/types';

// ─── Currency Formatting (Indian style) ─────────────────────────────────────

/**
 * Format a number as Indian Rupee currency
 * 1000 → "₹1,000"
 * 1180.50 → "₹1,180.50"
 */
export function formatINR(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = rounded.toLocaleString('en-IN');
  return `₹${formatted}`;
}

// ─── Date Formatting (Indian style) ─────────────────────────────────────────

/**
 * Format a date or Firestore Timestamp to Indian style
 * → "01 Apr 2025"
 */
export function formatDateIN(date: Date | Timestamp): string {
  const d = 'toDate' in date ? date.toDate() : date;
  return format(d, 'dd MMM yyyy');
}

/**
 * Format a membership period range
 * → "01 Apr 2025 – 30 Apr 2025"
 */
export function formatPeriod(start: Timestamp, end: Timestamp): string {
  return `${formatDateIN(start)} – ${formatDateIN(end)}`;
}

// ─── Status Colors ──────────────────────────────────────────────────────────

const statusColorMap: Record<PaymentStatus, { bg: string; color: string; dot: string }> = {
  paid:    { bg: 'rgba(0,208,132,0.12)',  color: '#00D084', dot: '#00D084' },
  partial: { bg: 'rgba(59,130,246,0.12)', color: '#3B82F6', dot: '#3B82F6' },
  pending: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', dot: '#F59E0B' },
  overdue: { bg: 'rgba(239,68,68,0.12)',  color: '#EF4444', dot: '#EF4444' },
};

/**
 * Get status badge colors for a payment status
 */
export function getStatusColor(status: PaymentStatus): { bg: string; color: string; dot: string } {
  return statusColorMap[status] || statusColorMap.pending;
}

// ─── Status Labels ──────────────────────────────────────────────────────────

export const statusLabels: Record<PaymentStatus, string> = {
  paid: 'PAID',
  partial: 'PARTIAL',
  pending: 'PENDING',
  overdue: 'OVERDUE',
};

// ─── Payment Mode Config ────────────────────────────────────────────────────

export const modeConfig: Record<string, { bg: string; color: string; label: string }> = {
  cash:          { bg: 'rgba(100,116,139,0.15)', color: '#94A3B8', label: 'CASH' },
  upi:           { bg: 'rgba(59,130,246,0.15)',  color: '#3B82F6', label: 'UPI' },
  card:          { bg: 'rgba(139,92,246,0.15)',  color: '#8B5CF6', label: 'CARD' },
  bank_transfer: { bg: 'rgba(245,158,11,0.15)',  color: '#F59E0B', label: 'BANK' },
  other:         { bg: 'rgba(100,116,139,0.15)', color: '#94A3B8', label: 'OTHER' },
};

// ─── Due Status Calculation ─────────────────────────────────────────────────

/**
 * Calculate the payment status based on due date and paid amounts
 */
export function calculateDueStatus(
  dueDate: Timestamp,
  paidAmount: number,
  totalAmount: number
): PaymentStatus {
  // Fully paid
  if (paidAmount >= totalAmount) {
    return 'paid';
  }

  // Partially paid
  if (paidAmount > 0 && paidAmount < totalAmount) {
    return 'partial';
  }

  // Check if overdue (unpaid and past due date)
  const today = startOfDay(new Date());
  const due = startOfDay(dueDate.toDate());
  const daysUntilDue = differenceInDays(due, today);

  if (daysUntilDue < 0) {
    return 'overdue';
  }

  return 'pending';
}
