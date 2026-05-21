import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleCalendarLink } from '@/lib/google-calendar';

// =============================================================================
// GET /cal/[token] — Short URL redirect to Google Calendar
// Token is base64-encoded event data: title|date|startTime|endTime|location
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const [title, date, startTime, endTime, location] = decoded.split('|');

    if (!title || !date || !startTime || !endTime) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    const calendarUrl = buildGoogleCalendarLink({
      title,
      startDate: date,
      startTime,
      endTime,
      location: location || '',
      description: `Booked via SnipandGlow`,
    });

    return NextResponse.redirect(calendarUrl);
  } catch {
    return NextResponse.redirect(new URL('/', request.url));
  }
}
