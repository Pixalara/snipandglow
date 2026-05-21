// =============================================================================
// Smart Time Slot Generator
// Generates available dates and time slots based on:
// - Branch operating hours
// - Blocked dates
// - Current time (IST) with 1-hour buffer
// - Skips past time slots for today
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
 * Get current IST time components.
 */
function getISTNow(): { date: string; hours: number; minutes: number } {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  return {
    date: ist.toISOString().split('T')[0],
    hours: ist.getUTCHours(),
    minutes: ist.getUTCMinutes(),
  };
}

/**
 * Get day name from date string (full lowercase: monday, tuesday, etc.)
 */
function getDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[d.getDay()];
}

/**
 * Generate smart dates and time slots for a tenant's branch.
 * - Respects operating hours
 * - Skips blocked dates
 * - For today: skips past slots + adds 1-hour buffer
 */
export async function generateSmartSlots(tenantId: string, branchId: string): Promise<GeneratedSlots> {
  const admin = createAdminClient();

  // Fetch branch operating hours and blocked dates
  const { data: branch } = await admin
    .from('branches')
    .select('operating_hours')
    .eq('id', branchId)
    .single();

  // Fetch blocked dates from tenant settings
  const { data: tenantData } = await (admin
    .from('tenants' as any)
    .select('settings')
    .eq('id', tenantId)
    .single() as any);

  const operatingHours = (branch?.operating_hours as Record<string, { open?: string; close?: string } | null>) || {};
  const blockedDates: string[] = (tenantData?.settings as any)?.blocked_dates || [];
  const ist = getISTNow();

  // Generate available dates (next 14 open days, max 30 days lookahead)
  const dates: TimeSlotOption[] = [];
  let daysChecked = 0;

  // Use IST date as starting point (not UTC)
  const todayIST = ist.date; // Already in IST

  while (dates.length < 14 && daysChecked < 30) {
    // Calculate date from IST today — avoid UTC conversion
    const baseDate = new Date(todayIST + 'T12:00:00+05:30'); // Use noon to avoid timezone edge cases
    baseDate.setDate(baseDate.getDate() + daysChecked);
    // Format as YYYY-MM-DD without UTC conversion
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dayName = getDayName(dateStr);

    // Check if blocked
    if (blockedDates.includes(dateStr)) {
      daysChecked++;
      continue;
    }

    // Check if branch is open on this day (try full name and 3-letter)
    const dayHours = operatingHours[dayName] || operatingHours[dayName.slice(0, 3)] || null;
    if (!dayHours || !dayHours.open || !dayHours.close) {
      daysChecked++;
      continue;
    }

    const label = baseDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    dates.push({ id: dateStr, title: label });
    daysChecked++;
  }

  // Generate time slots based on the first available date's hours
  // (All days typically have same hours, but we use the first date's hours)
  const timeSlots: TimeSlotOption[] = [];
  const firstDate = dates[0]?.id;

  if (firstDate) {
    const firstDayName = getDayName(firstDate);
    const dayHours = operatingHours[firstDayName] || operatingHours[firstDayName.slice(0, 3)];

    if (dayHours?.open && dayHours?.close) {
      const [openH, openM] = dayHours.open.split(':').map(Number);
      const [closeH, closeM] = dayHours.close.split(':').map(Number);
      const openMinutes = openH * 60 + (openM || 0);
      const closeMinutes = closeH * 60 + (closeM || 0);

      // For today: current time + 1 hour buffer
      const isToday = firstDate === ist.date;
      const currentMinutesIST = ist.hours * 60 + ist.minutes;
      const bufferMinutes = isToday ? currentMinutesIST + 60 : 0; // 1 hour from now

      for (let mins = openMinutes; mins < closeMinutes; mins += 30) {
        // Skip past slots (with 1-hour buffer for today)
        if (isToday && mins <= bufferMinutes) continue;

        const hour = Math.floor(mins / 60);
        const min = mins % 60;
        const h = hour % 12 || 12;
        const period = hour >= 12 ? 'PM' : 'AM';
        const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
        timeSlots.push({ id: timeStr, title: `${h}:${String(min).padStart(2, '0')} ${period}` });
      }
    }
  }

  // Fallback if no slots generated (shouldn't happen but safety)
  if (timeSlots.length === 0) {
    for (let hour = 9; hour < 20; hour++) {
      for (const min of [0, 30]) {
        const h = hour % 12 || 12;
        const period = hour >= 12 ? 'PM' : 'AM';
        const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
        timeSlots.push({ id: timeStr, title: `${h}:${String(min).padStart(2, '0')} ${period}` });
      }
    }
  }

  // Fallback dates if none generated
  if (dates.length === 0) {
    for (let i = 0; i < 14; i++) {
      const d = new Date(ist.date + 'T00:00:00+05:30');
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      dates.push({ id: dateStr, title: label });
    }
  }

  return { dates, timeSlots };
}
