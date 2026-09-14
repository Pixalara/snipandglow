// =============================================================================
// WhatsApp Message Template MANAGEMENT (create + list).
//
// Distinct from templates.ts, which only SENDS messages using already-approved
// templates. This module talks to Meta's WhatsApp Business MANAGEMENT API to
// create new templates and read their approval status.
//
// Templates are created on the TENANT'S OWN WABA (credentials.businessAccountId),
// never the platform WABA — a template belongs to exactly one WhatsApp Business
// Account and can only be sent from a number in that same account. The caller
// must therefore pass the tenant's dedicated credentials.
//
// TOKEN SCOPE: creating/reading templates requires the token to hold
// `whatsapp_business_management` (sending only needs `whatsapp_business_messaging`).
// Make sure the System User token granted during dedicated onboarding has both.
// =============================================================================

import type { WhatsAppCredentials } from './config';
import { WA_BASE_URL } from './config';

// =============================================================================
// Types
// =============================================================================

/** Meta template categories. We only create MARKETING here, but map them all. */
export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

/** Normalised review status, mirrored in the whatsapp_templates table. */
export type TemplateStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';

/**
 * A template the owner wants to create. `bodyText` carries positional
 * placeholders ({{1}}, {{2}}, …) and `exampleParams` supplies one sample value
 * per placeholder (Meta requires examples and rejects blanks).
 */
export interface TemplateDefinition {
  name: string;
  language?: string;
  category?: TemplateCategory;
  bodyText: string;
  exampleParams: string[];
  /** Optional static text header (no variables supported here by design). */
  headerText?: string;
  footerText?: string;
}

export interface CreateTemplateResult {
  ok: boolean;
  metaTemplateId?: string;
  status?: TemplateStatus;
  error?: string;
}

export interface MetaTemplateSummary {
  metaTemplateId: string | null;
  name: string;
  language: string;
  category: string;
  status: TemplateStatus;
}

// =============================================================================
// Pure helpers (unit-tested)
// =============================================================================

/**
 * Coerce any label into a valid Meta template name: lowercase, digits and
 * underscores only, no leading/trailing underscores, max 512 chars. Meta
 * rejects names with spaces, capitals or punctuation, so this is applied before
 * every create + stored as the canonical name.
 */
export function normalizeTemplateName(raw: string): string {
  const cleaned = (raw || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 512);
  return cleaned || 'template';
}

/** Positional placeholder indexes found in a body, in order of appearance. */
export function extractPlaceholders(body: string): number[] {
  return [...(body || '').matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1]));
}

/**
 * Validate a definition the way Meta will, so we fail fast with a friendly
 * message instead of a raw Graph API rejection:
 *   • body is required,
 *   • placeholders must be sequential 1..N with no gaps or repeats out of order,
 *   • exactly N example values must be supplied, none blank.
 */
export function validateDefinition(def: TemplateDefinition): { ok: true } | { ok: false; error: string } {
  const name = normalizeTemplateName(def.name);
  if (!name || name === 'template') {
    // Only reject when the *original* had nothing usable; an explicit "template"
    // label is fine but an empty/blank name falls back to it, so guard that.
    if (!def.name || !def.name.trim()) return { ok: false, error: 'Give the template a name.' };
  }
  if (!def.bodyText || !def.bodyText.trim()) {
    return { ok: false, error: 'The message body cannot be empty.' };
  }

  const placeholders = extractPlaceholders(def.bodyText);
  const highest = placeholders.length ? Math.max(...placeholders) : 0;

  // Sequential-from-1 check: the set of distinct indexes must be exactly 1..highest.
  const distinct = new Set(placeholders);
  for (let i = 1; i <= highest; i++) {
    if (!distinct.has(i)) {
      return { ok: false, error: `Placeholder {{${i}}} is missing — numbering must run 1..${highest} with no gaps.` };
    }
  }

  const examples = def.exampleParams ?? [];
  if (examples.length !== highest) {
    return {
      ok: false,
      error: `This message uses ${highest} placeholder(s) but ${examples.length} example value(s) were provided.`,
    };
  }
  if (examples.some((e) => !e || !e.trim())) {
    return { ok: false, error: 'Every placeholder needs a non-empty example value for Meta to approve it.' };
  }

  return { ok: true };
}

