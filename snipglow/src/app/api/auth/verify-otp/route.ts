import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { consumeOtpCode } from '@/lib/auth/otp';

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

    // Expiry, single-use and phone normalisation all live in the shared verifier
    // so this route and /api/auth/attach-phone cannot drift apart on them.
    const otp = await consumeOtpCode(admin, { phone, code: cleanedCode });
    if (!otp.ok || !otp.phone) {
      return NextResponse.json({ error: otp.message ?? 'Verification failed' }, { status: 400 });
    }
    const phoneNormalized = otp.phone;

    // Check if user exists — first check employees table (most reliable for existing salon owners)
    const phoneE164 = `+${phoneNormalized}`;
    let existingUser: any = null;

    // Extract just the 10-digit number (strip 91 prefix if present)
    const phone10digit = phoneNormalized.startsWith('91') && phoneNormalized.length === 12
      ? phoneNormalized.slice(2)
      : phoneNormalized;

    // 1. Check employees table — try ALL possible formats stored in DB.
    //    A phone can have MULTIPLE employee rows (e.g. owner of more than one salon,
    //    or leftover rows from a deleted tenant). We must pick a row whose tenant
    //    STILL EXISTS, preferring the most recently created active record. Picking a
    //    row tied to a deleted tenant is what caused users to land on the wrong salon.
    let foundEmployee: any = null;
    const phonesToTry = [
      phoneE164,           // +919459086057
      phoneNormalized,     // 919459086057
      phone10digit,        // 9459086057  ← this is what's stored in DB
      phone,               // raw input
      `+${phone}`,         // +raw
    ];

    console.log('[VerifyOTP] Looking up employee for phones:', phonesToTry);

    // Collect every candidate employee across all phone formats
    const candidates: any[] = [];
    const seenIds = new Set<string>();
    for (const p of phonesToTry) {
      const { data: emps } = await (admin
        .from('employees')
        .select('auth_user_id, tenant_id, branch_id, role, name, id, created_at')
        .eq('phone', p)
        .eq('is_active', true)
        .order('created_at', { ascending: false }) as any);
      for (const emp of emps ?? []) {
        if (!seenIds.has(emp.id)) {
          seenIds.add(emp.id);
          candidates.push(emp);
        }
      }
    }

    if (candidates.length > 0) {
      // Keep only candidates whose tenant still exists
      const tenantIds = [...new Set(candidates.map((c) => c.tenant_id).filter(Boolean))];
      const { data: liveTenants } = await (admin
        .from('tenants')
        .select('id')
        .in('id', tenantIds) as any);
      const liveTenantIds = new Set((liveTenants ?? []).map((t: any) => t.id));

      const validCandidates = candidates.filter((c) => liveTenantIds.has(c.tenant_id));
      // Prefer a valid candidate (live tenant). Among valid ones, prefer the most
      // recently created that already has an auth_user_id, else most recent.
      const pool = validCandidates.length > 0 ? validCandidates : [];

      if (pool.length > 0) {
        foundEmployee =
          pool.find((c) => c.auth_user_id) ?? pool[0];
        if (validCandidates.length < candidates.length) {
          console.log('[VerifyOTP] Skipped', candidates.length - validCandidates.length, 'employee row(s) tied to deleted tenants');
        }
        console.log('[VerifyOTP] Selected employee:', foundEmployee.name, 'tenant:', foundEmployee.tenant_id, 'auth_user_id:', foundEmployee.auth_user_id);
      } else {
        console.log('[VerifyOTP] All employee rows point to deleted tenants — treating as no match');
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
      // ─── No account for this number ─────────────────────────────────────
      //
      // This branch used to CREATE a brand-new owner account here, with a
      // fabricated `<phone>@phone.snipandglow.com` email, and send it straight to
      // /onboarding. That is how a salon could end up with no contactable
      // address at all — no invoices, no receipts, no renewal notices, no
      // password recovery (SNG-009 was created exactly this way).
      //
      // Signing up is now Google-first by design: Google supplies a verified,
      // real email, and /verify-phone then adds the WhatsApp number, so every
      // new salon has both. OTP remains a SIGN-IN mechanism for accounts that
      // already exist — it no longer mints them.
      //
      // The OTP itself was valid and has already been consumed above, so this is
      // a legitimate holder of the number; they simply have nothing to sign in
      // to yet. 404 + a machine-readable code so the client can offer signup.
      console.log('[VerifyOTP] Valid OTP but no account for', phoneNormalized);
      return NextResponse.json(
        {
          error: 'NO_ACCOUNT',
          message:
            "There's no SnipandGlow account for this number yet. Create one with Google — it takes a minute, and you'll verify this same WhatsApp number as part of it.",
          signupUrl: '/signup',
        },
        { status: 404 }
      );
    }
  } catch (err) {
    console.error('[OTP] Unexpected error:', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
