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
  /**
   * Optional IMAGE header. The Meta media handle returned by the resumable
   * upload API (uploadResumableImage), set when the tenant attaches a banner.
   * Takes precedence over headerText — a template may have only one header.
   */
  headerImageHandle?: string;
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

/** Button shape for the create request (buttons are only produced by cloning). */
interface CreateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
}

/** Component/payload shapes for the create request (kept loose for the API). */
interface CreateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'DOCUMENT' | 'IMAGE' | 'VIDEO';
  text?: string;
  example?: { body_text?: string[][]; header_text?: string[]; header_handle?: string[] };
  buttons?: CreateButton[];
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

  // A template can carry at most ONE header. Prefer an image banner when one was
  // uploaded, else fall back to a static text header.
  if (def.headerImageHandle && def.headerImageHandle.trim()) {
    components.push({ type: 'HEADER', format: 'IMAGE', example: { header_handle: [def.headerImageHandle.trim()] } });
  } else if (def.headerText && def.headerText.trim()) {
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

  return postTemplate(credentials, buildCreatePayload(def));
}

/**
 * POST a fully-built create payload to the tenant's WABA. Shared by both the
 * owner-facing create flow (via createTemplate) and the template cloner (which
 * builds payloads directly from an existing template's components).
 */
export async function postTemplate(
  credentials: WhatsAppCredentials,
  payload: CreateTemplatePayload
): Promise<CreateTemplateResult> {
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

// =============================================================================
// Template CLONING support — read a template's full components from one WABA
// and rebuild the create payload so it can be recreated on another WABA.
// =============================================================================

/** A button as returned by Meta's GET message_templates. */
export interface MetaTemplateButton {
  type: string; // QUICK_REPLY | URL | PHONE_NUMBER | COPY_CODE | ...
  text?: string;
  url?: string;
  phone_number?: string;
  example?: string[];
}

/** A component as returned by Meta's GET message_templates. */
export interface MetaTemplateComponent {
  type: string; // HEADER | BODY | FOOTER | BUTTONS
  format?: string; // for HEADER: TEXT | DOCUMENT | IMAGE | VIDEO | LOCATION
  text?: string;
  example?: { body_text?: string[][]; header_text?: string[]; header_handle?: string[] };
  buttons?: MetaTemplateButton[];
}

/** A full template (with components) as returned by Meta's GET message_templates. */
export interface MetaTemplateFull {
  id?: string;
  name: string;
  language: string;
  category: string;
  status: TemplateStatus;
  components: MetaTemplateComponent[];
}

/**
 * Fetch the FULL template definitions (including components) from a WABA. Used
 * as the source for cloning. Distinct from listTemplates, which fetches only the
 * light status fields for reconciliation.
 */
export async function fetchTemplateDefinitions(
  credentials: WhatsAppCredentials
): Promise<{ ok: boolean; templates: MetaTemplateFull[]; error?: string }> {
  try {
    const url = `${WA_BASE_URL}/${credentials.businessAccountId}/message_templates?fields=name,language,category,status,components&limit=200`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${credentials.accessToken}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, templates: [], error: data?.error?.message || `Meta API error (${res.status})` };
    }
    const templates: MetaTemplateFull[] = (data?.data ?? []).map((t: Record<string, unknown>) => ({
      id: t.id != null ? String(t.id) : undefined,
      name: String(t.name ?? ''),
      language: String(t.language ?? 'en'),
      category: String(t.category ?? ''),
      status: mapMetaTemplateStatus(t.status as string),
      components: Array.isArray(t.components) ? (t.components as MetaTemplateComponent[]) : [],
    }));
    return { ok: true, templates };
  } catch {
    return { ok: false, templates: [], error: 'Could not reach WhatsApp. Please try again.' };
  }
}

/**
 * Rebuild a create payload from an existing template's components (PURE).
 *
 * Carries over BODY / TEXT-HEADER / FOOTER / BUTTONS (quick-reply, URL, phone)
 * with their examples so the recreated template matches the source. Media
 * (document/image/video) headers can't be auto-cloned — their example needs a
 * freshly uploaded media handle on the target WABA — so those return a
 * skipReason for the caller to surface ("create manually").
 */
export function metaTemplateToCreatePayload(
  t: MetaTemplateFull,
  opts?: { documentHeaderHandle?: string }
): { payload?: CreateTemplatePayload; skipReason?: string } {
  const components: CreateComponent[] = [];

  for (const c of t.components || []) {
    const type = (c.type || '').toUpperCase();

    if (type === 'HEADER') {
      const format = (c.format || 'TEXT').toUpperCase();
      if (format !== 'TEXT') {
        // A document header can be recreated when the caller has uploaded a
        // sample and passed its handle; other media (image/video) still can't.
        if (format === 'DOCUMENT' && opts?.documentHeaderHandle) {
          components.push({ type: 'HEADER', format: 'DOCUMENT', example: { header_handle: [opts.documentHeaderHandle] } });
          continue;
        }
        return {
          skipReason: `has a ${format.toLowerCase()} header — create this template manually (media headers can't be auto-cloned)`,
        };
      }
      const header: CreateComponent = { type: 'HEADER', format: 'TEXT', text: c.text };
      if (c.example?.header_text?.length) header.example = { header_text: c.example.header_text };
      components.push(header);
    } else if (type === 'BODY') {
      const body: CreateComponent = { type: 'BODY', text: c.text };
      if (c.example?.body_text?.length) body.example = { body_text: c.example.body_text };
      components.push(body);
    } else if (type === 'FOOTER') {
      if (c.text) components.push({ type: 'FOOTER', text: c.text });
    } else if (type === 'BUTTONS') {
      const buttons: CreateButton[] = (c.buttons || []).map((b) => {
        const bt = (b.type || '').toUpperCase() as CreateButton['type'];
        const btn: CreateButton = { type: bt, text: b.text || '' };
        if (bt === 'URL') {
          btn.url = b.url;
          const hasVar = /\{\{\s*\d+\s*\}\}/.test(b.url || '');
          if (b.example?.length) btn.example = b.example;
          else if (hasVar) btn.example = [(b.url || '').replace(/\{\{\s*\d+\s*\}\}/g, 'sample')];
        } else if (bt === 'PHONE_NUMBER') {
          btn.phone_number = b.phone_number;
        }
        return btn;
      });
      if (buttons.length) components.push({ type: 'BUTTONS', buttons });
    }
    // Unknown component types are ignored.
  }

  if (!components.some((c) => c.type === 'BODY')) {
    return { skipReason: 'template has no body component' };
  }

  const category = (t.category || 'UTILITY').toUpperCase();
  const normalizedCategory: TemplateCategory =
    category === 'MARKETING' || category === 'AUTHENTICATION' ? (category as TemplateCategory) : 'UTILITY';

  return {
    payload: {
      name: normalizeTemplateName(t.name),
      category: normalizedCategory,
      language: t.language || 'en',
      components,
    },
  };
}
