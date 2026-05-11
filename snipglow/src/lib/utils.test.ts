import { describe, it, expect } from "vitest";
import {
  formatINR,
  formatDateIN,
  formatTimeIST,
  isValidIndianPhone,
  formatPhoneE164,
  calculateInvoiceTotal,
} from "./utils";

// =============================================================================
// formatINR
// =============================================================================

describe("formatINR", () => {
  it("formats whole numbers with Indian grouping", () => {
    expect(formatINR(1500)).toBe("₹1,500");
    expect(formatINR(150000)).toBe("₹1,50,000");
    expect(formatINR(10000000)).toBe("₹1,00,00,000");
  });

  it("formats zero", () => {
    expect(formatINR(0)).toBe("₹0");
  });

  it("formats small numbers without grouping", () => {
    expect(formatINR(5)).toBe("₹5");
    expect(formatINR(99)).toBe("₹99");
    expect(formatINR(999)).toBe("₹999");
  });

  it("formats decimal numbers with up to 2 decimal places", () => {
    expect(formatINR(1500.5)).toBe("₹1,500.50");
    expect(formatINR(1500.75)).toBe("₹1,500.75");
  });

  it("starts with ₹ symbol", () => {
    expect(formatINR(42)).toMatch(/^₹/);
  });
});

// =============================================================================
// formatDateIN
// =============================================================================

describe("formatDateIN", () => {
  it("formats a Date object as DD MMM YYYY in IST", () => {
    const result = formatDateIN(new Date("2026-04-29T10:00:00Z"));
    expect(result).toBe("29 Apr 2026");
  });

  it("formats a date string as DD MMM YYYY in IST", () => {
    const result = formatDateIN("2026-04-29T10:00:00Z");
    expect(result).toBe("29 Apr 2026");
  });

  it("handles timezone boundary (late UTC becomes next day in IST)", () => {
    // 2026-04-28T20:00:00Z = 2026-04-29 01:30 IST
    const result = formatDateIN(new Date("2026-04-28T20:00:00Z"));
    expect(result).toBe("29 Apr 2026");
  });

  it("formats January date correctly", () => {
    const result = formatDateIN(new Date("2026-01-15T05:00:00Z"));
    expect(result).toBe("15 Jan 2026");
  });
});

// =============================================================================
// formatTimeIST
// =============================================================================

describe("formatTimeIST", () => {
  it("formats UTC time to IST 12-hour format", () => {
    // 10:30 UTC = 16:00 IST = 4:00 PM
    const result = formatTimeIST(new Date("2026-04-29T10:30:00Z"));
    expect(result).toBe("4:00 PM");
  });

  it("formats morning time correctly", () => {
    // 03:30 UTC = 09:00 IST = 9:00 AM
    const result = formatTimeIST(new Date("2026-04-29T03:30:00Z"));
    expect(result).toBe("9:00 AM");
  });

  it("formats midnight IST correctly", () => {
    // 18:30 UTC = 00:00 IST = 12:00 AM
    const result = formatTimeIST(new Date("2026-04-29T18:30:00Z"));
    expect(result).toBe("12:00 AM");
  });

  it("formats noon IST correctly", () => {
    // 06:30 UTC = 12:00 IST = 12:00 PM
    const result = formatTimeIST(new Date("2026-04-29T06:30:00Z"));
    expect(result).toBe("12:00 PM");
  });

  it("accepts string input", () => {
    const result = formatTimeIST("2026-04-29T10:30:00Z");
    expect(result).toBe("4:00 PM");
  });
});

// =============================================================================
// isValidIndianPhone
// =============================================================================

describe("isValidIndianPhone", () => {
  it("validates a valid 10-digit number starting with 6-9", () => {
    expect(isValidIndianPhone("9876543210")).toBe(true);
    expect(isValidIndianPhone("8765432109")).toBe(true);
    expect(isValidIndianPhone("7654321098")).toBe(true);
    expect(isValidIndianPhone("6543210987")).toBe(true);
  });

  it("validates with +91 prefix", () => {
    expect(isValidIndianPhone("+919876543210")).toBe(true);
  });

  it("validates with spaces", () => {
    expect(isValidIndianPhone("98765 43210")).toBe(true);
    expect(isValidIndianPhone("+91 9876543210")).toBe(true);
  });

  it("validates with dashes", () => {
    expect(isValidIndianPhone("98765-43210")).toBe(true);
  });

  it("rejects numbers starting with 0-5", () => {
    expect(isValidIndianPhone("0123456789")).toBe(false);
    expect(isValidIndianPhone("1234567890")).toBe(false);
    expect(isValidIndianPhone("5234567890")).toBe(false);
  });

  it("rejects numbers with wrong length", () => {
    expect(isValidIndianPhone("987654321")).toBe(false); // 9 digits
    expect(isValidIndianPhone("98765432101")).toBe(false); // 11 digits
  });

  it("rejects empty string", () => {
    expect(isValidIndianPhone("")).toBe(false);
  });

  it("rejects non-numeric strings", () => {
    expect(isValidIndianPhone("abcdefghij")).toBe(false);
  });
});