/**
 * Map Meta's template status vocabulary onto our smaller enum. Meta reports
 * several transitional states (IN_APPEAL, REINSTATED, PENDING_DELETION, …); we
 * fold them into the closest lifecycle bucket the UI cares about.
 */
export function mapMetaTemplateStatus(raw: string | null | undefined): TemplateStatus {
  switch ((raw || '').toUpperCase()) {
    case 'APPROVED':
    case 'REINSTATED':
      return 'APPROVED';
    case 'REJECTED':
      return 'REJECTED';
    case 'PAUSED':
    case 'FLAGGED':
    case 'LIMIT_EXCEEDED':
      return 'PAUSED';
    case 'DISABLED':
    case 'DELETED':
    case 'PENDING_DELETION':
      return 'DISABLED';
    case 'PENDING':
    case 'IN_APPEAL':
    default:
      return 'PENDING';
  }
}

/** Component/payload shapes for the create request (kept loose for the API). */
interface CreateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER';
  format?: 'TEXT';
  text?: string;
  example?: { body_text?: string[][] };
}

export interface CreateTemplatePayload {
  name: string;
  category: TemplateCategory;
  language: string;
  components: CreateComponent[];
}

/**
 * Build the exact JSON body Meta's create endpoint expects. Pure so it can be
 * asserted in tests without any network. The BODY example is an array with a
 * single row of sample values, matching Meta's `example.body_text` shape.
 */
export function buildCreatePayload(def: TemplateDefinition): CreateTemplatePayload {
  const components: CreateComponent[] = [];

  if (def.headerText && def.headerText.trim()) {
    components.push({ type: 'HEADER', format: 'TEXT', text: def.headerText.trim() });
  }

  const body: CreateComponent = { type: 'BODY', text: def.bodyText };
  if (def.exampleParams && def.exampleParams.length > 0) {
    body.example = { body_text: [def.exampleParams] };
  }
  components.push(body);

  if (def.footerText && def.footerText.trim()) {
    components.push({ type: 'FOOTER', text: def.footerText.trim() });
  }

  return {
    name: normalizeTemplateName(def.name),
    category: def.category ?? 'MARKETING',
    language: def.language ?? 'en',
    components,
  };
}

// =============================================================================
// Network calls (tenant WABA)
// =============================================================================

/**
 * Create a template on the tenant's WABA. Validates locally first, then POSTs to
 * `{waba-id}/message_templates`. On success returns Meta's template id and the
 * initial status (normally PENDING).
 */
export async function createTemplate(
  credentials: WhatsAppCredentials,
  def: TemplateDefinition
): Promise<CreateTemplateResult> {
  const validation = validateDefinition(def);
  if (!validation.ok) return { ok: false, error: validation.error };

  const payload = buildCreatePayload(def);

  try {
    const res = await fetch(`${WA_BASE_URL}/${credentials.businessAccountId}/message_templates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error?.error_user_msg || data?.error?.message || `Meta API error (${res.status})`;
      console.error('[WA Templates] create failed:', msg);
      return { ok: false, error: msg };
    }

    return {
      ok: true,
      metaTemplateId: data?.id != null ? String(data.id) : undefined,
      status: mapMetaTemplateStatus(data?.status),
    };
  } catch (err) {
    console.error('[WA Templates] create network error:', err);
    return { ok: false, error: 'Could not reach WhatsApp. Please try again.' };
  }
}

/**
 * List the templates that currently exist on the tenant's WABA. Used to
 * reconcile our local mirror (statuses can change on Meta's side). Returns an
 * empty list on any failure — callers treat it as "nothing to reconcile".
 */
export async function listTemplates(credentials: WhatsAppCredentials): Promise<MetaTemplateSummary[]> {
  try {
    const url = `${WA_BASE_URL}/${credentials.businessAccountId}/message_templates?fields=id,name,status,category,language&limit=200`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[WA Templates] list failed:', data?.error?.message || res.status);
      return [];
    }
    return (data?.data ?? []).map((t: Record<string, unknown>) => ({
      metaTemplateId: t.id != null ? String(t.id) : null,
      name: String(t.name ?? ''),
      language: String(t.language ?? 'en'),
      category: String(t.category ?? ''),
      status: mapMetaTemplateStatus(t.status as string),
    }));
  } catch (err) {
    console.error('[WA Templates] list network error:', err);
    return [];
  }
}
