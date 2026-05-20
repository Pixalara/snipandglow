// =============================================================================
// Google Calendar — "Add to Calendar" link generator
// Customers tap the link and Google Calendar opens with the event pre-filled.
// No OAuth required — uses Google's render URL.
// =============================================================================

interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM:SS
  endTime: string;   // HH:MM:SS
}

/**
 * Format date and time for Google Calendar URL (YYYYMMDDTHHmmss).
 * IST = UTC+5:30
 */
function formatForGoogleCalendar(date: string, time: string): string {
  // date: 2026-05-22, time: 10:00:00 → IST → convert to UTC for the URL
  const [hh, mm, ss] = time.split(':').map(Number);
  const local = new Date(`${date}T${time}+05:30`);
  // Format as YYYYMMDDTHHmmssZ in UTC
  const yyyy = local.getUTCFullYear();
  const MM = String(local.getUTCMonth() + 1).padStart(2, '0');
  const DD = String(local.getUTCDate()).padStart(2, '0');
  const HH = String(local.getUTCHours()).padStart(2, '0');
  const mmStr = String(local.getUTCMinutes()).padStart(2, '0');
  const SS = String(local.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${MM}${DD}T${HH}${mmStr}${SS}Z`;
}

/**
 * Generate a Google Calendar "Add Event" URL.
 * Opens Google Calendar with all details pre-filled.
 */
export function buildGoogleCalendarLink(event: CalendarEvent): string {
  const start = formatForGoogleCalendar(event.startDate, event.startTime);
  const end = formatForGoogleCalendar(event.startDate, event.endTime);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
  });

  if (event.description) params.append('details', event.description);
  if (event.location) params.append('location', event.location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
