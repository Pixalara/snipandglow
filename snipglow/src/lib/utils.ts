import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// =============================================================================
// Tailwind Class Merge Utility
// =============================================================================

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// =============================================================================
// Title Case (proper-noun formatting for names)
// =============================================================================

/**
 * Format a name in Title Case for a professional, consistent look across
 * customer/tenant/product/service names and addresses. Each word's first
 * letter is uppercased and the rest lowercased, so messy input like
 * "HEENA MAKWANA", "hand wax rica" or "kAdam ROAD" all become clean Title Case.
 * Collapses runs of whitespace to single spaces and trims the ends.
 *
 * Examples: "coconut oil" → "Coconut Oil", "HAND WAX RICA" → "Hand Wax Rica",
 *           "  ravi   KUMAR " → "Ravi Kumar"
 */
export function toTitleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
}

// =============================================================================
// Billing Calculation Types
// =============================================================================

/** Input for invoice total calculation */
export interface BillingCalculation {
  lineItems: { price: number; quantity: number }[];
  membershipDiscountPct: number; // 0-100
  gstRate: number; // 0-100
}

/** Output of invoice total calculation */
export interface InvoiceTotals {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  total: number;
}

// =============================================================================
// INR Currency Formatting
// =============================================================================

/**
 * Format a number as Indian Rupees using the Indian numbering system.
 * Examples: 1500 → "₹1,500", 150000 → "₹1,50,000"
 */
export function formatINR(amount: number): string {
  const isWholeNumber = Number.isInteger(amount);

  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: isWholeNumber ? 0 : 2,
  });

  return formatter.format(amount);
}

// =============================================================================
// Date and Time Formatting (IST)
// =============================================================================

/**
 * Format a date as "DD MMM YYYY" in IST (Asia/Kolkata).
 * Example: new Date('2026-04-29T10:00:00Z') → "29 Apr 2026"
 */
export function formatDateIN(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;

  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/**
 * Format time as 12-hour AM/PM in IST (Asia/Kolkata).
 * Example: new Date('2026-04-29T10:30:00Z') → "4:00 PM"
 */
export function formatTimeIST(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;

  const formatted = d.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  // Normalize am/pm to uppercase AM/PM for consistency
  return formatted.replace(/\b(am|pm)\b/i, (match) => match.toUpperCase());
}

// =============================================================================
// Indian Phone Number Validation and Formatting
// =============================================================================

/**
 * Validate a 10-digit Indian mobile number.
 * Must be exactly 10 digits, first digit must be 6-9.
 * Strips any +91 prefix or spaces before validation.
 */
export function isValidIndianPhone(phone: string): boolean {
  // Strip +91 prefix, spaces, and dashes
  const cleaned = phone.replace(/[\s\-]/g, "").replace(/^\+91/, "");
  return /^[6-9]\d{9}$/.test(cleaned);
}

/**
 * Validate a Date of Birth ISO string (YYYY-MM-DD).
 * Rules:
 *  - Must be a real calendar date (rejects e.g. 2023-02-30).
 *  - Year must be 1950 or later.
 *  - Must not be in the future (compared against today, date-only).
 */
export function isValidDateOfBirth(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [year, month, day] = iso.split("-").map(Number);
  if (year < 1950) return false;
  const date = new Date(year, month - 1, day);
  // Round-trip check to reject invalid dates (e.g. Feb 30, month 13)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return false;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) return false;
  return true;
}

/**
 * Convert a phone number to E.164 format (+91XXXXXXXXXX).
 * Strips spaces, dashes, and existing +91 prefix, then prepends +91.
 */
export function formatPhoneE164(phone: string): string {
  // Strip spaces, dashes, and existing +91 prefix
  const cleaned = phone.replace(/[\s\-]/g, "").replace(/^\+91/, "");
  return `+91${cleaned}`;
}

// =============================================================================
// Billing Calculation
// =============================================================================

/**
 * Calculate invoice totals from line items, discount, and GST.
 *
 * Logic:
 * - subtotal = Σ(price × quantity)
 * - discountAmount = round(subtotal × discountPct / 100)
 * - taxableAmount = subtotal - discountAmount
 * - gstAmount = round(taxableAmount × gstRate / 100)
 * - total = taxableAmount + gstAmount
 */
export function calculateInvoiceTotal(input: BillingCalculation): InvoiceTotals {
  const subtotal = input.lineItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const discountAmount = Math.round(
    (subtotal * input.membershipDiscountPct) / 100
  );
  const taxableAmount = subtotal - discountAmount;
  const gstAmount = Math.round((taxableAmount * input.gstRate) / 100);
  const total = taxableAmount + gstAmount;

  return { subtotal, discountAmount, taxableAmount, gstAmount, total };
}

// =============================================================================
// Per-item billing calculation
// =============================================================================

/** A single line with its own discount percentage. */
export interface PerItemBillingLine {
  price: number;
  quantity: number;
  /** Discount % for THIS line (0–100). */
  discountPct?: number;
}

export interface PerItemBillingCalculation {
  lineItems: PerItemBillingLine[];
  gstRate: number; // 0-100
}

/** Computed per-line breakdown returned alongside the totals. */
export interface PerItemLineResult {
  /** unit_price × quantity (before discount) */
  gross: number;
  /** discount % applied to this line */
  discountPct: number;
  /** rounded discount amount for this line */
  discountAmount: number;
  /** gross − discountAmount (the charged/net line total) */
  net: number;
}

export interface PerItemInvoiceTotals extends InvoiceTotals {
  /** Per-line breakdown, index-aligned with the input lineItems. */
  lines: PerItemLineResult[];
}

/**
 * Calculate invoice totals where EACH line item carries its own discount %.
 *
 * Per line:
 *   gross    = price × quantity
 *   discount = round(gross × discountPct / 100)
 *   net      = gross − discount
 *
 * Bill totals:
 *   subtotal       = Σ gross
 *   discountAmount = Σ discount
 *   taxableAmount  = subtotal − discountAmount  (= Σ net)
 *   gstAmount      = round(taxableAmount × gstRate / 100)
 *   total          = taxableAmount + gstAmount
 */
export function calculatePerItemInvoiceTotal(
  input: PerItemBillingCalculation
): PerItemInvoiceTotals {
  const lines: PerItemLineResult[] = input.lineItems.map((item) => {
    const gross = item.price * item.quantity;
    const discountPct = Math.min(100, Math.max(0, item.discountPct ?? 0));
    const discountAmount = Math.round((gross * discountPct) / 100);
    return { gross, discountPct, discountAmount, net: gross - discountAmount };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.gross, 0);
  const discountAmount = lines.reduce((sum, l) => sum + l.discountAmount, 0);
  const taxableAmount = subtotal - discountAmount;
  const gstAmount = Math.round((taxableAmount * input.gstRate) / 100);
  const total = taxableAmount + gstAmount;

  return { subtotal, discountAmount, taxableAmount, gstAmount, total, lines };
}

/** Blended discount % across the whole bill (for display / back-compat). */
export function blendedDiscountPct(subtotal: number, discountAmount: number): number {
  if (subtotal <= 0) return 0;
  return Math.round((discountAmount / subtotal) * 100);
}
