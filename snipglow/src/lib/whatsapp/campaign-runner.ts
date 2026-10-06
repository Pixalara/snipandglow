// =============================================================================
// WhatsApp campaign runner — the shared, race-safe batch sender.
//
// A campaign (whatsapp_campaigns) has a ledger of recipients
// (whatsapp_campaign_recipients). Draining = claim a small batch of `pending`
// recipients atomically, send each the campaign's approved template, and record
// the per-recipient outcome. Two things drain a campaign:
//   1. the owner's progress screen (nudgeCampaign server action), and
//   2. the background cron (/api/cron/campaign-drip).
// Both call processCampaignBatch(), which claims via claim_campaign_recipients
// (FOR UPDATE SKIP LOCKED) so a recipient is NEVER sent twice even if both run
// at once. All writes use the service-role admin client.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { getDedicatedCredentialsForTenant } from '@/lib/whatsapp/tenant-router';
import { getTenantTemplateById, type TemplateRow } from '@/lib/whatsapp/template-store';
import { sendMessage } from '@/lib/whatsapp/templates';

/** Recipients stuck in 'processing' longer than this (a crashed drainer) are
 *  reclaimed to 'pending' so the campaign can always finish. */
const STALE_PROCESSING_MINUTES = 5;

/** Pause between sends — keeps throughput well under Meta's per-second ceiling. */
const SEND_SPACING_MS = 60;

export type CampaignStatus =
  | 'draft'
  | 'sending'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface CampaignProgress {
  id: string;
  tenantId: string;
  templateName: string;
  status: CampaignStatus;
  audienceLabel: string | null;
  total: number;
  sent: number;
  failed: number;
  pending: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface CampaignRow {
  id: string;
  tenant_id: string;
  template_id: string | null;
  template_name: string;
  status: CampaignStatus;
  variable_values: unknown;
  personalize_indexes: unknown;
  audience_label: string | null;
  total_count: number;
  sent_count: number;
  failed_count: number;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

interface ClaimedRecipient {
  id: string;
  customer_id: string | null;
  name: string | null;
  phone: string;
}

/** Count of {{n}} placeholders in a template body. */
function placeholderCount(body: string): number {
  return new Set([...body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1]))).size;
}

/**
 * Build the per-recipient template components, mirroring the single-send path:
 * carousel = optional message-bubble body vars + a carousel of image cards;
 * standard = optional IMAGE-header banner + body vars. Personalized variables
 * use the customer's own name; the rest use the campaign's fixed values.
 */
function buildComponents(
  tpl: TemplateRow,
  count: number,
  personalize: Set<number>,
  values: string[],
  recipientName: string | null
): Array<Record<string, unknown>> {
  const parameters = Array.from({ length: count }, (_, i) => ({
    type: 'text',
    text: personalize.has(i) ? (recipientName || 'there') : (values[i] ?? '').trim(),
  }));

  const components: Array<Record<string, unknown>> = [];
  const isCarousel = (tpl.template_type ?? 'standard') === 'carousel';

  if (isCarousel) {
    const cards = tpl.cards ?? [];
    if (count > 0) components.push({ type: 'body', parameters });
    components.push({
      type: 'carousel',
      cards: cards.map((card, idx) => ({
        card_index: idx,
        components: [
          { type: 'header', parameters: [{ type: 'image', image: { link: card.image_url } }] },
        ],
      })),
    });
  } else {
    if (tpl.header_image_url) {
      components.push({ type: 'header', parameters: [{ type: 'image', image: { link: tpl.header_image_url } }] });
    }
    if (count > 0) components.push({ type: 'body', parameters });
  }

  return components;
}

type Admin = ReturnType<typeof createAdminClient>;

/** Live sent / failed / still-outstanding counts for a campaign. */
async function liveCounts(admin: Admin, campaignId: string): Promise<{ sent: number; failed: number; pending: number }> {
  const base = () => (admin.from('whatsapp_campaign_recipients' as any).select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId) as any);
  const [{ count: sent }, { count: failed }, { count: pending }] = await Promise.all([
    base().eq('status', 'sent'),
    base().eq('status', 'failed'),
    base().in('status', ['pending', 'processing']),
  ]);
  return { sent: sent ?? 0, failed: failed ?? 0, pending: pending ?? 0 };
}

