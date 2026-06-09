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

  // Trials on the free plan, not yet alerted, ending within the next 24 hours.
  const { data: tenants } = await (admin
    .from('tenants' as any)
    .select('id, name, owner_name, phone, subscription_status, subscription_end')
    .eq('subscription_status', 'trial')
    .eq('trial_expiry_alert_sent', false)
    .not('subscription_end', 'is', null)
    .gt('subscription_end', now.toISOString())
    .lte('subscription_end', in24h.toISOString())
    .limit(100) as any);

  let sent = 0;
  let skipped = 0;

  for (const t of tenants ?? []) {
    try {
      const ownerPhone = await getOwnerPhone(admin, t.id);
      if (!ownerPhone) { skipped++; continue; }

      const name = ((t.owner_name as string) || (t.name as string) || 'there').trim();
      const expiryLabel = new Date(t.subscription_end).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      });

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

  return NextResponse.json({ status: 'ok', sent, skipped, checked: (tenants ?? []).length });
}