// =============================================================================
// formatPhoneE164
// =============================================================================

describe("formatPhoneE164", () => {
  it("formats a 10-digit number to E.164", () => {
    expect(formatPhoneE164("9876543210")).toBe("+919876543210");
  });

  it("handles existing +91 prefix", () => {
    expect(formatPhoneE164("+919876543210")).toBe("+919876543210");
  });

  it("strips spaces before formatting", () => {
    expect(formatPhoneE164("98765 43210")).toBe("+919876543210");
    expect(formatPhoneE164("+91 9876543210")).toBe("+919876543210");
  });

  it("strips dashes before formatting", () => {
    expect(formatPhoneE164("98765-43210")).toBe("+919876543210");
  });
});

// =============================================================================
// calculateInvoiceTotal
// =============================================================================

describe("calculateInvoiceTotal", () => {
  it("calculates subtotal from line items", () => {
    const result = calculateInvoiceTotal({
      lineItems: [
        { price: 500, quantity: 1 },
        { price: 300, quantity: 2 },
      ],
      membershipDiscountPct: 0,
      gstRate: 0,
    });
    expect(result.subtotal).toBe(1100);
    expect(result.total).toBe(1100);
  });

  it("applies membership discount correctly", () => {
    const result = calculateInvoiceTotal({
      lineItems: [{ price: 1000, quantity: 1 }],
      membershipDiscountPct: 10,
      gstRate: 0,
    });
    expect(result.subtotal).toBe(1000);
    expect(result.discountAmount).toBe(100);
    expect(result.taxableAmount).toBe(900);
    expect(result.total).toBe(900);
  });

  it("applies GST correctly", () => {
    const result = calculateInvoiceTotal({
      lineItems: [{ price: 1000, quantity: 1 }],
      membershipDiscountPct: 0,
      gstRate: 18,
    });
    expect(result.subtotal).toBe(1000);
    expect(result.gstAmount).toBe(180);
    expect(result.total).toBe(1180);
  });

  it("applies both discount and GST correctly", () => {
    const result = calculateInvoiceTotal({
      lineItems: [{ price: 1000, quantity: 2 }],
      membershipDiscountPct: 20,
      gstRate: 18,
    });
    expect(result.subtotal).toBe(2000);
    expect(result.discountAmount).toBe(400);
    expect(result.taxableAmount).toBe(1600);
    expect(result.gstAmount).toBe(288);
    expect(result.total).toBe(1888);
  });

  it("handles empty line items", () => {
    const result = calculateInvoiceTotal({
      lineItems: [],
      membershipDiscountPct: 10,
      gstRate: 18,
    });
    expect(result.subtotal).toBe(0);
    expect(result.discountAmount).toBe(0);
    expect(result.taxableAmount).toBe(0);
    expect(result.gstAmount).toBe(0);
    expect(result.total).toBe(0);
  });

  it("rounds discount and GST amounts", () => {
    const result = calculateInvoiceTotal({
      lineItems: [{ price: 333, quantity: 1 }],
      membershipDiscountPct: 7,
      gstRate: 18,
    });
    // discount = round(333 * 7 / 100) = round(23.31) = 23
    expect(result.discountAmount).toBe(23);
    // taxable = 333 - 23 = 310
    expect(result.taxableAmount).toBe(310);
    // gst = round(310 * 18 / 100) = round(55.8) = 56
    expect(result.gstAmount).toBe(56);
    // total = 310 + 56 = 366
    expect(result.total).toBe(366);
  });

  it("satisfies total = taxableAmount + gstAmount", () => {
    const result = calculateInvoiceTotal({
      lineItems: [
        { price: 750, quantity: 3 },
        { price: 200, quantity: 1 },
      ],
      membershipDiscountPct: 15,
      gstRate: 12,
    });
    expect(result.total).toBe(result.taxableAmount + result.gstAmount);
  });
});
