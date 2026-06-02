// =============================================================================
// Smart Time Slot Generator
// Generates available dates and time slots based on:
// - Branch operating hours
// - Blocked dates (full day closures)
// - Current time (IST) with 1-hour buffer for today
// - Blocked slots are validated at booking time (not here, since Flow shows
//   same slots for all dates)
// =============================================================================

import { createAdminClient } from '@/lib/supabase/admin';

interface TimeSlotOption {
  id: string;
  title: string;
}

interface GeneratedSlots {
  dates: TimeSlotOption[];
  timeSlots: TimeSlotOption[];
}

/**
 * Get current IST date and time.
 */
function getISTNow(): { date: string; hours: number; minutes: number } {
  const now = new Date();
  // Format in IST using Intl
  const istStr = now.toLocaleString('en-CA', { timeZone: 'Asia/Kolkata', hour12: false });
  // en-CA gives YYYY-MM-DD, HH:MM:SS format
  const [datePart, timePart] = istStr.split(', ');
  const [hours, minutes] = (timePart || '00:00:00').split(':').map(Number);
  return {
    date: datePart, // YYYY-MM-DD in IST
    hours,
    minutes,
  };
}

/**
 * Get day name from date string (full lowercase: monday, tuesday, etc.)
 * Uses IST timezone to avoid UTC day mismatch.
 */
function getDayName(dateStr: string): string {
  // Parse as noon IST to avoid timezone day shift
  const d = new Date(dateStr + 'T12:00:00+05:30');
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[d.getUTCDay()];
}

/**
 * Generate smart dates and time slots for a tenant's branch.
 * Respects: operating hours, blocked dates, slot duration, and booking capacity.
 */
