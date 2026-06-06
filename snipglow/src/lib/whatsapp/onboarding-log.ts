import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Onboarding status values mirrored from the `onboarding_status` CHECK constraint
 * in migration 025. Kept as a local union to avoid a hard dependency on the state
 * machine module; any string is accepted at the type boundary but callers should
 * pass one of these.
 */
export type OnboardingEventStatus =
  | 'not_started'
  | 'in_progress'
  | 'connected'
  | 'failed'
  | 'disconnected';

/**
 * Append a single onboarding lifecycle event to `whatsapp_onboarding_events`.
 *
 * This is intentionally **best-effort**: it never throws and swallows any error so
 * that a logging failure can never abort an in-flight onboarding operation
 * (Requirement 10.2). The recorded row carries the tenant identifier, the new
 * onboarding status, and (optionally) a descriptive reason. The database supplies
 * the `created_at` timestamp via its `DEFAULT now()` (Requirement 10.1).
 *
 * The caller is responsible for constructing `reason` from non-sensitive material
 * only — the plaintext or encrypted access token MUST never be passed in
 * (Requirement 10.3). As a defensive measure the reason is omitted entirely when
 * it is empty/whitespace.
 *
 * @param tenantId - The target tenant's identifier.
 * @param status   - The new onboarding status after the transition.
 * @param reason   - Optional descriptive reason (never a token).
 */
export async function recordOnboardingEvent(
  tenantId: string,
  status: OnboardingEventStatus | string,
  reason?: string,
): Promise<void> {
  try {
    const admin = createAdminClient();

    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';

    await (admin
      .from('whatsapp_onboarding_events' as any)
      .insert({
        tenant_id: tenantId,
        status,
        reason: trimmedReason.length > 0 ? trimmedReason : null,
      }) as any);
  } catch (err) {
    // Best-effort: swallow the error so onboarding never aborts on a logging failure.
    console.error('[recordOnboardingEvent] Failed to record onboarding event:', err);
  }
}
