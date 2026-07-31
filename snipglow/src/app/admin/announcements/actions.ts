'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, logAdminAction } from '@/lib/admin/auth';
import { isEmailConfigured, missingEmailEnv, sendEmail } from '@/lib/email/smtp';
import { renderAnnouncementEmail, DEFAULT_CAMPAIGN, type AnnouncementCampaign } from '@/lib/email/announcement';

// =============================================================================
// Admin — feature announcement emails
// Pulls tenant owner emails directly from Supabase (auth users + tenants) and
// sends the branded Customer Wallet announcement to selected tenants.
// =============================================================================

export interface Recipient {
  tenantId: string;
  salonName: string;
  email: string;
  plan: string | null;
  status: string | null;
  /** 'account' = owner login email, 'settings' = salon contact email fallback. */
  source: 'account' | 'settings';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Real, mailable address (skips the synthetic phone/staff login emails). */
function isRealEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (!EMAIL_RE.test(e)) return false;
  if (e.endsWith('@phone.snipandglow.com')) return false;
  if (e.endsWith('@staff.snipandglow.com')) return false;
  return true;
}

/** Map of tenantId -> owner login email (real emails only). */
async function getOwnerEmailsByTenant(admin: ReturnType<typeof createAdminClient>): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  let page = 1;
  const perPage = 1000;
  // Paginate through auth users.
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) break;
    for (const u of data.users) {
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const role = meta.role as string | undefined;
      const tenantId = meta.tenant_id as string | undefined;
      if (!tenantId) continue;
      // Prefer the owner's real email; don't overwrite an owner with a manager.
      if (role === 'owner' && isRealEmail(u.email) && !map[tenantId]) {
        map[tenantId] = (u.email as string).toLowerCase().trim();
      }
    }
    if (data.users.length < perPage) break;
    page += 1;
  }
  return map;
}

/**
 * Build the full recipient list from Supabase: every tenant that has a real,
 * mailable email (owner login email preferred, salon contact email as fallback).
 */
