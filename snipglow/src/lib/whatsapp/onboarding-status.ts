// =============================================================================
// WhatsApp Dedicated-Number Onboarding State Machine + Plan Gating
//
// Pure, dependency-free module. `onboarding_status` is the single source of truth
// for "where is this tenant in the dedicated flow"; outbound routing keys off it
// (only `connected` selects dedicated credentials). This module exposes:
//   - the OnboardingStatus type + legal-transition table
//   - canTransition(from, to)
//   - controlsFor(status) → derived UI control flags
//   - defaultStatus() → 'not_started'
//   - retryTransition(...) → retry that preserves valid prior progress
//   - planGate(planTier) → connect-vs-upgrade gating
// =============================================================================

/**
 * The lifecycle state of a tenant's dedicated WhatsApp onboarding.
 *
 * Mirrors the `onboarding_status` CHECK constraint in migration 025.
 */
export type OnboardingStatus =
  | 'not_started'
  | 'in_progress'
  | 'connected'
  | 'failed'
  | 'disconnected';

/**
 * The plan tier of a tenant (`tenants.plan_tier`).
 */
export type PlanTier = 'trial' | 'starter' | 'pro';

/**
 * The legal onboarding state transitions.
 *
 * Exactly these edges are permitted (design "Onboarding State Machine"):
 *   - not_started  → in_progress   (auth code received,  Req 2.4)
 *   - failed       → in_progress   (retry,               Req 7.5)
 *   - disconnected → in_progress   (re-initiate,         Req 8.6)
 *   - in_progress  → connected     (stored + webhook,    Req 5.3)
 *   - in_progress  → failed        (graph/webhook error, Req 3.3, 5.4)
 *   - connected    → disconnected  (owner disconnects,   Req 8.2)
 *
 * All other transitions are rejected.
 */
export const LEGAL_TRANSITIONS: Record<OnboardingStatus, OnboardingStatus[]> = {
  not_started: ['in_progress'],
  in_progress: ['connected', 'failed'],
  connected: ['disconnected'],
  failed: ['in_progress'],
  disconnected: ['in_progress'],
};

/**
 * Returns `true` iff transitioning from `from` to `to` is a legal onboarding edge.
 *
 * Validates: Requirements 2.4, 7.5, 8.6
 */
export function canTransition(from: OnboardingStatus, to: OnboardingStatus): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Derived UI control flags for a given onboarding status. These drive which
 * actions/indicators the owner onboarding UI renders.
 */
export interface OnboardingControls {
  /** Show the connect action. Suppressed while `in_progress` (Req 7.6). */
  showConnect: boolean;
  /** Show the retry action. Shown iff `failed` (Req 7.3, 7.4). */
  showRetry: boolean;
  /** Show the disconnect action. Shown iff `connected` (Req 8.1). */
  showDisconnect: boolean;
  /** Show the progress indicator. Shown iff `in_progress` (Req 7.6). */
  showProgress: boolean;
}

/**
 * Derive the UI control flags for the given onboarding status.
 *
 * Rules (design "Onboarding State interface" + Property 11):
 *   - connect:    shown when the owner can start/restart a fresh connect, i.e.
 *                 `not_started` or `disconnected`; hidden while `in_progress`.
 *   - retry:      shown iff `failed`.
 *   - disconnect: shown iff `connected`.
 *   - progress:   shown iff `in_progress`.
 *
 * Validates: Requirements 7.3, 7.4, 7.6, 8.1
 */
export function controlsFor(status: OnboardingStatus): OnboardingControls {
  return {
    showConnect: status === 'not_started' || status === 'disconnected',
    showRetry: status === 'failed',
    showDisconnect: status === 'connected',
    showProgress: status === 'in_progress',
  };
}

/**
 * The default onboarding status when no prior outcome exists for a tenant.
 *
 * Validates: Requirement 10.5
 */
export function defaultStatus(): OnboardingStatus {
  return 'not_started';
}

/**
 * Valid prior progress carried across a retry. These are the dedicated-onboarding
 * fields that may have been fetched/stored during a previous attempt and should be
 * preserved (not cleared) when the owner retries from a `failed` state (Req 7.5).
 */
export interface OnboardingProgress {
  wabaId?: string | null;
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
  accessTokenEncrypted?: string | null;
}

/**
 * Result of a retry-transition attempt.
 */
export type RetryTransitionResult =
  | { ok: true; status: 'in_progress'; progress: OnboardingProgress }
  | { ok: false; reason: 'not_failed' };

/**
 * Retry-transition helper.
 *
 * A retry is only legal from a `failed` state (`failed → in_progress`). When legal,
 * it transitions to `in_progress` and **preserves the valid prior progress** rather
 * than clearing it, so the orchestration can restart from the failed step without
 * re-fetching already-obtained WABA fields. When the current status is not `failed`
 * the retry is rejected and no transition occurs.
 *
 * Validates: Requirement 7.5
 *
 * @param status   - The tenant's current onboarding status.
 * @param progress - Valid progress from the previous attempt to preserve.
 */
export function retryTransition(
  status: OnboardingStatus,
  progress?: OnboardingProgress,
): RetryTransitionResult {
  if (status !== 'failed' || !canTransition(status, 'in_progress')) {
    return { ok: false, reason: 'not_failed' };
  }
  // Preserve valid prior progress rather than clearing it.
  return { ok: true, status: 'in_progress', progress: { ...(progress ?? {}) } };
}

/**
 * Result of evaluating plan-tier gating for the dedicated connect action.
 */
export interface PlanGateResult {
  /** The connect action is enabled iff the tenant is on the Pro plan. */
  connectEnabled: boolean;
  /** The upgrade prompt is shown for any non-Pro tier. */
  showUpgradePrompt: boolean;
}

/**
 * Plan-gating helper for the dedicated WhatsApp connect action.
 *
 * Enables the connect action **if and only if** `planTier === 'pro'`; otherwise it
 * yields the upgrade prompt instead. `connectEnabled` and `showUpgradePrompt` are
 * always mutually exclusive.
 *
 * Validates: Requirements 1.2, 1.3, 1.4
 *
 * @param planTier - The tenant's plan tier (`tenants.plan_tier`).
 */
export function planGate(planTier: PlanTier | string | null | undefined): PlanGateResult {
  const isPro = planTier === 'pro';
  return {
    connectEnabled: isPro,
    showUpgradePrompt: !isPro,
  };
}
