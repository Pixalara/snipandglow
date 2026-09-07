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
 * Reduce an all-digits string (no leading +) to a validated E.164 number, or
 * null. E.164 allows at most 15 digits including the country code, and a country
 * code never begins with 0, so both are rejected here.
 */
function digitsToE164(digits: string): string | null {
  if (digits.length < 8 || digits.length > 15) return null;
  if (digits.startsWith("0")) return null;
  return `+${digits}`;
}

/**
 * Canonicalise any phone number to E.164 (`+<countrycode><number>`), or return
 * null when it can't be understood.
 *
 * India-first, so nothing about the existing Indian customer base changes: a
 * bare 10-digit mobile (starting 6-9) is still read as Indian and stored as
 * +91XXXXXXXXXX, exactly as before.
 *
 * An international number is accepted only when it carries a country code — a
 * leading `+` or the `00` international prefix. That restriction is deliberate:
 * a bare foreign number cannot be told apart from a mistyped Indian one, and
 * guessing a country code onto it would corrupt the record and, because phone is
 * the customer's identity, silently split their visit history and wallet across
 * two rows. The customer form tells users to include the code for this reason.
 *
 * Producing the SAME canonical string the WhatsApp webhook stores (it uses the
 * inbound number's real country code) is what keeps dashboard-created and
 * WhatsApp-created records deduping to one customer.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith("+");
  const hasIntlPrefix = trimmed.startsWith("00");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  // Already international — trust the country code the user supplied.
  if (hasPlus) return digitsToE164(digits);
  if (hasIntlPrefix) return digitsToE164(digits.slice(2));

  // India, typed with the 91 country code but no plus. Unambiguous (12 digits
  // led by India's code) and matches the string the WhatsApp webhook stores.
  if (digits.length === 12 && digits.startsWith("91")) return digitsToE164(digits);

  // India, bare 10-digit mobile — unchanged from the original behaviour.
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }

  // A bare number we cannot confidently place. Refuse rather than guess — a
  // leading-0 number in particular is ambiguous (Indian trunk prefix vs. a
  // foreign domestic number), and the original validator rejected it too.
  return null;
}

/**
 * True when a phone number can be understood: a valid Indian mobile, or an
 * international number that carries a country code. See normalizePhone.
 */
export function isValidPhone(raw: string | null | undefined): boolean {
  return normalizePhone(raw) !== null;
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
// Amount in Words (Indian numbering system)
// =============================================================================

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

/** 0-99 in words. */
function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  const ones = ONES[n % 10];
  return ones ? `${tens} ${ones}` : tens;
}

/** 0-999 in words. */
function threeDigitsToWords(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigitsToWords(rest));
  return parts.join(" ");
}

/**
 * Spell a whole number using the INDIAN numbering system — crore, lakh,
 * thousand, hundred — rather than the Western million/billion grouping.
 *
 * 123456 → "One Lakh Twenty Three Thousand Four Hundred Fifty Six"
 */
function wholeNumberToIndianWords(value: number): string {
  if (value === 0) return "Zero";

  const crore = Math.floor(value / 10000000);
  const lakh = Math.floor((value % 10000000) / 100000);
  const thousand = Math.floor((value % 100000) / 1000);
  const rest = value % 1000;

  const parts: string[] = [];
  // Crores can exceed 999, so they recurse: 1,00,00,00,00,000 reads as
  // "One Thousand Crore" rather than overflowing the vocabulary.
  if (crore) parts.push(`${crore > 999 ? wholeNumberToIndianWords(crore) : threeDigitsToWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (rest) parts.push(threeDigitsToWords(rest));

  return parts.join(" ");
}

/**
 * Render a rupee amount in words, the way it appears on an Indian payslip or
 * invoice: "Rupees Two Thousand Four Hundred Fifty Only".
 *
 * Paise are included only when present, so whole amounts — which is all this
 * codebase produces, since money is rounded to whole rupees in `wallet.ts` and
 * `attendance.ts` — read cleanly without a redundant "and Zero Paise".
 *
 * Negative values are prefixed with "Minus" rather than rejected, so a payslip
 * whose deductions exceed its earnings still prints something truthful.
 */
export function amountInWordsINR(amount: number): string {
  if (!Number.isFinite(amount)) return "";

  const negative = amount < 0;
  const absolute = Math.abs(amount);

  // Work in paise to avoid float drift: 0.07 * 100 is 7.000000000000001.
  const totalPaise = Math.round(absolute * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;

  const parts: string[] = [];
  if (negative) parts.push("Minus");
  parts.push("Rupees", wholeNumberToIndianWords(rupees));
  if (paise > 0) parts.push("and", twoDigitsToWords(paise), "Paise");
  parts.push("Only");

  return parts.join(" ");
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
