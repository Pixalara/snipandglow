'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin, logAdminAction } from '@/lib/admin/auth';
import { isEmailConfigured, sendEmail } from '@/lib/email/smtp';
import { renderWalletEmail } from '@/lib/email/wallet-announcement';

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
export async function getWalletRecipients(): Promise<{ configured: boolean; recipients: Recipient[] }> {
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

  return { configured: isEmailConfigured(), recipients };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Send the Customer Wallet announcement.
 * - testEmail set  → sends ONE preview to that address (ignores tenantIds).
 * - otherwise      → sends to the selected tenantIds (emails re-resolved server-side).
 */
export async function sendWalletAnnouncement(input: {
  tenantIds?: string[];
  testEmail?: string;
}): Promise<{ success: boolean; error?: string; sent: number; failed: number; results?: { email: string; ok: boolean; detail?: string }[] }> {
  const user = await requireAdmin();

  if (!isEmailConfigured()) {
    return { success: false, error: 'Email is not configured. Set SMTP_EMAIL and SMTP_PASSWORD.', sent: 0, failed: 0 };
  }

  // ── Test mode ────────────────────────────────────────────────────────────
  if (input.testEmail) {
    const to = input.testEmail.trim();
    if (!EMAIL_RE.test(to)) return { success: false, error: 'Enter a valid test email.', sent: 0, failed: 0 };
    const { subject, html, text } = renderWalletEmail({ salonName: 'Your Salon' });
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
    const { subject, html, text } = renderWalletEmail({ salonName: r.salonName });
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

  await logAdminAction({
    adminUserId: user.id,
    adminEmail: user.email || '',
    action: 'send_announcement',
    targetType: 'email_campaign',
    metadata: { campaign: 'customer_wallet', selected: ids.length, sent, failed },
  });

  return { success: failed === 0, sent, failed, results, error: failed > 0 ? `${failed} email(s) failed.` : undefined };
}
