// Feature: pro-plan-whatsapp-onboarding, Property 17: Tokens never leak through
// responses, admin view, or logged reasons — for any settings row and any error
// reason, the redacted response, admin view mapping, and logged reason contain
// neither the plaintext token nor `access_token_encrypted`.

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  toAdminWhatsAppView,
  toOnboardingStateResponse,
  type TenantWhatsAppSettingsRow,
} from "@/lib/whatsapp/redaction";

// Recursively collect every primitive value reachable from an object so we can
// assert that no secret appears anywhere in the returned shape (not just at the
// top level after JSON.stringify).
function collectValues(value: unknown, acc: string[] = []): string[] {
  if (value === null || value === undefined) return acc;
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectValues(v, acc);
    }
  } else {
    acc.push(String(value));
  }
  return acc;
}

// Assert a mapped view object leaks neither the encrypted token nor the
// plaintext token through serialization or any individual value.
function expectNoLeak(view: unknown, secrets: string[]): void {
  const serialized = JSON.stringify(view ?? null);
  const values = collectValues(view);
  for (const secret of secrets) {
    // Skip degenerate empty secrets which can never represent a real leak.
    if (secret.length === 0) continue;
    expect(serialized.includes(secret)).toBe(false);
    for (const v of values) {
      expect(v.includes(secret)).toBe(false);
    }
  }
}

// A token-shaped string distinct from other fields so a leak is detectable.
const tokenLike = fc
  .string({ minLength: 8, maxLength: 64 })
  .map((s) => `EAA${s.replace(/\s/g, "x")}TOKEN`);

const encryptedLike = fc
  .string({ minLength: 8, maxLength: 80 })
  .map((s) => `enc_${s.replace(/\s/g, "x")}_=`);

describe("redaction view mappers — Property 17 (token never leaks)", () => {
  it("populated row: neither mapper leaks the encrypted nor plaintext token", () => {
    fc.assert(
      fc.property(
        encryptedLike,
        tokenLike,
        fc.option(fc.string(), { nil: null }),
        fc.constantFrom(
          "not_started",
          "in_progress",
          "connected",
          "failed",
          "disconnected",
          "garbage_status"
        ),
        fc.constantFrom("shared", "dedicated", "unknown"),
        fc.option(fc.string(), { nil: null }),
        fc.option(fc.string(), { nil: null }),
        (
          accessTokenEncrypted,
          plaintextToken,
          errorReason,
          status,
          mode,
          displayPhone,
          webhookStatus
        ) => {
          const row: TenantWhatsAppSettingsRow = {
            tenant_id: "tenant-123",
            mode,
            booking_slug: "slug",
            waba_id: "waba-1",
            phone_number_id: "phone-1",
            display_phone_number: displayPhone,
            display_name: "Salon",
            display_name_status: "APPROVED",
            webhook_status: webhookStatus,
            onboarding_status: status,
            onboarding_error: errorReason,
            onboarding_updated_at: "2024-01-01T00:00:00Z",
            access_token_encrypted: accessTokenEncrypted,
            // Simulate a stray plaintext token column sneaking in via select('*').
            access_token: plaintextToken,
          };

          const secrets = [accessTokenEncrypted, plaintextToken];
          expectNoLeak(toAdminWhatsAppView(row), secrets);
          expectNoLeak(toOnboardingStateResponse(row), secrets);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("null row: admin mapper returns null and response mapper returns not_started default with no leak", () => {
    fc.assert(
      fc.property(encryptedLike, tokenLike, (accessTokenEncrypted, plaintextToken) => {
        const secrets = [accessTokenEncrypted, plaintextToken];

        for (const empty of [null, undefined] as const) {
          const adminView = toAdminWhatsAppView(empty);
          expect(adminView).toBeNull();
          expectNoLeak(adminView, secrets);

          const response = toOnboardingStateResponse(empty);
          expect(response.status).toBe("not_started");
          expect(response.mode).toBe("shared");
          expectNoLeak(response, secrets);
        }
      }),
      { numRuns: 100 }
    );
  });
});
