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

export interface TemplateRow {
  id: string;
  tenant_id: string;
  name: string;
  language: string;
  category: string;
  status: TemplateStatus;
  body_text: string;
  header_text: string | null;
  footer_text: string | null;
  example_params: string[];
  meta_template_id: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  'id, tenant_id, name, language, category, status, body_text, header_text, footer_text, example_params, meta_template_id, rejection_reason, created_at, updated_at';

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
  footerText?: string | null;
  exampleParams: string[];
  status: TemplateStatus;
  metaTemplateId?: string | null;
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
    body_text: input.bodyText,
    header_text: input.headerText ?? null,
    footer_text: input.footerText ?? null,
    example_params: input.exampleParams,
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
