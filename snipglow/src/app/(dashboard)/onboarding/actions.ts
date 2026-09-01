'use server';

import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { toTitleCase } from '@/lib/utils';
import { notifyPlatformOfSignup } from '@/lib/notifications/signup-alert';
import { sendWelcomeWhatsApp } from '@/lib/notifications/welcome-whatsapp';
import { realEmail, verifiedPhone } from '@/lib/auth/signup-state';
import { tenDigitPhone } from '@/lib/auth/otp';
import type { ActionResult } from '@/types';

export async function completeOnboarding(data: {
  salonName: string;
  ownerName: string;
  // NOTE: no `phone` field on purpose. The owner's number is taken from the
  // WhatsApp-verified value on the session, never from the form, so a caller
  // cannot register a number it did not prove it controls.
  branchName: string;
  branchAddress: string;
  city: string;
  state: string;
  pincode: string;
  openTime: string;
  closeTime: string;
  services?: { name: string; category: string; duration_minutes: number; price: number }[];
}): Promise<ActionResult<{ tenantId: string; branchId: string }>> {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // ─── Signup completeness: THE security boundary ───────────────────────
    //
    // This action is the one and only place a tenant row is created, so this is
    // where "both factors verified" is actually enforced. Middleware and the
    // OAuth callback route users toward the missing step, but they decide from
    // `user_metadata`, which a browser can write via supabase.auth.updateUser —
    // routing is a convenience, not a guarantee.
    //
    // Requiring a real email here is what prevents another salon like SNG-009:
    // created through the phone-only path with a fabricated
    // `<phone>@phone.snipandglow.com` address and therefore unreachable for
    // invoices, receipts, renewal notices and password recovery.
    const ownerEmail = realEmail(user);
    if (!ownerEmail) {
      return {
        success: false,
        error:
          'Please finish signing in with Google first — we need a real email address to send your invoices and renewal reminders.',
      };
    }

    const verified = verifiedPhone(user);
    if (!verified) {
      return {
        success: false,
        error: 'Please verify your WhatsApp number before setting up your salon.',
      };
    }

    // The VERIFIED number is authoritative, not whatever was typed into the form.
    // The form field is prefilled and read-only, but a server action is a public
    // endpoint and must not trust its own UI.
    const ownerPhone = tenDigitPhone(verified);

    // ─── Validate mandatory location fields ──────────────────────────────
    const address = (data.branchAddress ?? '').trim();
    const city = (data.city ?? '').trim();
    const state = (data.state ?? '').trim();
    const pincode = (data.pincode ?? '').trim();
    if (!address) return { success: false, error: 'Address is required.' };
    if (!city) return { success: false, error: 'City is required.' };
    if (!state) return { success: false, error: 'State is required.' };
    if (!/^\d{6}$/.test(pincode)) return { success: false, error: 'Please enter a valid 6-digit pincode.' };

    const addressTC = toTitleCase(address);
    const cityTC = toTitleCase(city);
    const stateTC = toTitleCase(state);
    // Readable single-line address stored on the branch (used on invoices).
    const fullAddress = `${addressTC}, ${cityTC}, ${stateTC} - ${pincode}`;

    // Build operating hours (same for all days)
    const operatingHours: Record<string, { open: string; close: string }> = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of days) {
      operatingHours[day] = { open: data.openTime, close: data.closeTime };
    }

    // Create tenant (using admin client to bypass RLS — new user has no tenant_id yet)
    // 15-day free trial: stamp the trial window so expiry can be enforced.
    const trialStart = new Date();
    const trialEnd = new Date(trialStart);
    trialEnd.setDate(trialEnd.getDate() + 15);

    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .insert({
        name: toTitleCase(data.salonName),
        owner_name: toTitleCase(data.ownerName),
        phone: ownerPhone,
        subscription_status: 'trial',
        subscription_start: trialStart.toISOString(),
        subscription_end: trialEnd.toISOString(),
        plan_tier: 'starter',
        // Persist structured location so it's available for billing/WhatsApp
        // verification without parsing the branch address string.
        settings: { address: addressTC, city: cityTC, state: stateTC, pincode },
      })
      .select('id')
      .single();

    if (tenantError || !tenant) {
      return { success: false, error: tenantError?.message ?? 'Failed to create salon' };
    }

    // Create primary branch
    const { data: branch, error: branchError } = await admin
      .from('branches')
      .insert({
        tenant_id: tenant.id,
        name: toTitleCase(data.branchName),
        address: fullAddress,
        operating_hours: operatingHours,
        is_default: true,
        is_active: true,
      })
      .select('id')
      .single();

    if (branchError || !branch) {
      return { success: false, error: branchError?.message ?? 'Failed to create branch' };
    }

    // Create owner employee record
    const { error: employeeError } = await admin.from('employees').insert({
      tenant_id: tenant.id,
      branch_id: branch.id,
      auth_user_id: user.id,
      name: toTitleCase(data.ownerName),
      phone: ownerPhone,
      // Guaranteed real by the gate above, so this row is always contactable.
      email: ownerEmail,
      role: 'owner',
      specializations: [],
      is_active: true,
    });

    if (employeeError) {
      return { success: false, error: employeeError.message };
    }

    // Add initial services if provided
    if (data.services && data.services.length > 0) {
      const serviceRows = data.services.map((svc) => ({
        tenant_id: tenant.id,
        branch_id: branch.id,
        name: toTitleCase(svc.name),
        category: toTitleCase(svc.category),
        duration_minutes: svc.duration_minutes,
        price: svc.price,
        is_active: true,
      }));

      await admin.from('services').insert(serviceRows);
    }

    // Update user metadata with tenant context using admin API (avoids cookie/session issues).
    //
    // The spread is load-bearing: this previously REPLACED user_metadata wholesale
    // and so deleted `phone` (the verified WhatsApp number) and `signup_method` the
    // moment onboarding finished. Losing `phone` breaks the verification signal the
    // signup gate reads, and it is the number the OTP sign-in path matches on.
    const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata ?? {}),
        phone: verified,
        tenant_id: tenant.id,
        branch_id: branch.id,
        role: 'owner',
        name: toTitleCase(data.ownerName),
      },
    });

    if (metaError) {
      console.error('Failed to update user metadata:', metaError.message);
      // Non-fatal: tenant is created, user can still proceed
    }

    // Auto-create WhatsApp booking settings (shared mode)
    // Slug format: sng001_salon_name (generated from tenant_code + name)
    let tenantCode: string | null = null;
    try {
      const { data: tenantWithCode } = await (admin
        .from('tenants')
        .select('tenant_code')
        .eq('id', tenant.id)
        .single() as any);

      tenantCode = tenantWithCode?.tenant_code ?? null;

      if (tenantWithCode?.tenant_code) {
        const slug = (tenantWithCode.tenant_code.replace('-', '') + '_' + data.salonName)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/_+$/, '');

        await (admin.from('tenant_whatsapp_settings' as any).insert({
          tenant_id: tenant.id,
          mode: 'shared',
          booking_slug: slug,
        } as any) as any);
      }
    } catch (err) {
      console.error('Failed to create WhatsApp settings:', err);
      // Non-fatal
    }

    // Post-signup notifications. Run after the response is sent so they add
    // nothing to the owner's signup time, and neither one can throw.
    after(async () => {
      await Promise.all([
        // Welcome the new owner on WhatsApp.
        sendWelcomeWhatsApp({
          salonName: toTitleCase(data.salonName),
          phone: ownerPhone,
        }),
        // Tell the platform team a salon just signed up.
        notifyPlatformOfSignup({
          tenantId: tenant.id,
          tenantCode,
          salonName: toTitleCase(data.salonName),
          ownerName: toTitleCase(data.ownerName),
          phone: ownerPhone,
          email: ownerEmail,
          city: cityTC,
          state: stateTC,
          pincode,
          planTier: 'starter',
          trialEnd: trialEnd.toISOString(),
        }),
      ]);
    });

    return { success: true, data: { tenantId: tenant.id, branchId: branch.id } };
  } catch (err) {
    return { success: false, error: 'An unexpected error occurred during onboarding' };
  }
}
