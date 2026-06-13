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
 * Capitalize the first letter of each word for a professional, consistent look
 * across customer/tenant/product/service names. Only the FIRST letter of each
 * word is uppercased — the rest is left as typed, so acronyms and brand casing
 * (e.g. "JK Salon", "L'Oreal", "iD") are preserved rather than mangled.
 * Collapses runs of whitespace to single spaces and trims the ends.
 *
 * Examples: "coconut oil" → "Coconut Oil", "jk salon" → "Jk Salon",
 *           "JK SALON" → "JK SALON", "  ravi   kumar " → "Ravi Kumar"
 */
export function toTitleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
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
