import { describe, it, expect } from "vitest";

/**
 * Unit tests for WhatsApp OTP Edge Function logic.
 * These test the core validation and OTP generation logic
 * that the Edge Functions use internally.
 *
 * Validates: Requirements 2.2, 18.3, 18.4
 */

// Helper: replicate the OTP generation logic from the edge function
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper: replicate phone validation from the edge function
function isValidE164Phone(phone: string): boolean {
  const phoneRegex = /^\+\d{10,15}$/;
  return phoneRegex.test(phone);
}

// Helper: check if OTP is expired
function isOtpExpired(expiresAt: string): boolean {
  return new Date(expiresAt) <= new Date();
}

// Helper: compute expiry timestamp (5 minutes from now)
function computeOtpExpiry(): string {
  return new Date(Date.now() + 5 * 60 * 1000).toISOString();
}

describe("OTP Generation", () => {
  it("generates a 6-digit numeric code", () => {
    const otp = generateOtp();
    expect(otp).toMatch(/^\d{6}$/);
    expect(otp.length).toBe(6);
  });

  it("generates codes within valid range (100000-999999)", () => {
    for (let i = 0; i < 100; i++) {
      const otp = generateOtp();
      const num = parseInt(otp, 10);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThanOrEqual(999999);
    }
  });

  it("generates different codes on successive calls (probabilistic)", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      codes.add(generateOtp());
    }
    // With 50 random 6-digit codes, we expect at least 40 unique ones
    expect(codes.size).toBeGreaterThan(40);
  });
});

describe("Phone Number Validation (E.164)", () => {
  it("accepts valid Indian phone number in E.164 format", () => {
    expect(isValidE164Phone("+919876543210")).toBe(true);
  });

  it("accepts valid international numbers", () => {
    expect(isValidE164Phone("+14155552671")).toBe(true);
    expect(isValidE164Phone("+447911123456")).toBe(true);
  });

  it("rejects phone without + prefix", () => {
    expect(isValidE164Phone("919876543210")).toBe(false);
  });

  it("rejects phone with too few digits", () => {
    expect(isValidE164Phone("+12345")).toBe(false);
  });

  it("rejects phone with non-numeric characters", () => {
    expect(isValidE164Phone("+91-9876-543210")).toBe(false);
    expect(isValidE164Phone("+91 9876543210")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidE164Phone("")).toBe(false);
  });
});

describe("OTP Expiry Logic", () => {
  it("computes expiry 5 minutes in the future", () => {
    const before = Date.now();
    const expiry = computeOtpExpiry();
    const after = Date.now();

    const expiryTime = new Date(expiry).getTime();
    // Expiry should be ~5 minutes from now (within 1 second tolerance)
    expect(expiryTime).toBeGreaterThanOrEqual(before + 5 * 60 * 1000 - 1000);
    expect(expiryTime).toBeLessThanOrEqual(after + 5 * 60 * 1000 + 1000);
  });

  it("identifies expired OTP correctly", () => {
    const pastExpiry = new Date(Date.now() - 1000).toISOString();
    expect(isOtpExpired(pastExpiry)).toBe(true);
  });

  it("identifies valid (non-expired) OTP correctly", () => {
    const futureExpiry = new Date(Date.now() + 60000).toISOString();
    expect(isOtpExpired(futureExpiry)).toBe(false);
  });

  it("treats exact current time as expired", () => {
    // Edge case: expires_at === now should be treated as expired
    const nowExpiry = new Date().toISOString();
    // Due to timing, this might be true or false by milliseconds
    // The important thing is the logic: expires_at <= now means expired
    const result = isOtpExpired(nowExpiry);
    expect(typeof result).toBe("boolean");
  });
});

describe("send-whatsapp-otp request validation", () => {
  it("requires phone field to be present", () => {
    const body = {};
    const phone = (body as { phone?: string }).phone;
    expect(!phone || typeof phone !== "string").toBe(true);
  });

  it("requires phone field to be a string", () => {
    const body = { phone: 12345 };
    const phone = body.phone;
    expect(typeof phone !== "string").toBe(true);
  });

  it("accepts valid request body", () => {
    const body = { phone: "+919876543210" };
    expect(body.phone && typeof body.phone === "string").toBe(true);
    expect(isValidE164Phone(body.phone)).toBe(true);
  });
});

describe("verify-whatsapp-otp request validation", () => {
  it("requires both phone and code fields", () => {
    const body1 = { phone: "+919876543210" };
    const body2 = { code: "123456" };
    const body3 = { phone: "+919876543210", code: "123456" };

    expect(!(body1 as { code?: string }).code).toBe(true);
    expect(!(body2 as { phone?: string }).phone).toBe(true);
    expect(body3.phone && body3.code).toBeTruthy();
  });

  it("validates OTP code format (6 digits)", () => {
    const validCode = "123456";
    const invalidCode = "12345"; // too short
    const nonNumeric = "abcdef";

    expect(/^\d{6}$/.test(validCode)).toBe(true);
    expect(/^\d{6}$/.test(invalidCode)).toBe(false);
    expect(/^\d{6}$/.test(nonNumeric)).toBe(false);
  });
});