export async function getWalletRecipients(): Promise<{ configured: boolean; missingEnv: string[]; recipients: Recipient[] }> {
  await requireAdmin();
  const admin = createAdminClient();

  const [{ data: tenants }, ownerEmails] = await Promise.all([
    (admin
      .from('tenants' as any)
      .select('id, name, plan_tier, subscription_status, settings')
      .order('created_at', { ascending: false }) as any),
    getOwnerEmailsByTenant(admin),
  ]);

  const recipients: Recipient[] = [];
  for (const t of (tenants ?? []) as any[]) {
    const ownerEmail = ownerEmails[t.id];
    const settingsEmail = (t.settings as Record<string, unknown> | null)?.email as string | undefined;
    let email: string | null = null;
    let source: 'account' | 'settings' = 'account';
    if (isRealEmail(ownerEmail)) {
      email = ownerEmail;
      source = 'account';
    } else if (isRealEmail(settingsEmail)) {
      email = settingsEmail!.toLowerCase().trim();
      source = 'settings';
    }
    if (!email) continue;
    recipients.push({
      tenantId: t.id,
      salonName: t.name || 'Salon',
      email,
      plan: t.plan_tier ?? null,
      status: t.subscription_status ?? null,
      source,
    });
  }

  return { configured: isEmailConfigured(), missingEnv: missingEmailEnv(), recipients };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Coerce/validate a campaign coming from the client; falls back to defaults. */
function normalizeCampaign(c: Partial<AnnouncementCampaign> | undefined): AnnouncementCampaign {
  const src = c ?? {};
  const bullets = Array.isArray(src.bullets)
    ? src.bullets
        .slice(0, 8)
        .map((b) => ({ title: String(b?.title ?? '').slice(0, 120), body: String(b?.body ?? '').slice(0, 300) }))
        .filter((b) => b.title || b.body)
    : DEFAULT_CAMPAIGN.bullets;
  return {
    subject: (src.subject ?? '').trim().slice(0, 200) || DEFAULT_CAMPAIGN.subject,
    eyebrow: (src.eyebrow ?? '').trim().slice(0, 80),
    headline: (src.headline ?? '').trim().slice(0, 160) || DEFAULT_CAMPAIGN.headline,
    greeting: (src.greeting ?? '').trim().slice(0, 120) || DEFAULT_CAMPAIGN.greeting,
    intro: (src.intro ?? '').trim().slice(0, 600) || DEFAULT_CAMPAIGN.intro,
    bullets,
    ctaLabel: (src.ctaLabel ?? '').trim().slice(0, 60) || DEFAULT_CAMPAIGN.ctaLabel,
    ctaUrl: (src.ctaUrl ?? '').trim().slice(0, 400) || DEFAULT_CAMPAIGN.ctaUrl,
    footerNote: (src.footerNote ?? '').trim().slice(0, 200) || undefined,
    // Only known enum values are allowed through (never raw client markup).
    partnerBadge: src.partnerBadge === 'razorpay' ? 'razorpay' : undefined,
    theme: src.theme === 'reminder' ? 'reminder' : 'brand',
    headerTag: (src.headerTag ?? '').trim().slice(0, 40) || undefined,
  };
}

/**
 * Send a feature announcement using the provided (editable) campaign content.
 * - testEmail set  → sends ONE preview to that address (ignores tenantIds).
 * - otherwise      → sends to the selected tenantIds (emails re-resolved server-side).
 */
export async function sendAnnouncement(input: {
  tenantIds?: string[];
  testEmail?: string;
  campaign?: Partial<AnnouncementCampaign>;
}): Promise<{ success: boolean; error?: string; sent: number; failed: number; results?: { email: string; ok: boolean; detail?: string }[] }> {
  const user = await requireAdmin();

  if (!isEmailConfigured()) {
    return { success: false, error: 'Email is not configured. Set SMTP_EMAIL and SMTP_PASSWORD.', sent: 0, failed: 0 };
  }

  const campaign = normalizeCampaign(input.campaign);

  // ── Test mode ────────────────────────────────────────────────────────────
  if (input.testEmail) {
    const to = input.testEmail.trim();
    if (!EMAIL_RE.test(to)) return { success: false, error: 'Enter a valid test email.', sent: 0, failed: 0 };
    const { subject, html, text } = renderAnnouncementEmail(campaign, { salonName: 'Your Salon' });
    try {
      await sendEmail({ to, subject, html, text });
      return { success: true, sent: 1, failed: 0, results: [{ email: to, ok: true }] };
    } catch (e) {
      return { success: false, error: 'Failed to send test email.', sent: 0, failed: 1, results: [{ email: to, ok: false, detail: String((e as Error).message) }] };
    }
  }

  // ── Bulk send to selected tenants ──────────────────────────────────────────
  const ids = [...new Set(input.tenantIds ?? [])];
  if (ids.length === 0) return { success: false, error: 'Select at least one tenant.', sent: 0, failed: 0 };

  // Re-resolve emails server-side (never trust the client with recipient emails).
  const { recipients } = await getWalletRecipients();
  const byId = new Map(recipients.map((r) => [r.tenantId, r]));
  const targets = ids.map((id) => byId.get(id)).filter(Boolean) as Recipient[];

  if (targets.length === 0) return { success: false, error: 'No mailable recipients in the selection.', sent: 0, failed: 0 };

  const results: { email: string; ok: boolean; detail?: string }[] = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const r = targets[i];
    const { subject, html, text } = renderAnnouncementEmail(campaign, { salonName: r.salonName });
    try {
      await sendEmail({ to: r.email, subject, html, text });
      results.push({ email: r.email, ok: true });
      sent += 1;
    } catch (e) {
      results.push({ email: r.email, ok: false, detail: String((e as Error).message) });
      failed += 1;
    }
    if (i < targets.length - 1) await sleep(250); // polite throttle
  }

  // Persist a reviewable campaign record + per-recipient results (best-effort),
  // then log the admin action referencing that campaign id.
  let campaignId: string | null = null;
  try {
    const admin = createAdminClient();
    const { data: row } = await (admin
      .from('email_campaigns' as any)
      .insert({
        subject: campaign.subject,
        campaign: campaign as any,
        mode: 'bulk',
        sent_by: user.email || null,
        total_count: targets.length,
        sent_count: sent,
        failed_count: failed,
      } as any)
      .select('id')
      .single() as any);
    if (row?.id) {
      campaignId = row.id;
      const rows = targets.map((t, i) => ({
        campaign_id: row.id,
        tenant_id: t.tenantId,
        salon_name: t.salonName,
        email: t.email,
        status: results[i]?.ok ? 'sent' : 'failed',
        detail: results[i]?.detail ?? null,
      }));
      await (admin.from('email_campaign_recipients' as any).insert(rows as any) as any);
    }
  } catch (e) {
    console.error('[Announcements] Failed to persist campaign history (non-fatal):', e);
  }

  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'send_announcement',
    targetType: 'email_campaign',
    targetId: campaignId ?? undefined,
    metadata: { campaignId, subject: campaign.subject, selected: ids.length, sent, failed },
  });

  return { success: failed === 0, sent, failed, results, error: failed > 0 ? `${failed} email(s) failed.` : undefined };
}

