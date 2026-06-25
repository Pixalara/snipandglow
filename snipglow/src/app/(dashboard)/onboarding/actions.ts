'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { toTitleCase } from '@/lib/utils';
import type { ActionResult } from '@/types';

export async function completeOnboarding(data: {
  salonName: string;
  ownerName: string;
  phone: string;
  branchName: string;
  branchAddress: string;
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

    // ─── Validate mandatory location fields ──────────────────────────────
    const address = (data.branchAddress ?? '').trim();
    const state = (data.state ?? '').trim();
    const pincode = (data.pincode ?? '').trim();
    if (!address) return { success: false, error: 'Address is required.' };
    if (!state) return { success: false, error: 'State is required.' };
    if (!/^\d{6}$/.test(pincode)) return { success: false, error: 'Please enter a valid 6-digit pincode.' };

    const addressTC = toTitleCase(address);
    const stateTC = toTitleCase(state);
    // Readable single-line address stored on the branch.
    const fullAddress = `${addressTC}, ${stateTC} - ${pincode}`;

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
        phone: data.phone,
        subscription_status: 'trial',
        subscription_start: trialStart.toISOString(),
        subscription_end: trialEnd.toISOString(),
        plan_tier: 'starter',
        // Persist structured location so it's available for billing/WhatsApp
        // verification without parsing the branch address string.
        settings: { address: addressTC, state: stateTC, pincode },
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
      phone: data.phone,
      email: user.email ?? null,
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

    // Update user metadata with tenant context using admin API (avoids cookie/session issues)
    const { error: metaError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: {
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
    try {
      const { data: tenantWithCode } = await (admin
        .from('tenants')
        .select('tenant_code')
        .eq('id', tenant.id)
        .single() as any);

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

    return { success: true, data: { tenantId: tenant.id, branchId: branch.id } };
  } catch (err) {
    return { success: false, error: 'An unexpected error occurred during onboarding' };
  }
}
