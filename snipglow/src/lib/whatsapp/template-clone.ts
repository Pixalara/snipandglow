// =============================================================================
// WhatsApp template cloner.
//
// Reads the approved templates from a SOURCE WABA (the shared Snip and Glow
// account) and recreates them on a TARGET WABA (a Pro tenant's dedicated
// account) so the tenant can send the same transactional messages from their
// own number. Templates are WABA-scoped, so every dedicated tenant needs their
// own copies — this automates that provisioning.
//
// Only APPROVED source templates in the requested categories are cloned
// (UTILITY by default = booking/reschedule/reminder/receipt/feedback/owner
// alerts). Templates already present on the target are skipped, and media-header
// templates (which need a freshly uploaded media handle) are reported as
// "create manually" rather than failed.
// =============================================================================

import type { WhatsAppCredentials } from './config';
import {
  fetchTemplateDefinitions,
  listTemplates,
  metaTemplateToCreatePayload,
  postTemplate,
} from './template-management';

export interface CloneOutcome {
  name: string;
  language: string;
  status: 'created' | 'skipped' | 'failed';
  reason?: string;
}

export interface CloneResult {
  ok: boolean;
  error?: string;
  outcomes: CloneOutcome[];
  created: number;
  skipped: number;
  failed: number;
}

/**
 * The templates a dedicated tenant actually sends from their OWN number:
 * customer transactional messages + owner alerts.
 *
 * Deliberately an allowlist (not "all UTILITY") so the cloner never copies
 * platform-ops templates that are only ever sent from the shared number
 * (platform_signup_alert, trial_expiry_v1, staff_welcome_*), Meta's reserved
 * `hello_world` sample, marketing templates, or superseded older versions
 * (booking_confirmation, appointment_reminder, feedback_request, invoice_receipt)
 * onto a tenant's account.
 *
 * bill_receipt_v2 and wallet_recharge_v1 carry a document header and can't be
 * auto-cloned — they stay in the list so they're surfaced as "create manually"
 * rather than silently missing.
 */
export const TENANT_TEMPLATE_NAMES = [
  'booking_confirmation_v2',
  'appointment_rescheduled_v1',
  'appointment_reminder_v1',
  'bill_receipt_v2',
  'bill_receipt_v1',
  'feedback_request_v1',
  'wallet_recharge_v1',
  'owner_booking_alert',
  'owner_reschedule_alert',
  'owner_cancel_alert',
  'owner_feedback_alert',
] as const;

/**
 * Clone approved templates from `source` onto `target`.
 * Sequential (not parallel) to stay well under Meta's create rate limits.
 */
export async function cloneTemplates(
  source: WhatsAppCredentials,
  target: WhatsAppCredentials,
  opts?: { names?: readonly string[] }
): Promise<CloneResult> {
  const empty = { outcomes: [] as CloneOutcome[], created: 0, skipped: 0, failed: 0 };

  if (!source?.businessAccountId || !target?.businessAccountId) {
    return { ok: false, error: 'Missing WhatsApp credentials.', ...empty };
  }
  if (source.businessAccountId === target.businessAccountId) {
    return {
      ok: false,
      error: 'Source and target are the same WhatsApp Business Account — nothing to clone.',
      ...empty,
    };
  }

  const wanted = new Set((opts?.names ?? TENANT_TEMPLATE_NAMES).map((n) => n.toLowerCase()));

  const src = await fetchTemplateDefinitions(source);
  if (!src.ok) {
    return { ok: false, error: `Could not read platform templates: ${src.error ?? 'unknown error'}`, ...empty };
  }

  // Existing templates on the target (any status) — Meta keys by name+language,
  // and recreating an existing name fails, so skip those up front.
  const existing = await listTemplates(target);
  const existingKeys = new Set(existing.map((t) => `${t.name}|${t.language}`));

  // Worth cloning: approved on the source AND in the tenant allowlist.
  const candidates = src.templates.filter(
    (t) => t.status === 'APPROVED' && wanted.has((t.name || '').toLowerCase())
  );

  const outcomes: CloneOutcome[] = [];
  for (const t of candidates) {
    const key = `${t.name}|${t.language}`;
    if (existingKeys.has(key)) {
      outcomes.push({ name: t.name, language: t.language, status: 'skipped', reason: 'already exists on this number' });
      continue;
    }

    const { payload, skipReason } = metaTemplateToCreatePayload(t);
    if (!payload) {
      outcomes.push({ name: t.name, language: t.language, status: 'skipped', reason: skipReason ?? 'not cloneable' });
      continue;
    }

    const res = await postTemplate(target, payload);
    if (res.ok) {
      outcomes.push({ name: t.name, language: t.language, status: 'created' });
    } else {
      outcomes.push({ name: t.name, language: t.language, status: 'failed', reason: res.error ?? 'create failed' });
    }
  }

  const created = outcomes.filter((o) => o.status === 'created').length;
  const skipped = outcomes.filter((o) => o.status === 'skipped').length;
  const failed = outcomes.filter((o) => o.status === 'failed').length;

  return { ok: failed === 0, outcomes, created, skipped, failed };
}
