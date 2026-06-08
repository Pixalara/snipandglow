import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSbClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformCredentials, WA_BASE_URL } from '@/lib/whatsapp/config';
import crypto from 'crypto';

// =============================================================================
// POST /api/auth/staff-verify/send
//
// Starts code-based verification for an owner-provisioned (password) staff
// member who has not yet been verified. Sends:
//   • a 6-digit WhatsApp OTP to the staff member's phone (Meta Cloud API)
//   • a 6-digit email OTP to the staff member's email (Supabase Auth email OTP)
//
// Returns a session_token the client uses on the confirm step. Proving control
// of BOTH channels (only the real person receives both) verifies the staff
// member; they then log in with the password the owner set.
// =============================================================================

function normalizePhoneE164(phone: string): string {
  const cleaned = phone.replace(/[\s\-()+]/g, '');
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) return `91${cleaned}`;
  if (cleaned.startsWith('91')) return cleaned;
  return `91${cleaned}`;
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const admin = createAdminClient();

    // Find the password-staff employee row by email.
    const { data: emp } = await ((admin
      .from('employees') as any)
      .select('id, name, phone, email, login_method, email_verified_by_owner, phone_verified_by_owner, is_active')
      .ilike('email', normalizedEmail)
      .eq('login_method', 'password')
      .limit(1)
      .maybeSingle() as any);

    if (!emp) {
      return NextResponse.json({ error: 'No staff account found for this email.' }, { status: 404 });
    }
    if (!emp.is_active) {
      return NextResponse.json({ error: 'This staff account has been deactivated.' }, { status: 403 });
    }
    if (emp.email_verified_by_owner && emp.phone_verified_by_owner) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }
    if (!emp.phone) {
      return NextResponse.json({ error: 'No phone number on file. Contact your salon owner.' }, { status: 400 });
    }

    // ── Generate + store the WhatsApp code ──
    const phoneCode = String(Math.floor(100000 + Math.random() * 900000));
    const sessionToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Clear any previous codes for this employee, then insert fresh.
    await ((admin as any).from('staff_verification_codes').delete().eq('employee_id', emp.id) as any);
    const { error: insErr } = await ((admin as any).from('staff_verification_codes').insert({
      employee_id: emp.id,
      phone_code: phoneCode,
      session_token: sessionToken,
      expires_at: expiresAt,
    }) as any);
    if (insErr) {
      console.error('[StaffVerify/send] code insert failed:', insErr.message);
      return NextResponse.json({ error: 'Could not start verification. Please try again.' }, { status: 500 });
    }

    // ── Send WhatsApp OTP via Meta Cloud API (reuse otp_verification template) ──
    const phoneE164 = normalizePhoneE164(emp.phone);
    const credentials = getPlatformCredentials();
    if (credentials) {
      try {
        await fetch(`${WA_BASE_URL}/${credentials.phoneNumberId}/messages`, {
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
                { type: 'body', parameters: [{ type: 'text', text: phoneCode }, { type: 'text', text: 'Verification' }] },
                { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: phoneCode }] },
              ],
            },
          }),
        });
      } catch (waErr) {
        console.error('[StaffVerify/send] WhatsApp send error:', waErr);
      }
    } else {
      console.log(`[StaffVerify/send] WhatsApp not configured. Code for ${phoneE164}: ${phoneCode}`);
    }

    // ── Send email OTP via Supabase Auth (uses Supabase's email channel) ──
    // Requires "Email OTP" enabled in Supabase Auth and the email template to
    // include the {{ .Token }} 6-digit code.
    let emailSent = false;
    try {
      const sb = createSbClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      const { error: otpErr } = await sb.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: false },
      });
      if (otpErr) {
        console.error('[StaffVerify/send] email OTP error:', otpErr.message);
      } else {
        emailSent = true;
      }
    } catch (emailErr) {
      console.error('[StaffVerify/send] email OTP exception:', emailErr);
    }

    return NextResponse.json({
      ok: true,
      session_token: sessionToken,
      email: normalizedEmail,
      emailSent,
      maskedPhone: `•••••${phoneE164.slice(-4)}`,
    });
  } catch (err) {
    console.error('[StaffVerify/send] Unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

