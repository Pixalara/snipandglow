import { NextRequest, NextResponse } from 'next/server';
import { getPlatformCredentials } from '@/lib/whatsapp/config';

/**
 * Test endpoint to verify WhatsApp credentials are working
 * GET /api/whatsapp/test-credentials?secret=snipandglow2026
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Require secret to prevent abuse
  if (searchParams.get('secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const credentials = getPlatformCredentials();
  
  if (!credentials) {
    return NextResponse.json({
      success: false,
      error: 'No credentials found',
      details: 'META_WHATSAPP_ACCESS_TOKEN is not set in environment variables'
    }, { status: 500 });
  }

  // Test the credentials by fetching the phone number details
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
      {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'Credentials invalid or expired',
        details: data,
        status: response.status,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Credentials are valid',
      phoneNumber: data.display_phone_number,
      verifiedName: data.verified_name,
      qualityRating: data.quality_rating,
      phoneNumberId: credentials.phoneNumberId,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: 'Failed to test credentials',
      details: err.message,
    }, { status: 500 });
  }
}
