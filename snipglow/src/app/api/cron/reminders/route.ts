import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformCredentials } from '@/lib/whatsapp/config';
import { sendMessage } from '@/lib/whatsapp/templates';

// =============================================================================
// Appointment Reminders — Called every 30 minutes by external cron
// Uses appointment columns (reminder_24h_sent, reminder_3h_sent) for dedup.
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

  // Get IST date/time
  const nowIST = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata', hour12: false });
  const [todayDate, todayTime] = nowIST.split(', ');
  const [nowH, nowM] = (todayTime || '00:00:00').split(':').map(Number);
  const nowMinutes = nowH * 60 + nowM;

  // Tomorrow's date
  const [y, m, d] = todayDate.split('-').map(Number);
  const tmrw = new Date(y, m - 1, d + 1, 12, 0, 0);
  const tomorrowStr = `${tmrw.getFullYear()}-${String(tmrw.getMonth() + 1).padStart(2, '0')}-${String(tmrw.getDate()).padStart(2, '0')}`;

  console.log('[Reminders] IST:', todayDate, todayTime, '| Tomorrow:', tomorrowStr);

  let sent24h = 0;
  let sent3h = 0;

  // ─── 24-HOUR REMINDERS ──────────────────────────────────────────────────
  const { data: appts24h } = await (admin
    .from('appointments' as any)
    .select('id, customer_id, service_id, appointment_date, start_time, tenant_id, whatsapp_flow_ref')
    .eq('appointment_date', tomorrowStr)
    .in('status', ['booked', 'confirmed'])
    .eq('reminder_24h_sent', false)
    .limit(30) as any);

  for (const appt of appts24h ?? []) {
    try {
      // Re-verify status right before sending. The bulk query above can be
      // slightly stale (a customer may cancel/reschedule between selection and
      // send), so this guarantees a cancelled appointment never gets a reminder.
      const { data: fresh24 } = await (admin
        .from('appointments' as any)
        .select('status')
        .eq('id', appt.id)
        .single() as any);
      if (!fresh24 || (fresh24.status !== 'booked' && fresh24.status !== 'confirmed')) continue;

      const { data: customer } = await admin.from('customers').select('name, phone').eq('id', appt.customer_id).single();
      if (!customer?.phone) continue;

      let serviceNames = '';
      try {
        const ids = appt.whatsapp_flow_ref ? JSON.parse(appt.whatsapp_flow_ref) : [appt.service_id];
        const { data: svcs } = await admin.from('services').select('name').in('id', Array.isArray(ids) ? ids : [ids]);
        serviceNames = svcs?.map((s: any) => s.name).join(', ') || '';
      } catch { serviceNames = ''; }

      const { data: tenant } = await (admin.from('tenants' as any).select('name').eq('id', appt.tenant_id).single() as any);
      const salonName = ((tenant?.name as string) || '').trim();

      const [h, mi] = appt.start_time.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const timeLabel = `${h % 12 || 12}:${String(mi).padStart(2, '0')} ${period}`;
      const dateLabel = new Date(appt.appointment_date + 'T12:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

      const phone = customer.phone.replace(/\D/g, '');

      await sendMessage(credentials, phone, {
        type: 'template',
        template: {
          name: 'appointment_reminder_v1',
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: customer.name },
                { type: 'text', text: serviceNames },
                { type: 'text', text: `${dateLabel}, ${timeLabel}` },
                { type: 'text', text: salonName },
              ],
            },
          ],
        },
      });

      // Mark as sent — this is the dedup
      await (admin.from('appointments' as any).update({ reminder_24h_sent: true }).eq('id', appt.id) as any);
      sent24h++;
    } catch (err) {
      console.error('[Reminders] 24h error:', err);
    }
  }

  // ─── 3-HOUR REMINDERS ───────────────────────────────────────────────────
  const threeHoursFromNow = nowMinutes + 180;
  if (threeHoursFromNow < 24 * 60) {
    const windowStart = `${String(Math.floor(threeHoursFromNow / 60)).padStart(2, '0')}:${String(threeHoursFromNow % 60).padStart(2, '0')}:00`;
    const windowEnd = `${String(Math.floor((threeHoursFromNow + 30) / 60)).padStart(2, '0')}:${String((threeHoursFromNow + 30) % 60).padStart(2, '0')}:00`;

    const { data: appts3h } = await (admin
      .from('appointments' as any)
      .select('id, customer_id, service_id, appointment_date, start_time, tenant_id, whatsapp_flow_ref')
      .eq('appointment_date', todayDate)
      .gte('start_time', windowStart)
      .lt('start_time', windowEnd)
      .in('status', ['booked', 'confirmed'])
      .eq('reminder_3h_sent', false)
      .limit(30) as any);

    for (const appt of appts3h ?? []) {
      try {
        // Re-verify status right before sending (guards against a cancellation
        // or reschedule that happened after this batch was selected).
        const { data: fresh3 } = await (admin
          .from('appointments' as any)
          .select('status')
          .eq('id', appt.id)
          .single() as any);
        if (!fresh3 || (fresh3.status !== 'booked' && fresh3.status !== 'confirmed')) continue;

        const { data: customer } = await admin.from('customers').select('name, phone').eq('id', appt.customer_id).single();
        if (!customer?.phone) continue;

        let serviceNames = '';
        try {
          const ids = appt.whatsapp_flow_ref ? JSON.parse(appt.whatsapp_flow_ref) : [appt.service_id];
          const { data: svcs } = await admin.from('services').select('name').in('id', Array.isArray(ids) ? ids : [ids]);
          serviceNames = svcs?.map((s: any) => s.name).join(', ') || '';
        } catch { serviceNames = ''; }

        const { data: tenant } = await (admin.from('tenants' as any).select('name').eq('id', appt.tenant_id).single() as any);
        const salonName = ((tenant?.name as string) || '').trim();

        const [h, mi] = appt.start_time.split(':').map(Number);
        const period = h >= 12 ? 'PM' : 'AM';
        const timeLabel = `${h % 12 || 12}:${String(mi).padStart(2, '0')} ${period}`;

        const phone = customer.phone.replace(/\D/g, '');

        await sendMessage(credentials, phone, {
          type: 'template',
          template: {
            name: 'appointment_reminder_v1',
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: customer.name },
                  { type: 'text', text: serviceNames },
                  { type: 'text', text: `Today, ${timeLabel}` },
                  { type: 'text', text: salonName },
                ],
              },
            ],
          },
        });

        // Mark as sent
        await (admin.from('appointments' as any).update({ reminder_3h_sent: true }).eq('id', appt.id) as any);
        sent3h++;
      } catch (err) {
        console.error('[Reminders] 3h error:', err);
      }
    }
  }

  return NextResponse.json({ status: 'ok', sent_24h: sent24h, sent_3h: sent3h, checked_at: nowIST });
}
