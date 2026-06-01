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

    // Extract just the 10-digit number (strip 91 prefix if present)
    const phone10digit = phoneNormalized.startsWith('91') && phoneNormalized.length === 12
      ? phoneNormalized.slice(2)
      : phoneNormalized;

    // 1. Check employees table — try ALL possible formats stored in DB
    let foundEmployee: any = null;
    const phonesToTry = [
      phoneE164,           // +919459086057
      phoneNormalized,     // 919459086057
      phone10digit,        // 9459086057  ← this is what's stored in DB
      phone,               // raw input
      `+${phone}`,         // +raw
    ];
    
    console.log('[VerifyOTP] Looking up employee for phones:', phonesToTry);
    
    for (const p of phonesToTry) {
      const { data: emp } = await (admin
        .from('employees')
        .select('auth_user_id, tenant_id, branch_id, role, name, id')
        .eq('phone', p)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle() as any);
      if (emp) {  // found by phone — auth_user_id may or may not be set
        foundEmployee = emp;
        console.log('[VerifyOTP] Found employee:', emp.name, 'phone match:', p, 'auth_user_id:', emp.auth_user_id);
        break;
      }
    }

    // If employee found but no auth_user_id, search auth.users by email pattern
    if (foundEmployee && !foundEmployee.auth_user_id) {
      console.log('[VerifyOTP] Employee found but no auth_user_id — searching auth.users');
      const tempEmail = `${phoneNormalized}@phone.snipandglow.com`;
      const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const matchedUser = existingUsers?.users?.find(
        (u: any) => u.email === tempEmail ||
          u.user_metadata?.phone === phoneNormalized ||
          u.user_metadata?.phone === phoneE164 ||
          u.phone === phoneE164
      );
      if (matchedUser) {
        existingUser = matchedUser;
        // Backfill auth_user_id on the employee record
        await (admin.from('employees').update({ auth_user_id: matchedUser.id } as any).eq('id', foundEmployee.id) as any);
        console.log('[VerifyOTP] Backfilled auth_user_id for employee:', foundEmployee.name);
      }
    } else if (foundEmployee?.auth_user_id) {
      const { data: { user: authUser } } = await admin.auth.admin.getUserById(foundEmployee.auth_user_id);
      if (authUser) {
        existingUser = authUser;
        console.log('[VerifyOTP] Found auth user:', authUser.email);
      }
    }

    // 2. Fallback: check auth.users directly by phone or metadata
    if (!existingUser) {
      console.log('[VerifyOTP] No employee match — searching all auth.users');
      const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
      existingUser = existingUsers?.users?.find(
        (u: any) => u.phone === phoneE164 ||
          u.user_metadata?.phone === phone ||
          u.user_metadata?.phone === phoneNormalized ||
          u.user_metadata?.phone === phoneE164 ||
          u.email === `${phoneNormalized}@phone.snipandglow.com`
      ) || null;
      console.log('[VerifyOTP] Auth.users search result:', existingUser?.email || 'NOT FOUND');
    }

    // Use foundEmployee for tenant context (more reliable than existingUser.user_metadata)
    const employee = foundEmployee;

    // CRITICAL: If employee found but existingUser not resolved, get user directly by auth_user_id
    if (foundEmployee?.auth_user_id && !existingUser) {
      console.log('[VerifyOTP] Employee has auth_user_id but user not resolved — fetching directly');
      const { data: { user: directUser } } = await admin.auth.admin.getUserById(foundEmployee.auth_user_id);
      if (directUser) {
        existingUser = directUser;
        console.log('[VerifyOTP] Resolved user directly:', directUser.email);
      }
    }

    // If employee found but still no existingUser, search by email pattern
    if (foundEmployee && !existingUser) {
      console.log('[VerifyOTP] Employee found but no auth user — searching by email');
      const tempEmail = `${phoneNormalized}@phone.snipandglow.com`;
      const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const matched = existingUsers?.users?.find(
        (u: any) => u.email === tempEmail ||
          u.user_metadata?.phone === phoneNormalized ||
          u.user_metadata?.phone === phone10digit ||
          u.phone === phoneE164
      );
      if (matched) {
        existingUser = matched;
        // Backfill auth_user_id
        if (!foundEmployee.auth_user_id) {
          await (admin.from('employees').update({ auth_user_id: matched.id } as any).eq('id', foundEmployee.id) as any);
          console.log('[VerifyOTP] Backfilled auth_user_id:', matched.id);
        }
      }
    }

    if (existingUser) {
      // CRITICAL: Sync tenant context into user_metadata BEFORE generating the magic link.
      // The session JWT reads user_metadata at verification time, and middleware uses
      // user_metadata.tenant_id to decide dashboard vs onboarding. Without this, an
      // existing salon owner signing in via OTP lands on /onboarding instead of /dashboard.
      if (foundEmployee?.tenant_id) {
        const existingMeta = existingUser.user_metadata || {};
        const needsMetaUpdate =
          existingMeta.tenant_id !== foundEmployee.tenant_id ||
          existingMeta.branch_id !== foundEmployee.branch_id ||
          existingMeta.role !== foundEmployee.role;

        if (needsMetaUpdate) {
          const { error: updateErr } = await admin.auth.admin.updateUserById(existingUser.id, {
            user_metadata: {
              ...existingMeta,
              phone: phoneNormalized,
              tenant_id: foundEmployee.tenant_id,
              branch_id: foundEmployee.branch_id,
              role: foundEmployee.role,
              name: foundEmployee.name ?? existingMeta.name,
            },
          });
          if (updateErr) {
            console.error('[VerifyOTP] Failed to sync tenant metadata:', updateErr);
          } else {
            console.log('[VerifyOTP] Synced tenant_id into user_metadata:', foundEmployee.tenant_id);
          }
        }
      }

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
      const hasTenant = foundEmployee?.tenant_id || existingUser.user_metadata?.tenant_id;
      console.log('[VerifyOTP] hasTenant:', hasTenant, 'redirecting to:', hasTenant ? '/dashboard' : '/onboarding');

      return NextResponse.json({
        success: true,
        action: 'sign_in',
        token_hash: tokenHash,
        type,
        email: existingUser.email || `${phoneNormalized}@phone.snipandglow.com`,
        redirect: hasTenant ? '/dashboard' : '/onboarding',
      });
    } else if (foundEmployee) {
      // Employee exists in DB but no auth account yet — create one with correct tenant context
      console.log('[VerifyOTP] Employee found but no auth account — creating with tenant context');
      const tempEmail = `${phoneNormalized}@phone.snipandglow.com`;
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: tempEmail,
        phone: phoneE164,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: {
          phone: phoneNormalized,
          tenant_id: foundEmployee.tenant_id,
          branch_id: foundEmployee.branch_id,
          role: foundEmployee.role,
          name: foundEmployee.name,
          signup_method: 'phone_otp',
        },
      });

      if (createError && !createError.message?.includes('already been registered')) {
        console.error('[VerifyOTP] Create user error:', createError);
        return NextResponse.json({ error: 'Sign-in failed. Please try again.' }, { status: 500 });
      }

      const userId = newUser?.user?.id;
      if (userId) {
        await (admin.from('employees').update({ auth_user_id: userId } as any).eq('id', foundEmployee.id) as any);
        console.log('[VerifyOTP] Created auth account and linked to employee:', userId);
      }

      const siteUrl2 = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.snipandglow.com';
      const { data: signInData2 } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: tempEmail,
        options: { redirectTo: `${siteUrl2}/dashboard` },
      });

      const actionUrl2 = new URL(signInData2?.properties?.action_link || 'https://x.com');
      const tokenHash2 = actionUrl2.searchParams.get('token_hash') || signInData2?.properties?.hashed_token;

      return NextResponse.json({
        success: true,
        action: 'sign_in',
        token_hash: tokenHash2,
        type: 'magiclink',
        email: tempEmail,
        redirect: '/dashboard',
      });
    } else {
      // Truly new user — no employee record found
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
