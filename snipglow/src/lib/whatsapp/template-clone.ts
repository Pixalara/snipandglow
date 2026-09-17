// =============================================================================
// WhatsApp template cloner.
//
// Reads the approved templates from a SOURCE WABA (the shared Snip and Glow
// account) and recreates them on a TARGET WABA (a Pro tenant's dedicated
// account) so the tenant can send the same transactional messages from their
// own number. Templates are WABA-scoped, so every dedicated tenant needs their
// own copies — this automates that provisioning.
//
// Only APPROVED source templates in the tenant allowlist are cloned. Templates
// already present on the target are skipped. Document-header templates
// (bill_receipt_v2, wallet_recharge_v1) are recreated by uploading a PII-free
// sample PDF via the resumable upload API to obtain a header handle; other
// media headers (image/video) are still reported as "create manually".
// =============================================================================

import { getMetaAppId, type WhatsAppCredentials } from './config';
import { uploadResumableDocument } from './media-upload';
import {
  fetchTemplateDefinitions,
  listTemplates,
  metaTemplateToCreatePayload,
  postTemplate,
  type MetaTemplateFull,
} from './template-management';

/** The header format of a template's HEADER component, uppercased, or null. */
function headerFormat(t: MetaTemplateFull): string | null {
  const h = (t.components || []).find((c) => (c.type || '').toUpperCase() === 'HEADER');
  const fmt = (h?.format || '').toUpperCase();
  return fmt && fmt !== 'TEXT' ? fmt : null;
}

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

  // If any not-yet-present candidate needs a DOCUMENT header, upload one
  // PII-free sample PDF and reuse its handle for all of them.
  const needsDocHandle = candidates.some(
    (t) => !existingKeys.has(`${t.name}|${t.language}`) && headerFormat(t) === 'DOCUMENT'
  );
  let docHandle: string | undefined;
  let docHandleError: string | undefined;
  if (needsDocHandle) {
    const appId = getMetaAppId();
    if (!appId) {
      docHandleError = 'META_APP_ID is not set';
    } else {
      try {
        const { buildSampleInvoicePdf } = await import('./sample-invoice-pdf');
        const pdf = await buildSampleInvoicePdf();
        const up = await uploadResumableDocument(appId, target.accessToken, pdf, 'sample-invoice.pdf');
        if (up.ok) docHandle = up.handle;
        else docHandleError = up.error;
      } catch {
        docHandleError = 'could not generate the sample PDF';
      }
    }
  }

  const outcomes: CloneOutcome[] = [];
  for (const t of candidates) {
    const key = `${t.name}|${t.language}`;
    if (existingKeys.has(key)) {
      outcomes.push({ name: t.name, language: t.language, status: 'skipped', reason: 'already exists on this number' });
      continue;
    }

    // Media headers: auto-handle documents (when the sample uploaded), skip the rest.
    const media = headerFormat(t);
    if (media && media !== 'DOCUMENT') {
      outcomes.push({ name: t.name, language: t.language, status: 'skipped', reason: `has a ${media.toLowerCase()} header — create this template manually` });
      continue;
    }
    if (media === 'DOCUMENT' && !docHandle) {
      outcomes.push({
        name: t.name,
        language: t.language,
        status: 'skipped',
        reason: docHandleError ? `document header sample upload failed: ${docHandleError}` : 'document header — create manually',
      });
      continue;
    }

    const { payload, skipReason } = metaTemplateToCreatePayload(t, { documentHeaderHandle: docHandle });
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
