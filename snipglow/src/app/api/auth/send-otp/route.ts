import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformCredentials, WA_BASE_URL } from '@/lib/whatsapp/config';

// =============================================================================
// POST /api/auth/send-otp
// Generates a 6-digit OTP, stores it in DB, and sends via WhatsApp.
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone || typeof phone !== 'string') {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Clean and validate phone
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    const phoneE164 = cleaned.length === 10 && /^[6-9]/.test(cleaned)
      ? `91${cleaned}`
      : cleaned.startsWith('91') ? cleaned : `91${cleaned}`;

    if (phoneE164.length !== 12) {
      return NextResponse.json({ error: 'Please enter a valid 10-digit Indian mobile number' }, { status: 400 });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP in database
    const admin = createAdminClient();

    // Delete any existing OTPs for this phone
    await admin
      .from('otp_codes')
      .delete()
      .eq('phone', phoneE164);

    // Insert new OTP
    const { error: insertError } = await admin
      .from('otp_codes')
      .insert({
        phone: phoneE164,
        code: otp,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('[OTP] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to generate OTP. Please try again.' }, { status: 500 });
    }

    // Send OTP via WhatsApp
    const credentials = getPlatformCredentials();
    if (credentials) {
      try {
        const res = await fetch(`${WA_BASE_URL}/${credentials.phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phoneE164,
            type: 'template',
            template: {
              name: 'otp_verification',
              language: { code: 'en_US' },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: otp },
                    { type: 'text', text: 'Login' },
                  ],
                },
                {
                  type: 'button',
                  sub_type: 'url',
                  index: '0',
                  parameters: [{ type: 'text', text: otp }],
                },
              ],
            },
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          console.error('[OTP] WhatsApp send failed:', errData);
          // Fall back: still return success so user can use the OTP (for testing)
          // In production, you'd want to fail here
        } else {
          // Log the OTP (authentication) message for cost tracking.
          // OTP login is pre-auth, so resolve the owning tenant from the
          // employee record tied to this phone (best-effort).
          try {
            const phone10 = phoneE164.startsWith('91') && phoneE164.length === 12 ? phoneE164.slice(2) : phoneE164;
            let otpTenantId: string | null = null;
            for (const p of [phone10, phoneE164, `+${phoneE164}`]) {
              const { data: emp } = await (admin
                .from('employees')
                .select('tenant_id')
                .eq('phone', p)
                .limit(1)
                .maybeSingle() as any);
              if (emp?.tenant_id) { otpTenantId = emp.tenant_id; break; }
            }
            await (admin.from('whatsapp_sessions').insert({
              tenant_id: otpTenantId,
              message_id: `otp_${Date.now()}`,
              phone: phoneE164,
              direction: 'outbound',
              template_name: 'otp_verification',
              template_category: 'authentication',
              status: 'sent',
              metadata: { type: 'login_otp' },
            } as any) as any);
          } catch (logErr) {
            console.error('[OTP] Failed to log auth message:', logErr);
          }
        }
      } catch (waErr) {
        console.error('[OTP] WhatsApp network error:', waErr);
      }
    } else {
      // WhatsApp not configured — log OTP for testing
      console.log(`[OTP] WhatsApp not configured. OTP for ${phoneE164}: ${otp}`);
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your WhatsApp',
      phone: phoneE164,
    });
  } catch (err) {
    console.error('[OTP] Unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
