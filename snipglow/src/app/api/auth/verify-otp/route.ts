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

    // Normalize phone to match what send-otp stores
    const cleanedPhone = phone.replace(/[\s\-\(\)\+]/g, '');
    const phoneNormalized = cleanedPhone.length === 10 && /^[6-9]/.test(cleanedPhone)
      ? `91${cleanedPhone}`
      : cleanedPhone.startsWith('91') ? cleanedPhone : `91${cleanedPhone}`;

    const admin = createAdminClient();

    // Fetch OTP record — try exact match first, then normalized
    let otpRecord: any = null;
    const { data: record1 } = await (admin
      .from('otp_codes')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as any);

    if (record1) {
      otpRecord = record1;
    } else {
      // Try with normalized phone
      const { data: record2 } = await (admin
        .from('otp_codes')
        .select('*')
        .eq('phone', phoneNormalized)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as any);
      otpRecord = record2;
    }

    if (!otpRecord) {
      return NextResponse.json({ error: 'No OTP found. Please request a new one.' }, { status: 400 });
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      await (admin.from('otp_codes').delete().eq('id', otpRecord.id) as any);
      return NextResponse.json({ error: 'OTP has expired. Please request a new one.' }, { status: 400 });
    }

    // Verify code
    if (otpRecord.code !== cleanedCode) {
      return NextResponse.json({ error: 'Invalid OTP. Please try again.' }, { status: 400 });
    }

    // OTP is valid — delete it
    await (admin.from('otp_codes').delete().eq('id', otpRecord.id) as any);

    // Check if user exists — first check employees table (most reliable for existing salon owners)
    const phoneE164 = `+${phoneNormalized}`;
    let existingUser: any = null;

    // 1. Check employees table for this phone (links to auth_user_id)
    const { data: employee } = await (admin
      .from('employees')
      .select('auth_user_id, tenant_id, branch_id, role, name')
      .eq('phone', phoneE164)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle() as any);

    if (!employee) {
      // Also try without + prefix
      const { data: emp2 } = await (admin
        .from('employees')
        .select('auth_user_id, tenant_id, branch_id, role, name')
        .eq('phone', phoneNormalized)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle() as any);
      if (emp2) Object.assign(employee || {}, emp2);
    }

    if (employee?.auth_user_id) {
      // Found employee — get their auth user
      const { data: { user: authUser } } = await admin.auth.admin.getUserById(employee.auth_user_id);
      if (authUser) {
        existingUser = authUser;
      }
    }

    // 2. Fallback: check auth.users directly
    if (!existingUser) {
      const { data: existingUsers } = await admin.auth.admin.listUsers();
      existingUser = existingUsers?.users?.find(
        (u: any) => u.phone === phoneE164 ||
          u.user_metadata?.phone === phone ||
          u.user_metadata?.phone === phoneNormalized ||
          u.user_metadata?.phone === phoneE164
      ) || null;
    }

    if (existingUser) {
      // User exists — generate a magic link for sign-in
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.snipandglow.com';
      const { data: signInData, error: signInError } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: existingUser.email || `${phoneNormalized}@phone.snipandglow.com`,
        options: {
          redirectTo: `${siteUrl}/dashboard`,
        },
      });

      if (signInError || !signInData) {
        console.error('[OTP] Sign-in link error:', signInError);
        return NextResponse.json({ error: 'Sign-in failed. Please try again.' }, { status: 500 });
      }

      // Extract token_hash and type from the action_link for PKCE flow
      const actionUrl = new URL(signInData.properties?.action_link || '');
      const tokenHash = actionUrl.searchParams.get('token_hash') || signInData.properties?.hashed_token;
      const type = actionUrl.searchParams.get('type') || 'magiclink';

      // Determine redirect: check employee record or user_metadata
      const hasTenant = employee?.tenant_id || existingUser.user_metadata?.tenant_id;

      return NextResponse.json({
        success: true,
        action: 'sign_in',
        token_hash: tokenHash,
        type,
        email: existingUser.email || `${phoneNormalized}@phone.snipandglow.com`,
        redirect: hasTenant ? '/dashboard' : '/onboarding',
      });
    } else {
      // New user — create account with phone
      const tempEmail = `${phoneNormalized}@phone.snipandglow.com`;
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: tempEmail,
        phone: phoneE164,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          phone: phoneNormalized,
          signup_method: 'phone_otp',
        },
      });

      if (createError) {
        // If user already exists with this email (edge case)
        if (createError.message?.includes('already been registered')) {
          const { data: signInData } = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email: tempEmail,
            options: {
              redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.snipandglow.com'}/dashboard`,
            },
          });
          const actionUrl3 = new URL(signInData?.properties?.action_link || 'https://x.com');
          const tokenHash3 = actionUrl3.searchParams.get('token_hash') || signInData?.properties?.hashed_token;
          return NextResponse.json({
            success: true,
            action: 'sign_in',
            token_hash: tokenHash3,
            type: 'magiclink',
            email: tempEmail,
            redirect: '/dashboard',
          });
        }
        console.error('[OTP] Create user error:', createError);
        return NextResponse.json({ error: 'Failed to create account. Please try again.' }, { status: 500 });
      }

      // Generate sign-in link
      const siteUrl2 = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.snipandglow.com';
      const { data: signInData } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: tempEmail,
        options: {
          redirectTo: `${siteUrl2}/onboarding`,
        },
      });

      const actionUrl2 = new URL(signInData?.properties?.action_link || 'https://x.com');
      const tokenHash2 = actionUrl2.searchParams.get('token_hash') || signInData?.properties?.hashed_token;

      return NextResponse.json({
        success: true,
        action: 'sign_up',
        token_hash: tokenHash2,
        type: 'magiclink',
        email: tempEmail,
        redirect: '/onboarding',
      });
    }
  } catch (err) {
    console.error('[OTP] Unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
