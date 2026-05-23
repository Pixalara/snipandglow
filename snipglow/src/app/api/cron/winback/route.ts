import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformCredentials } from '@/lib/whatsapp/config';
import { sendMessage } from '@/lib/whatsapp/templates';

// =============================================================================
// Winback Messages — Called every 30 minutes by external cron
// Sends renewal_reminder (30 days) and winback_60_day (60 days) templates
// to customers who haven't visited in a while.
//
// Dedup: Checks whatsapp_sessions for existing winback messages sent to
// the same customer within the last 25 days (avoids re-sending).
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

  // Get IST date
  const nowIST = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata', hour12: false });
  const [todayDate] = nowIST.split(', ');

  // Calculate date thresholds
  const today = new Date(todayDate + 'T12:00:00+05:30');

  // 30-day window: customers whose last_visit_at is between 29-31 days ago
  const day30Start = new Date(today);
  day30Start.setDate(day30Start.getDate() - 31);
  const day30End = new Date(today);
  day30End.setDate(day30End.getDate() - 29);

  // 60-day window: customers whose last_visit_at is between 59-61 days ago
  const day60Start = new Date(today);
  day60Start.setDate(day60Start.getDate() - 61);
  const day60End = new Date(today);
  day60End.setDate(day60End.getDate() - 59);

  const day30StartStr = day30Start.toISOString();
  const day30EndStr = day30End.toISOString();
  const day60StartStr = day60Start.toISOString();
  const day60EndStr = day60End.toISOString();

  // Dedup window: don't send if we already sent a winback in the last 25 days
  const dedupCutoff = new Date(today);
  dedupCutoff.setDate(dedupCutoff.getDate() - 25);
  const dedupCutoffStr = dedupCutoff.toISOString();

  let sent30d = 0;
  let sent60d = 0;

  // ─── 30-DAY WINBACK (renewal_reminder) ──────────────────────────────────
  const { data: customers30d } = await admin
    .from('customers')
    .select('id, name, phone, tenant_id, last_visit_at')
    .gte('last_visit_at', day30StartStr)
    .lte('last_visit_at', day30EndStr)
    .not('phone', 'is', null)
    .limit(50);

  for (const customer of customers30d ?? []) {
    try {
      if (!customer.phone) continue;
      const phone = customer.phone.replace(/\D/g, '');
      if (!phone || phone.length < 10) continue;

      // Check dedup: already sent winback to this phone recently?
      const { count } = await (admin
        .from('whatsapp_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('phone', phone)
        .eq('template_name', 'renewal_reminder')
        .gte('created_at', dedupCutoffStr) as any);

      if ((count ?? 0) > 0) continue;

      // Get salon name
      const { data: tenant } = await (admin.from('tenants' as any).select('name').eq('id', customer.tenant_id).single() as any);
      const salonName = ((tenant?.name as string) || '').trim();
      if (!salonName) continue;

      // Send renewal_reminder template
      await sendMessage(credentials, phone, {
        type: 'template',
        template: {
          name: 'renewal_reminder',
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: customer.name },
                { type: 'text', text: salonName },
              ],
            },
          ],
        },
      });

      // Log to whatsapp_sessions
      await (admin.from('whatsapp_sessions').insert({
        tenant_id: customer.tenant_id,
        message_id: `winback30_${Date.now()}_${phone}`,
        phone,
        direction: 'outbound',
        template_name: 'renewal_reminder',
        status: 'sent',
        metadata: { customer_name: customer.name, customer_id: customer.id, type: 'winback_30d' },
      } as any) as any);

      sent30d++;
    } catch (err) {
      console.error('[Winback] 30d error for customer:', customer.id, err);
    }
  }

  // ─── 60-DAY WINBACK (winback_60_day) ────────────────────────────────────
  const { data: customers60d } = await admin
    .from('customers')
    .select('id, name, phone, tenant_id, last_visit_at')
    .gte('last_visit_at', day60StartStr)
    .lte('last_visit_at', day60EndStr)
    .not('phone', 'is', null)
    .limit(50);

  for (const customer of customers60d ?? []) {
    try {
      if (!customer.phone) continue;
      const phone = customer.phone.replace(/\D/g, '');
      if (!phone || phone.length < 10) continue;

      // Check dedup: already sent 60-day winback to this phone recently?
      const { count } = await (admin
        .from('whatsapp_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('phone', phone)
        .eq('template_name', 'winback_60_day')
        .gte('created_at', dedupCutoffStr) as any);

      if ((count ?? 0) > 0) continue;

      // Get salon name
      const { data: tenant } = await (admin.from('tenants' as any).select('name').eq('id', customer.tenant_id).single() as any);
      const salonName = ((tenant?.name as string) || '').trim();
      if (!salonName) continue;

      // Send winback_60_day template
      await sendMessage(credentials, phone, {
        type: 'template',
        template: {
          name: 'winback_60_day',
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: customer.name },
                { type: 'text', text: salonName },
              ],
            },
          ],
        },
      });

      // Log to whatsapp_sessions
      await (admin.from('whatsapp_sessions').insert({
        tenant_id: customer.tenant_id,
        message_id: `winback60_${Date.now()}_${phone}`,
        phone,
        direction: 'outbound',
        template_name: 'winback_60_day',
        status: 'sent',
        metadata: { customer_name: customer.name, customer_id: customer.id, type: 'winback_60d' },
      } as any) as any);

      sent60d++;
    } catch (err) {
      console.error('[Winback] 60d error for customer:', customer.id, err);
    }
  }

  console.log(`[Winback] Done. 30d: ${sent30d}, 60d: ${sent60d}`);

  return NextResponse.json({
    status: 'ok',
    sent_30d: sent30d,
    sent_60d: sent60d,
    checked_at: nowIST,
  });
}