function toProgress(row: CampaignRow, counts: { sent: number; failed: number; pending: number }): CampaignProgress {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    templateName: row.template_name,
    status: row.status,
    audienceLabel: row.audience_label,
    total: row.total_count,
    sent: counts.sent,
    failed: counts.failed,
    pending: counts.pending,
    error: row.error,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

async function loadCampaign(admin: Admin, campaignId: string): Promise<CampaignRow | null> {
  const { data } = await (admin
    .from('whatsapp_campaigns' as any)
    .select('id, tenant_id, template_id, template_name, status, variable_values, personalize_indexes, audience_label, total_count, sent_count, failed_count, error, created_at, completed_at')
    .eq('id', campaignId)
    .single() as any);
  return (data as CampaignRow) ?? null;
}

async function failCampaign(admin: Admin, campaignId: string, error: string): Promise<void> {
  await (admin
    .from('whatsapp_campaigns' as any)
    .update({ status: 'failed', error, updated_at: new Date().toISOString(), completed_at: new Date().toISOString() })
    .eq('id', campaignId) as any);
}

/**
 * Claim and send up to `limit` pending recipients of one campaign. Safe to call
 * concurrently and repeatedly. Returns the campaign's live progress, or null if
 * the campaign does not exist. Only acts when the campaign is 'sending';
 * otherwise it just reports current progress.
 */
export async function processCampaignBatch(campaignId: string, limit: number): Promise<CampaignProgress | null> {
  const admin = createAdminClient();

  const campaign = await loadCampaign(admin, campaignId);
  if (!campaign) return null;

  if (campaign.status !== 'sending') {
    return toProgress(campaign, await liveCounts(admin, campaignId));
  }

  // Reclaim recipients abandoned by a crashed drainer.
  const staleCutoff = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60_000).toISOString();
  await (admin
    .from('whatsapp_campaign_recipients' as any)
    .update({ status: 'pending', claimed_at: null })
    .eq('campaign_id', campaignId)
    .eq('status', 'processing')
    .lt('claimed_at', staleCutoff) as any);

  // The campaign can only send from the tenant's own connected number.
  const credentials = await getDedicatedCredentialsForTenant(campaign.tenant_id);
  if (!credentials) {
    await failCampaign(admin, campaignId, 'not_connected');
    const row = await loadCampaign(admin, campaignId);
    return row ? toProgress(row, await liveCounts(admin, campaignId)) : null;
  }

  // The template must still exist locally AND be approved by Meta.
  const tpl = campaign.template_id ? await getTenantTemplateById(campaign.tenant_id, campaign.template_id) : null;
  if (!tpl || tpl.status !== 'APPROVED') {
    await failCampaign(admin, campaignId, 'template_unavailable');
    const row = await loadCampaign(admin, campaignId);
    return row ? toProgress(row, await liveCounts(admin, campaignId)) : null;
  }

  const isCarousel = (tpl.template_type ?? 'standard') === 'carousel';
  if (isCarousel) {
    const cards = tpl.cards ?? [];
    if (cards.length < 2 || cards.some((c) => !c.image_url)) {
      await failCampaign(admin, campaignId, 'carousel_invalid');
      const row = await loadCampaign(admin, campaignId);
      return row ? toProgress(row, await liveCounts(admin, campaignId)) : null;
    }
  }

  const count = placeholderCount(tpl.body_text);
  const personalize = new Set((Array.isArray(campaign.personalize_indexes) ? campaign.personalize_indexes : []).map(Number));
  const values = (Array.isArray(campaign.variable_values) ? campaign.variable_values : []) as string[];

  // Atomically claim this worker's batch (function not in generated types).
  const { data: claimed } = await ((admin as any).rpc('claim_campaign_recipients', {
    p_campaign_id: campaignId,
    p_limit: Math.max(limit, 0),
  }));

  const recipients = (claimed ?? []) as ClaimedRecipient[];

  for (const r of recipients) {
    const phoneDigits = (r.phone || '').replace(/\D/g, '');
    let res: { success: boolean; messageId?: string; error?: string };

    if (!phoneDigits) {
      res = { success: false, error: 'invalid_phone' };
    } else {
      res = await sendMessage(credentials, phoneDigits, {
        type: 'template',
        template: {
          name: tpl.name,
          language: { code: tpl.language || 'en' },
          components: buildComponents(tpl, count, personalize, values, r.name),
        },
      });
    }

    await (admin
      .from('whatsapp_campaign_recipients' as any)
      .update({
        status: res.success ? 'sent' : 'failed',
        message_id: res.messageId ?? null,
        error: res.error ?? null,
        sent_at: new Date().toISOString(),
      })
      .eq('id', r.id) as any);

    // Mirror into whatsapp_sessions for cost tracking + unified history.
    try {
      await (admin.from('whatsapp_sessions').insert({
        tenant_id: campaign.tenant_id,
        message_id: res.messageId || `campaign_${campaignId}_${r.id}`,
        phone: phoneDigits,
        direction: 'outbound',
        template_name: tpl.name,
        status: res.success ? 'sent' : 'failed',
        error_details: res.error ?? null,
        metadata: { customer_name: r.name, campaign: true, campaign_id: campaignId, error: res.error ?? null },
      } as any) as any);
    } catch {
      /* logging is best-effort */
    }

    if (phoneDigits) await new Promise((resolve) => setTimeout(resolve, SEND_SPACING_MS));
  }

  // Recompute totals and finish the campaign when nothing is outstanding.
  const counts = await liveCounts(admin, campaignId);
  const patch: Record<string, unknown> = {
    sent_count: counts.sent,
    failed_count: counts.failed,
    updated_at: new Date().toISOString(),
  };
  if (counts.pending === 0) {
    patch.status = 'completed';
    patch.completed_at = new Date().toISOString();
  }
  await (admin.from('whatsapp_campaigns' as any).update(patch).eq('id', campaignId) as any);

  const updated = await loadCampaign(admin, campaignId);
  return updated ? toProgress(updated, counts) : null;
}
