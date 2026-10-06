// =============================================================================
// WhatsApp template MIRROR store (whatsapp_templates).
//
// Persists the tenant's marketing templates locally so the composer can show
// them (and their live approval status) without a Graph API round-trip or
// exposing the tenant's token to the browser. Written only by the service-role
// admin client — the submit server action inserts on create, and the webhook
// updates the status when Meta reports the review verdict.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type { TemplateStatus } from './template-management';

const TABLE = 'whatsapp_templates';

/** A shared carousel button, as stored in the `buttons` JSONB column. */
export interface StoredCarouselButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string | null;
  phone_number?: string | null;
}

/** A carousel card, as stored in the `cards` JSONB column (order = card order). */
export interface StoredCarouselCard {
  image_url: string;
  body_text: string;
}

export interface TemplateRow {
  id: string;
  tenant_id: string;
  name: string;
  language: string;
  category: string;
  status: TemplateStatus;
  template_type: 'standard' | 'carousel';
  body_text: string;
  header_text: string | null;
  header_image_url: string | null;
  footer_text: string | null;
  example_params: string[];
  cards: StoredCarouselCard[] | null;
  buttons: StoredCarouselButton[] | null;
  meta_template_id: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  'id, tenant_id, name, language, category, status, template_type, body_text, header_text, header_image_url, footer_text, example_params, cards, buttons, meta_template_id, rejection_reason, created_at, updated_at';

/** All templates for a tenant, newest first. */
export async function listTenantTemplates(tenantId: string): Promise<TemplateRow[]> {
  if (!tenantId) return [];
  const admin = createAdminClient();
  const { data } = await (admin
    .from(TABLE as any)
    .select(COLUMNS)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false }) as any);
  return (data as TemplateRow[]) ?? [];
}

export interface SubmittedTemplateInput {
  name: string;
  language: string;
  category: string;
  bodyText: string;
  headerText?: string | null;
  headerImageUrl?: string | null;
  footerText?: string | null;
  exampleParams: string[];
  status: TemplateStatus;
  metaTemplateId?: string | null;
  /** 'standard' (default) or 'carousel'. */
  templateType?: 'standard' | 'carousel';
  /** Carousel only: ordered cards. */
  cards?: StoredCarouselCard[] | null;
  /** Carousel only: shared buttons. */
  buttons?: StoredCarouselButton[] | null;
}

/**
 * Persist a just-submitted template. Because (tenant_id, name, language) is
 * unique, re-submitting the same template name UPDATES the existing row (resets
 * it to the new status and clears any prior rejection reason) rather than
 * failing — Meta itself treats a re-create of the same name as an update.
 */
export async function upsertSubmittedTemplate(
  tenantId: string,
  input: SubmittedTemplateInput
): Promise<TemplateRow | null> {
  if (!tenantId) throw new Error('upsertSubmittedTemplate: tenantId is required');
  const admin = createAdminClient();

  const row = {
    tenant_id: tenantId,
    name: input.name,
    language: input.language,
    category: input.category,
    status: input.status,
    template_type: input.templateType ?? 'standard',
    body_text: input.bodyText,
    header_text: input.headerText ?? null,
    header_image_url: input.headerImageUrl ?? null,
    footer_text: input.footerText ?? null,
    example_params: input.exampleParams,
    cards: input.cards ?? null,
    buttons: input.buttons ?? null,
    meta_template_id: input.metaTemplateId ?? null,
    rejection_reason: null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await (admin
    .from(TABLE as any)
    .upsert(row, { onConflict: 'tenant_id,name,language' })
    .select(COLUMNS)
    .single() as any);

  if (error) {
    throw new Error(`upsertSubmittedTemplate: ${error.message}`);
  }
  return (data as TemplateRow) ?? null;
}

/**
 * Update a template's status from a Meta webhook. Resolves the row by Meta's
 * template id when present (most reliable), else by (name, language). Returns
 * true when a row was updated. `rejectionReason` is only meaningful for REJECTED.
 */
export async function updateTemplateStatus(input: {
  metaTemplateId?: string | null;
  name?: string | null;
  language?: string | null;
  status: TemplateStatus;
  rejectionReason?: string | null;
}): Promise<boolean> {
  const admin = createAdminClient();

  const patch = {
    status: input.status,
    rejection_reason: input.status === 'REJECTED' ? input.rejectionReason ?? null : null,
    updated_at: new Date().toISOString(),
  };

  let query = admin.from(TABLE as any).update(patch);

  if (input.metaTemplateId) {
    query = query.eq('meta_template_id', String(input.metaTemplateId));
  } else if (input.name) {
    query = query.eq('name', input.name);
    if (input.language) query = query.eq('language', input.language);
  } else {
    return false;
  }

  const { data, error } = await (query.select('id') as any);
  if (error) {
    console.error('[WA Templates] status update failed:', error.message);
    return false;
  }
  const affected = Array.isArray(data) ? data.length : data ? 1 : 0;
  return affected > 0;
}

/** Fetch a single template row by id, scoped to the tenant (null if not found). */
export async function getTenantTemplateById(
  tenantId: string,
  id: string
): Promise<TemplateRow | null> {
  if (!tenantId || !id) return null;
  const admin = createAdminClient();
  const { data } = await (admin
    .from(TABLE as any)
    .select(COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle() as any);
  return (data as TemplateRow) ?? null;
}

/**
 * Delete a template row, scoped to the tenant. Returns true when a row was
 * removed. Used for discarding local DRAFT carousels (callers gate this to
 * DRAFT rows — deleting a submitted template here would NOT remove it on Meta).
 */
export async function deleteTenantTemplate(tenantId: string, id: string): Promise<boolean> {
  if (!tenantId || !id) return false;
  const admin = createAdminClient();
  const { data, error } = await (admin
    .from(TABLE as any)
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('id') as any);
  if (error) {
    console.error('[WA Templates] delete failed:', error.message);
    return false;
  }
  return Array.isArray(data) ? data.length > 0 : !!data;
}
