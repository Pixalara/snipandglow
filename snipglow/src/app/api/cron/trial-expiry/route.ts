import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformCredentials } from '@/lib/whatsapp/config';
import { sendMessage } from '@/lib/whatsapp/templates';
import { getOwnerPhone } from '@/lib/whatsapp/notify-owner';

// =============================================================================
// Free-trial expiry alert — run once daily by external cron.
//
// Finds tenants whose 15-day free trial ends within the next ~24 hours and
// sends the salon owner a WhatsApp reminder (template `trial_expiry_v1`) so
// they can renew before losing access. Dedup via tenants.trial_expiry_alert_sent
// so each tenant is alerted at most once per trial window.
//
// Template `trial_expiry_v1` body params (in order):
//   {{1}} owner/salon name   {{2}} expiry date
// =============================================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const credentials = getPlatformCredentials();
  if (!credentials) {
    return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 500 });
  }

  const admin = createAdminClient();

  const now = new Date();
  // Window: trials ending between now and 24h from now (i.e. "expires tomorrow").
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const TRIAL_DAYS = 15;

  // All not-yet-alerted trials. We compute the effective end date in JS so this
  // works whether or not subscription_end was stamped (old trials fall back to
  // created_at + 15 days).
  const { data: candidates } = await (admin
    .from('tenants' as any)
    .select('id, name, owner_name, phone, subscription_status, subscription_start, subscription_end, created_at')
    .eq('subscription_status', 'trial')
    .eq('trial_expiry_alert_sent', false)
    .limit(500) as any);

  // Keep only trials whose effective end falls in the next ~24h.
  const tenants = (candidates ?? []).filter((t: any) => {
    let end: Date | null = t.subscription_end ? new Date(t.subscription_end) : null;
    if (!end) {
      const start = t.subscription_start ? new Date(t.subscription_start) : (t.created_at ? new Date(t.created_at) : null);
      if (start) {
        end = new Date(start);
        end.setDate(end.getDate() + TRIAL_DAYS);
      }
    }
    if (!end || isNaN(end.getTime())) return false;
    return end.getTime() > now.getTime() && end.getTime() <= in24h.getTime();
  });

  let sent = 0;
  let skipped = 0;

  for (const t of tenants) {
    try {
      const ownerPhone = await getOwnerPhone(admin, t.id);
      if (!ownerPhone) { skipped++; continue; }

      const name = ((t.owner_name as string) || (t.name as string) || 'there').trim();
      // Resolve the effective end again for the label.
      let end: Date = t.subscription_end ? new Date(t.subscription_end) : new Date(t.subscription_start || t.created_at);
      if (!t.subscription_end) end.setDate(end.getDate() + TRIAL_DAYS);
      const expiryLabel = end.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

      const result = await sendMessage(credentials, ownerPhone, {
        type: 'template',
        template: {
          name: 'trial_expiry_v1',
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: name },
                { type: 'text', text: expiryLabel },
              ],
            },
          ],
        },
      });

      // Mark as alerted regardless of send result so a transient failure doesn't
      // spam on the next run; an unsent alert is logged for follow-up.
      await (admin.from('tenants' as any).update({ trial_expiry_alert_sent: true }).eq('id', t.id) as any);

      if (result.success) sent++;
      else { skipped++; console.error('[TrialExpiry] send failed for', t.id, result.error); }
    } catch (err) {
      console.error('[TrialExpiry] error for tenant', t.id, err);
      skipped++;
    }
  }

  return NextResponse.json({ status: 'ok', sent, skipped, checked: tenants.length });
}
