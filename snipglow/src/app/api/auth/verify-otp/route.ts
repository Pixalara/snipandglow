import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// =============================================================================
// POST /api/auth/verify-otp
// Verifies the OTP code and creates/signs in the user via Supabase Auth.
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const { phone, code } = await request.json();

    if (!phone || !code) {
      return NextResponse.json({ error: 'Phone and OTP code are required' }, { status: 400 });
    }

    const cleanedCode = String(code).trim();
    if (cleanedCode.length !== 6) {
      return NextResponse.json({ error: 'Please enter a valid 6-digit code' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch OTP record
    const { data: otpRecord, error: fetchError } = await (admin
      .from('otp_codes')
      .select('*')
      .eq('phone', phone)
      .single() as any);

    if (fetchError || !otpRecord) {
      return NextResponse.json({ error: 'No OTP found. Please request a new one.' }, { status: 400 });
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      await admin.from('otp_codes').delete().eq('phone', phone);
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    // Increment attempts (mark as used to prevent reuse)
    await (admin
      .from('otp_codes')
      .update({ used: true } as any)
      .eq('phone', phone) as any);

    // Verify code
    if (otpRecord.code !== cleanedCode) {
      return NextResponse.json({ error: 'Invalid OTP. Please try again.' }, { status: 400 });
    }

    // OTP is valid — delete it
    await admin.from('otp_codes').delete().eq('phone', phone);

    // Check if user exists with this phone
    const phoneE164 = phone.startsWith('+') ? phone : `+${phone}`;
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.phone === phoneE164 || u.user_metadata?.phone === phone
    );

    if (existingUser) {
      // User exists — generate a magic link token for sign-in
      const { data: signInData, error: signInError } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: existingUser.email || `${phone}@phone.snipandglow.com`,
      });

      if (signInError) {
        console.error('[OTP] Sign-in link error:', signInError);
        return NextResponse.json({ error: 'Failed to sign in. Please try again.' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        action: 'sign_in',
        token: signInData?.properties?.hashed_token,
        email: existingUser.email,
        tenant_id: existingUser.user_metadata?.tenant_id,
        redirect: existingUser.user_metadata?.tenant_id ? '/dashboard' : '/onboarding',
      });
    } else {
      // New user — create account with phone
      const tempEmail = `${phone}@phone.snipandglow.com`;
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: tempEmail,
        phone: phoneE164,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          phone: phone,
          signup_method: 'phone_otp',
        },
      });

      if (createError) {
        console.error('[OTP] Create user error:', createError);
        return NextResponse.json({ error: 'Failed to create account. Please try again.' }, { status: 500 });
      }

      // Generate sign-in link
      const { data: signInData } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: tempEmail,
      });

      return NextResponse.json({
        success: true,
        action: 'sign_up',
        token: signInData?.properties?.hashed_token,
        email: tempEmail,
        redirect: '/onboarding',
      });
    }
  } catch (err) {
    console.error('[OTP] Unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
