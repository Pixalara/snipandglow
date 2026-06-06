// Feature: pro-plan-whatsapp-onboarding — Admin tenant detail "WhatsApp Settings" section.
//
// The admin section's rendering is entirely mapper-driven: the async server
// component (`page.tsx`) computes `const waView = toAdminWhatsAppView(waSettingsRes.data)`
// and then renders the Mode / Onboarding Status / Display Phone Number / Webhook
// Status fields when `waView` is truthy, or the "Dedicated WhatsApp not configured"
// empty state when it is `null`. Rather than mounting the full server component
// (which would require brittle mocks for requireAdmin, createAdminClient across
// many tables, logAdminAction, next/navigation, etc.), these tests pin the exact
// contract the server component relies on by asserting the mapper output.
//
// Scope: admin field-exposure (Req 9.1) and empty-state (Req 9.3) contract.
// `redaction.test.ts` already covers Property 17 (token never leaks) broadly.

import { describe, it, expect } from "vitest";
import {
  toAdminWhatsAppView,
  type TenantWhatsAppSettingsRow,
} from "@/lib/whatsapp/redaction";

describe("admin tenant detail — WhatsApp Settings section contract", () => {
  // Req 9.1 — A populated row exposes exactly the fields the admin Grid binds to
  // (Mode / Onboarding Status / Display Phone Number / Webhook Status), and never
  // the encrypted access token or any plaintext token.
  it("(Req 9.1) exposes mode/onboardingStatus/displayPhoneNumber/webhookStatus for a populated row", () => {
    const row: TenantWhatsAppSettingsRow = {
      tenant_id: "tenant-123",
      mode: "dedicated",
      booking_slug: "glow-salon",
      waba_id: "waba-1",
      phone_number_id: "phone-1",
      display_phone_number: "+91 99999 11111",
      display_name: "Glow Salon",
      display_name_status: "APPROVED",
      webhook_status: "verified",
      onboarding_status: "connected",
      onboarding_error: null,
      onboarding_updated_at: "2024-01-01T00:00:00Z",
      access_token_encrypted: "enc_super_secret_token_=",
      // Simulate a stray plaintext token column that select('*') might surface.
      access_token: "EAAplaintextTOKEN",
    };

    const view = toAdminWhatsAppView(row);

    expect(view).not.toBeNull();
    // The four fields the admin Grid renders for Req 9.1.
    expect(view!.mode).toBe("dedicated");
    expect(view!.onboardingStatus).toBe("connected");
    expect(view!.displayPhoneNumber).toBe("+91 99999 11111");
    expect(view!.webhookStatus).toBe("verified");

    // Redaction: no token key and no token value anywhere in the serialized view.
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("access_token_encrypted");
    expect(serialized).not.toContain("enc_super_secret_token_=");
    expect(serialized).not.toContain("EAAplaintextTOKEN");
    expect(Object.keys(view!)).not.toContain("access_token_encrypted");
    expect(Object.keys(view!)).not.toContain("access_token");
  });

  // Req 9.1 — Unknown/missing mode and status normalize to safe defaults so the
  // admin Grid always renders concrete strings.
  it("(Req 9.1) normalizes unknown mode and status to safe defaults", () => {
    const view = toAdminWhatsAppView({
      mode: "something-else",
      onboarding_status: "garbage_status",
      display_phone_number: null,
      webhook_status: null,
    });

    expect(view).not.toBeNull();
    expect(view!.mode).toBe("shared");
    expect(view!.onboardingStatus).toBe("not_started");
    // Empty/absent optional columns become null (the page renders these as "—").
    expect(view!.displayPhoneNumber).toBeNull();
    expect(view!.webhookStatus).toBeNull();
  });

  // Req 9.3 — A null/undefined row maps to `null`, which is precisely the signal
  // the page uses to render "Dedicated WhatsApp not configured".
  it("(Req 9.3) returns null for a missing row to drive the empty state", () => {
    expect(toAdminWhatsAppView(null)).toBeNull();
    expect(toAdminWhatsAppView(undefined)).toBeNull();
  });
});
