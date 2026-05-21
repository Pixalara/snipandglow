import { NextRequest, NextResponse } from 'next/server';
import { buildGoogleCalendarLink } from '@/lib/google-calendar';

// =============================================================================
// GET /cal/[token] — Short URL redirect to Google Calendar
// Token is base64url-encoded: title|date|startTime|endTime|location
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    console.log('[Cal] Token received:', token?.substring(0, 50));

    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    console.log('[Cal] Decoded:', decoded);

    const parts = decoded.split('|');
    const [title, date, startTime, endTime, location] = parts;

    if (!title || !date || !startTime || !endTime) {
      console.log('[Cal] Missing fields, parts:', parts.length);
      return new NextResponse(null, {
        status: 302,
        headers: { Location: '/' },
      });
    }

    const calendarUrl = buildGoogleCalendarLink({
      title,
      startDate: date,
      startTime,
      endTime,
      location: location || '',
      description: 'Booked via SnipandGlow',
    });

    console.log('[Cal] Redirecting to:', calendarUrl.substring(0, 100));

    // Use 302 redirect with Location header for external URLs
    return new NextResponse(null, {
      status: 302,
      headers: { Location: calendarUrl },
    });
  } catch (err) {
    console.error('[Cal] Error:', err);
    return new NextResponse(null, {
      status: 302,
      headers: { Location: '/' },
    });
  }
}