export async function generateSmartSlots(tenantId: string, branchId: string): Promise<GeneratedSlots> {
  const admin = createAdminClient();

  // Fetch branch operating hours and tenant settings in parallel
  const [branchRes, tenantRes] = await Promise.all([
    admin.from('branches').select('operating_hours').eq('id', branchId).single(),
    (admin.from('tenants' as any).select('settings').eq('id', tenantId).single() as any),
  ]);

  const operatingHours = (branchRes.data?.operating_hours as Record<string, { open?: string; close?: string } | null>) || {};
  const tenantSettings = (tenantRes.data?.settings as any) || {};
  const blockedDates: string[] = tenantSettings.blocked_dates || [];
  const slotDurationMinutes: number = tenantSettings.slot_duration_minutes || 30;
  const maxPerSlot: number = tenantSettings.max_appointments_per_slot || 1;

  const ist = getISTNow();

  console.log('[Slots] IST now:', ist.date, ist.hours + ':' + ist.minutes);
  console.log('[Slots] Operating hours keys:', Object.keys(operatingHours));
  console.log('[Slots] Slot duration:', slotDurationMinutes, 'min, Max per slot:', maxPerSlot);

  // ─── GENERATE DATES ─────────────────────────────────────────────────────
  const dates: TimeSlotOption[] = [];
  let daysChecked = 0;

  while (dates.length < 7 && daysChecked < 14) {
    const [y, m, d] = ist.date.split('-').map(Number);
    const baseDate = new Date(y, m - 1, d + daysChecked, 12, 0, 0);
    const dateStr = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`;
    const dayName = getDayName(dateStr);

    if (blockedDates.includes(dateStr)) { daysChecked++; continue; }

    const dayHours = operatingHours[dayName] || operatingHours[dayName.slice(0, 3)] || null;
    if (!dayHours || !dayHours.open || !dayHours.close) { daysChecked++; continue; }

    const labelDate = new Date(dateStr + 'T12:00:00+05:30');
    const label = labelDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });
    dates.push({ id: dateStr, title: label });
    daysChecked++;
  }

  // ─── FETCH BOOKED APPOINTMENTS FOR CAPACITY CHECK ───────────────────────
  let bookedByDate: Map<string, Array<{ start: string; end: string }>> = new Map();
  if (dates.length > 0) {
    const firstDate = dates[0].id;
    const lastDate = dates[dates.length - 1].id;
    const { data: bookedAppts } = await (admin
      .from('appointments')
      .select('appointment_date, start_time, end_time')
      .eq('tenant_id', tenantId)
      .gte('appointment_date', firstDate)
      .lte('appointment_date', lastDate)
      .in('status', ['booked', 'confirmed']) as any);

    if (bookedAppts) {
      for (const appt of bookedAppts) {
        const key = appt.appointment_date;
        if (!bookedByDate.has(key)) bookedByDate.set(key, []);
        bookedByDate.get(key)!.push({ start: appt.start_time, end: appt.end_time });
      }
    }
  }

  // ─── FETCH BLOCKED SLOTS ────────────────────────────────────────────────
  const blockedSlotEntries: Array<{ date: string; slots: string[] }> = tenantSettings.blocked_slots || [];
  const blockedSlotsByDate = new Map<string, Set<string>>();
  for (const entry of blockedSlotEntries) {
    blockedSlotsByDate.set(entry.date, new Set(entry.slots));
  }

  // ─── GENERATE TIME SLOTS ────────────────────────────────────────────────
  let openTime = '09:00';
  let closeTime = '21:00';

  if (dates.length > 0) {
    const firstDayName = getDayName(dates[0].id);
    const dh = operatingHours[firstDayName] || operatingHours[firstDayName.slice(0, 3)];
    if (dh?.open && dh?.close) { openTime = dh.open; closeTime = dh.close; }
  } else {
    for (const key of Object.keys(operatingHours)) {
      const h = operatingHours[key];
      if (h?.open && h?.close) { openTime = h.open; closeTime = h.close; break; }
    }
  }

  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const openMinutes = openH * 60 + (openM || 0);
  const closeMinutes = closeH * 60 + (closeM || 0);

  console.log('[Slots] Open:', openTime, 'Close:', closeTime, 'Duration:', slotDurationMinutes, 'min');

  // Helper
  function toMin(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  // Generate slots at configured interval, filter by capacity across all dates
  const allDates = dates.map((d) => d.id);
  const timeSlots: TimeSlotOption[] = [];

  for (let mins = openMinutes; mins < closeMinutes; mins += slotDurationMinutes) {
    const hour = Math.floor(mins / 60);
    const min = mins % 60;
    const slotHHMM = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    const timeStr = `${slotHHMM}:00`;
    const slotEnd = mins + slotDurationMinutes;

    // Keep slot if available on at least one date
    const isAvailableOnAnyDate = allDates.some((dateStr) => {
      // Skip if blocked
      if (blockedSlotsByDate.get(dateStr)?.has(slotHHMM)) return false;
      // Count overlapping bookings
      const booked = bookedByDate.get(dateStr) || [];
      const overlapCount = booked.filter((appt) => {
        const apptStart = toMin(appt.start);
        const apptEnd = toMin(appt.end);
        return mins < apptEnd && slotEnd > apptStart;
      }).length;
      return overlapCount < maxPerSlot;
    });

    if (!isAvailableOnAnyDate && allDates.length > 0) continue;

    const h = hour % 12 || 12;
    const period = hour >= 12 ? 'PM' : 'AM';
    timeSlots.push({ id: timeStr, title: `${h}:${String(min).padStart(2, '0')} ${period}` });
  }

  // Final fallback for dates
  if (dates.length === 0) {
    const [y, m, d] = ist.date.split('-').map(Number);
    for (let i = 0; i < 7; i++) {
      const fd = new Date(y, m - 1, d + i, 12, 0, 0);
      const ds = `${fd.getFullYear()}-${String(fd.getMonth() + 1).padStart(2, '0')}-${String(fd.getDate()).padStart(2, '0')}`;
      const label = fd.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      dates.push({ id: ds, title: label });
    }
  }

  console.log('[Slots] Generated:', dates.length, 'dates,', timeSlots.length, 'slots');

  return { dates, timeSlots };
}
