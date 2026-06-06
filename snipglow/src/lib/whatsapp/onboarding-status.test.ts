// =============================================================================
// Property-based tests for the WhatsApp dedicated-number onboarding state machine
// and plan gating (src/lib/whatsapp/onboarding-status.ts).
//
// Framework: vitest + fast-check (node env, min 100 runs each).
// Properties implemented here (from design "Correctness Properties"):
//   - Property 3:  Plan-tier gating
//   - Property 11: Onboarding control derivation
//   - Property 12: Onboarding transition legality
//   - Property 13: Retry preserves valid prior progress
// =============================================================================

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  type OnboardingStatus,
  canTransition,
  controlsFor,
  retryTransition,
  planGate,
} from "@/lib/whatsapp/onboarding-status";

// All five OnboardingStatus values — used for status generators.
const ALL_STATUSES: OnboardingStatus[] = [
  "not_started",
  "in_progress",
  "connected",
  "failed",
  "disconnected",
];

const statusArb = fc.constantFrom(...ALL_STATUSES);

// The exact set of legal edges from the design state machine.
const LEGAL_EDGES = new Set<string>([
  "not_started->in_progress",
  "failed->in_progress",
  "disconnected->in_progress",
  "in_progress->connected",
  "in_progress->failed",
  "connected->disconnected",
]);

// -----------------------------------------------------------------------------
// Property 3: Plan-tier gating
// -----------------------------------------------------------------------------
// Feature: pro-plan-whatsapp-onboarding, Property 3: For any Plan_Tier value, the
// onboarding gating returns the connect action as enabled if and only if the tier
// equals 'pro', and otherwise returns the upgrade prompt.
describe("Property 3: Plan-tier gating", () => {
  // **Validates: Requirements 1.2, 1.3, 1.4**
  it("enables connect iff tier === 'pro', else shows upgrade prompt (known tiers)", () => {
    fc.assert(
      fc.property(fc.constantFrom("trial", "starter", "pro"), (tier) => {
        const gate = planGate(tier);
        const isPro = tier === "pro";
        expect(gate.connectEnabled).toBe(isPro);
        expect(gate.showUpgradePrompt).toBe(!isPro);
        // connectEnabled and showUpgradePrompt are always mutually exclusive.
        expect(gate.connectEnabled).not.toBe(gate.showUpgradePrompt);
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 1.2, 1.3, 1.4**
  it("treats any arbitrary non-'pro' string as non-pro (upgrade prompt)", () => {
    fc.assert(
      fc.property(fc.string(), (tier) => {
        fc.pre(tier !== "pro");
        const gate = planGate(tier);
        expect(gate.connectEnabled).toBe(false);
        expect(gate.showUpgradePrompt).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

// -----------------------------------------------------------------------------
// Property 11: Onboarding control derivation
// -----------------------------------------------------------------------------
// Feature: pro-plan-whatsapp-onboarding, Property 11: For any Onboarding_Status,
// the derived UI controls satisfy: retry is shown iff status is 'failed';
// disconnect is shown iff status is 'connected'; while 'in_progress' the progress
// indicator is shown and the connect action is hidden.
describe("Property 11: Onboarding control derivation", () => {
  // **Validates: Requirements 7.3, 7.4, 7.6, 8.1**
  it("derives retry/disconnect/progress/connect controls from status", () => {
    fc.assert(
      fc.property(statusArb, (status) => {
        const controls = controlsFor(status);
        // retry shown iff failed
        expect(controls.showRetry).toBe(status === "failed");
        // disconnect shown iff connected
        expect(controls.showDisconnect).toBe(status === "connected");
        // while in_progress: progress shown and connect hidden
        if (status === "in_progress") {
          expect(controls.showProgress).toBe(true);
          expect(controls.showConnect).toBe(false);
        } else {
          expect(controls.showProgress).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// -----------------------------------------------------------------------------
// Property 12: Onboarding transition legality
// -----------------------------------------------------------------------------
// Feature: pro-plan-whatsapp-onboarding, Property 12: For any pair of
// Onboarding_Status values, canTransition(from, to) permits exactly the legal
// edges (not_started->in_progress, failed->in_progress, disconnected->in_progress,
// in_progress->connected, in_progress->failed, connected->disconnected) and rejects
// all others.
describe("Property 12: Onboarding transition legality", () => {
  // **Validates: Requirements 2.4, 7.5, 8.6**
  it("permits exactly the legal edges over all (from, to) pairs", () => {
    fc.assert(
      fc.property(statusArb, statusArb, (from, to) => {
        const expected = LEGAL_EDGES.has(`${from}->${to}`);
        expect(canTransition(from, to)).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});

// -----------------------------------------------------------------------------
// Property 13: Retry preserves valid prior progress
// -----------------------------------------------------------------------------
// Feature: pro-plan-whatsapp-onboarding, Property 13: For any 'failed' state
// carrying partial valid progress, invoking retry transitions the status to
// 'in_progress' and preserves those valid fields rather than clearing them; from
// any non-failed status retry is rejected.
describe("Property 13: Retry preserves valid prior progress", () => {
  // Generator for partial valid prior progress: each field independently present.
  const progressArb = fc.record(
    {
      wabaId: fc.option(fc.string(), { nil: undefined }),
      phoneNumberId: fc.option(fc.string(), { nil: undefined }),
      displayPhoneNumber: fc.option(fc.string(), { nil: undefined }),
      accessTokenEncrypted: fc.option(fc.string(), { nil: undefined }),
    },
    { requiredKeys: [] },
  );

  // **Validates: Requirements 7.5**
  it("transitions failed -> in_progress and keeps the provided fields", () => {
    fc.assert(
      fc.property(progressArb, (progress) => {
        const result = retryTransition("failed", progress);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.status).toBe("in_progress");
          // Every provided field is preserved exactly.
          expect(result.progress).toEqual(progress);
        }
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 7.5**
  it("rejects retry from any non-failed status", () => {
    const nonFailedArb = fc.constantFrom(
      ...ALL_STATUSES.filter((s) => s !== "failed"),
    );
    fc.assert(
      fc.property(nonFailedArb, progressArb, (status, progress) => {
        const result = retryTransition(status, progress);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.reason).toBe("not_failed");
        }
      }),
      { numRuns: 100 },
    );
  });
});
