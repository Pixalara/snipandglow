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
 */
export async function generateSmartSlots(tenantId: string, branchId: string): Promise<GeneratedSlots> {
  const admin = createAdminClient();

  // Fetch branch operating hours
  const { data: branch } = await admin
    .from('branches')
    .select('operating_hours')
    .eq('id', branchId)
    .single();

  // Fetch tenant settings (blocked dates)
  const { data: tenantData } = await (admin
    .from('tenants' as any)
    .select('settings')
    .eq('id', tenantId)
    .single() as any);

  const operatingHours = (branch?.operating_hours as Record<string, { open?: string; close?: string } | null>) || {};
  const blockedDates: string[] = (tenantData?.settings as any)?.blocked_dates || [];
  const ist = getISTNow();

  console.log('[Slots] IST now:', ist.date, ist.hours + ':' + ist.minutes);
  console.log('[Slots] Operating hours keys:', Object.keys(operatingHours));

  // ─── GENERATE DATES ─────────────────────────────────────────────────────
  const dates: TimeSlotOption[] = [];
  let daysChecked = 0;

  while (dates.length < 14 && daysChecked < 30) {
    // Add days to today's IST date
    const [y, m, d] = ist.date.split('-').map(Number);
    const baseDate = new Date(y, m - 1, d + daysChecked, 12, 0, 0); // Local noon
    const dateStr = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`;
    const dayName = getDayName(dateStr);

    // Skip blocked dates
    if (blockedDates.includes(dateStr)) {
      daysChecked++;
      continue;
    }

    // Check if branch is open (try full name, then 3-letter abbreviation)
    const dayHours = operatingHours[dayName] || operatingHours[dayName.slice(0, 3)] || null;
    if (!dayHours || !dayHours.open || !dayHours.close) {
      daysChecked++;
      continue;
    }

    // Format label
    const labelDate = new Date(dateStr + 'T12:00:00+05:30');
    const label = labelDate.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });
    dates.push({ id: dateStr, title: label });
    daysChecked++;
  }

  // ─── GENERATE TIME SLOTS ────────────────────────────────────────────────
  // Use operating hours to determine slot range
  // Since WhatsApp Flow shows same slots for all dates, we generate the full range
  // Blocked slots per date are validated at booking submission time
  const timeSlots: TimeSlotOption[] = [];

  // Find the operating hours (use first available date's day, or any day with hours)
  let openTime = '09:00';
  let closeTime = '21:00';

  if (dates.length > 0) {
    const firstDayName = getDayName(dates[0].id);
    const dh = operatingHours[firstDayName] || operatingHours[firstDayName.slice(0, 3)];
    if (dh?.open && dh?.close) {
      openTime = dh.open;
      closeTime = dh.close;
    }
  } else {
    // Fallback: find any day with hours
    for (const key of Object.keys(operatingHours)) {
      const h = operatingHours[key];
      if (h?.open && h?.close) {
        openTime = h.open;
        closeTime = h.close;
        break;
      }
    }
  }

  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const openMinutes = openH * 60 + (openM || 0);
  const closeMinutes = closeH * 60 + (closeM || 0);

  console.log('[Slots] Open:', openTime, 'Close:', closeTime, 'Range:', openMinutes, '-', closeMinutes);

  // Generate ALL time slots for the full operating hours range
  // We show the complete range because WhatsApp Flow uses same slots for all dates
  // Past/buffer validation happens at booking submission time
  for (let mins = openMinutes; mins < closeMinutes; mins += 30) {
    const hour = Math.floor(mins / 60);
    const min = mins % 60;
    const h = hour % 12 || 12;
    const period = hour >= 12 ? 'PM' : 'AM';
    const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
    timeSlots.push({ id: timeStr, title: `${h}:${String(min).padStart(2, '0')} ${period}` });
  }

  // Final fallback
  if (dates.length === 0) {
    const [y, m, d] = ist.date.split('-').map(Number);
    for (let i = 0; i < 14; i++) {
      const fd = new Date(y, m - 1, d + i, 12, 0, 0);
      const ds = `${fd.getFullYear()}-${String(fd.getMonth() + 1).padStart(2, '0')}-${String(fd.getDate()).padStart(2, '0')}`;
      const label = fd.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      dates.push({ id: ds, title: label });
    }
  }

  console.log('[Slots] Generated:', dates.length, 'dates,', timeSlots.length, 'slots');

  return { dates, timeSlots };
}
