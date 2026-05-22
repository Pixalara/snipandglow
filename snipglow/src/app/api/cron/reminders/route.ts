import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformCredentials } from '@/lib/whatsapp/config';
import { sendMessage } from '@/lib/whatsapp/templates';

// =============================================================================
// Appointment Reminders — Called externally every 30 minutes
// Sends 24-hour and 3-hour reminders for active appointments.
// Endpoint: GET /api/cron/reminders?secret=<CRON_SECRET>
// =============================================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  // Verify secret
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

  // Get current IST time
  const nowIST = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata', hour12: false });
  const [todayDate, todayTime] = nowIST.split(', ');
  const [nowH, nowM] = todayTime.split(':').map(Number);
  const nowMinutes = nowH * 60 + nowM;

  console.log('[Reminders] Running at IST:', todayDate, todayTime);

  // Calculate target windows
  // 24-hour reminder: appointments tomorrow at current time window (±30 min)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  // 3-hour reminder: appointments today, 3 hours from now (±30 min)
  const threeHoursFromNow = nowMinutes + 180; // 3 hours = 180 minutes
  const threeHourWindowStart = `${String(Math.floor(threeHoursFromNow / 60)).padStart(2, '0')}:${String(threeHoursFromNow % 60).padStart(2, '0')}:00`;
  const threeHourWindowEnd = `${String(Math.floor((threeHoursFromNow + 30) / 60)).padStart(2, '0')}:${String((threeHoursFromNow + 30) % 60).padStart(2, '0')}:00`;

  let sent24h = 0;
  let sent3h = 0;

  // ─── 24-HOUR REMINDERS ──────────────────────────────────────────────────
  // Find appointments tomorrow that haven't been reminded (24h)
  const { data: appts24h } = await (admin
    .from('appointments')
    .select('id, customer_id, service_id, appointment_date, start_time, tenant_id, whatsapp_flow_ref')
    .eq('appointment_date', tomorrowStr)
    .in('status', ['booked', 'confirmed'])
    .limit(50) as any);

  for (const appt of appts24h ?? []) {
    try {
      // Get customer phone first
      const { data: customer } = await admin.from('customers').select('name, phone').eq('id', appt.customer_id).single();
      if (!customer?.phone) continue;
      const phone = customer.phone.replace(/\D/g, '');

      // Check if 24h reminder already sent
      const { data: existing } = await (admin
        .from('whatsapp_sessions' as any)
        .select('id')
        .eq('template_name', `reminder_24h_${appt.id}`)
        .limit(1) as any);

      if (existing && existing.length > 0) continue; // Already sent

      // Get service names
      let serviceNames = '';
      try {
        const ids = appt.whatsapp_flow_ref ? JSON.parse(appt.whatsapp_flow_ref) : [appt.service_id];
        const { data: svcs } = await admin.from('services').select('name').in('id', Array.isArray(ids) ? ids : [ids]);
        serviceNames = svcs?.map((s: any) => s.name).join(', ') || '';
      } catch { serviceNames = ''; }

      // Get salon name
      const { data: tenant } = await (admin.from('tenants' as any).select('name').eq('id', appt.tenant_id).single() as any);
      const salonName = (tenant?.name || '').trim();

      // Format time
      const [h, m] = appt.start_time.split(':').map(Number);
      const period = h >= 12 ? 'PM' : 'AM';
      const timeLabel = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
      const dateLabel = new Date(appt.appointment_date + 'T12:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

      await sendMessage(credentials, phone, {
        type: 'text',
        text: { body: `⏰ *Appointment Reminder*\n\nHi ${customer.name}, this is a reminder for your appointment tomorrow!\n\n✂️ ${serviceNames}\n📅 ${dateLabel}, ${timeLabel}\n📍 ${salonName}\n\nSee you tomorrow! 😊` },
      });

      // Log to prevent duplicate sends — use try-catch in case of DB issues
      try {
        await (admin.from('whatsapp_sessions' as any).insert({
          tenant_id: appt.tenant_id,
          message_id: `rem24_${appt.id}`,
          phone: phone,
          direction: 'outbound',
          template_name: `reminder_24h_${appt.id}`,
          status: 'sent',
          metadata: { type: '24h_reminder' },
        } as any) as any);
      } catch (logErr) {
        console.error('[Reminders] Failed to log 24h dedup:', logErr);
      }

      sent24h++;
    } catch (err) {
      console.error('[Reminders] 24h error:', err);
    }
  }

  // ─── 3-HOUR REMINDERS ───────────────────────────────────────────────────
  // Find appointments today, starting in ~3 hours
  if (threeHoursFromNow < 24 * 60) { // Only if 3 hours from now is still today
    const { data: appts3h } = await (admin
      .from('appointments')
      .select('id, customer_id, service_id, appointment_date, start_time, tenant_id, whatsapp_flow_ref')
      .eq('appointment_date', todayDate)
      .gte('start_time', threeHourWindowStart)
      .lt('start_time', threeHourWindowEnd)
      .in('status', ['booked', 'confirmed'])
      .limit(50) as any);

    for (const appt of appts3h ?? []) {
      try {
        // Check if 3h reminder already sent
        const { data: existing } = await (admin
          .from('whatsapp_sessions' as any)
          .select('id')
          .eq('template_name', `reminder_3h_${appt.id}`)
          .limit(1) as any);

        if (existing && existing.length > 0) continue;

        // Get customer phone
        const { data: customer } = await admin.from('customers').select('name, phone').eq('id', appt.customer_id).single();
        if (!customer?.phone) continue;

        // Get service names
        let serviceNames = '';
        try {
          const ids = appt.whatsapp_flow_ref ? JSON.parse(appt.whatsapp_flow_ref) : [appt.service_id];
          const { data: svcs } = await admin.from('services').select('name').in('id', Array.isArray(ids) ? ids : [ids]);
          serviceNames = svcs?.map((s: any) => s.name).join(', ') || '';
        } catch { serviceNames = ''; }

        // Get salon name
        const { data: tenant } = await (admin.from('tenants' as any).select('name').eq('id', appt.tenant_id).single() as any);
        const salonName = (tenant?.name || '').trim();

        // Format time
        const [h, m] = appt.start_time.split(':').map(Number);
        const period = h >= 12 ? 'PM' : 'AM';
        const timeLabel = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;

        const phone = customer.phone.replace(/\D/g, '');

        await sendMessage(credentials, phone, {
          type: 'text',
          text: { body: `🔔 *Coming Up in 3 Hours!*\n\nHi ${customer.name}, your appointment at *${salonName}* is in 3 hours.\n\n✂️ ${serviceNames}\n⏰ ${timeLabel}\n\nWe're looking forward to seeing you! 💇` },
        });

        // Log
        try {
          await (admin.from('whatsapp_sessions' as any).insert({
            tenant_id: appt.tenant_id,
            message_id: `rem3_${appt.id}`,
            phone,
            direction: 'outbound',
            template_name: `reminder_3h_${appt.id}`,
            status: 'sent',
            metadata: { type: '3h_reminder' },
          } as any) as any);
        } catch (logErr) {
          console.error('[Reminders] Failed to log 3h dedup:', logErr);
        }

        sent3h++;
      } catch (err) {
        console.error('[Reminders] 3h error:', err);
      }
    }
  }

  return NextResponse.json({
    status: 'ok',
    sent_24h: sent24h,
    sent_3h: sent3h,
    checked_at: nowIST,
  });
}
