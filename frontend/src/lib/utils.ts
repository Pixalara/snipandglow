// PingFlow — Utility functions

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format Indian phone number to E.164 format
 * Accepts: 9876543210, 09876543210, +919876543210
 */
export function formatPhoneE164(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return `+91${cleaned}`;
  if (cleaned.length === 12 && cleaned.startsWith('91')) return `+${cleaned}`;
  if (cleaned.length === 11 && cleaned.startsWith('0')) return `+91${cleaned.slice(1)}`;
  return `+${cleaned}`;
}

/**
 * Masks a phone number showing only first 2 and last 2 digits.
 * E.g., "+919876543210" → "98******10", "9876543210" → "98******10"
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Strip country code if present (91 prefix for 12-digit numbers)
  const local = digits.length === 12 && digits.startsWith('91')
    ? digits.slice(2)
    : digits;
  if (local.length < 4) return local;
  const first2 = local.slice(0, 2);
  const last2 = local.slice(-2);
  const masked = '*'.repeat(local.length - 4);
  return `${first2}${masked}${last2}`;
}

/**
 * Validate Indian phone number (10 digits)
 */
export function isValidIndianPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) return /^[6-9]\d{9}$/.test(cleaned);
  if (cleaned.length === 12 && cleaned.startsWith('91')) return /^91[6-9]\d{9}$/.test(cleaned);
  return false;
}