// =============================================================================
// Campaign history (persistent, admin-only)
// =============================================================================

export interface CampaignSummary {
  id: string;
  subject: string;
  mode: string;
  sentBy: string | null;
  total: number;
  sent: number;
  failed: number;
  createdAt: string;
}

export interface CampaignRecipientRow {
  email: string;
  salonName: string | null;
  status: string;
  detail: string | null;
}

/** Recent campaigns, newest first. */
export async function getCampaignHistory(limit = 25): Promise<CampaignSummary[]> {
  await requireAdmin();
  try {
    const admin = createAdminClient();
    const { data } = await (admin
      .from('email_campaigns' as any)
      .select('id, subject, mode, sent_by, total_count, sent_count, failed_count, created_at')
      .order('created_at', { ascending: false })
      .limit(limit) as any);
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      subject: r.subject,
      mode: r.mode,
      sentBy: r.sent_by,
      total: r.total_count ?? 0,
      sent: r.sent_count ?? 0,
      failed: r.failed_count ?? 0,
      createdAt: r.created_at,
    }));
  } catch {
    return [];
  }
}

/** Per-recipient results for one campaign. */
export async function getCampaignRecipients(campaignId: string): Promise<CampaignRecipientRow[]> {
  await requireAdmin();
  try {
    const admin = createAdminClient();
    const { data } = await (admin
      .from('email_campaign_recipients' as any)
      .select('email, salon_name, status, detail')
      .eq('campaign_id', campaignId)
      .order('status', { ascending: true }) as any);
    return ((data ?? []) as any[]).map((r) => ({
      email: r.email,
      salonName: r.salon_name,
      status: r.status,
      detail: r.detail,
    }));
  } catch {
    return [];
  }
}

/**
 * Resolve a campaign's recipients from an audit-log entry: by campaign id when
 * available, otherwise by matching subject + nearest timestamp (older logs that
 * predate campaign-id linking).
 */
export async function findCampaignRecipients(input: {
  campaignId?: string | null;
  subject?: string | null;
  at?: string | null;
}): Promise<CampaignRecipientRow[]> {
  await requireAdmin();
  try {
    const admin = createAdminClient();
    let id = input.campaignId || null;

    if (!id && input.subject) {
      const { data } = await (admin
        .from('email_campaigns' as any)
        .select('id, created_at')
        .eq('subject', input.subject)
        .order('created_at', { ascending: false })
        .limit(10) as any);
      const rows = (data ?? []) as { id: string; created_at: string }[];
      if (rows.length) {
        if (input.at) {
          const t = new Date(input.at).getTime();
          rows.sort(
            (a, b) => Math.abs(new Date(a.created_at).getTime() - t) - Math.abs(new Date(b.created_at).getTime() - t)
          );
        }
        id = rows[0].id;
      }
    }
    if (!id) return [];
    return await getCampaignRecipients(id);
  } catch {
    return [];
  }
}
