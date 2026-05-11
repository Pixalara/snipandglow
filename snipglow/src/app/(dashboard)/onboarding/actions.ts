'use server';

import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/types';

export async function completeOnboarding(data: {
  salonName: string;
  ownerName: string;
  phone: string;
  branchName: string;
  branchAddress?: string;
  openTime: string;
  closeTime: string;
  services?: { name: string; category: string; duration_minutes: number; price: number }[];
}): Promise<ActionResult<{ tenantId: string; branchId: string }>> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Build operating hours (same for all days)
    const operatingHours: Record<string, { open: string; close: string }> = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of days) {
      operatingHours[day] = { open: data.openTime, close: data.closeTime };
    }

    // Create tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: data.salonName,
        owner_name: data.ownerName,
        phone: data.phone,
        subscription_status: 'trial',
        plan_tier: 'starter',
        settings: {},
      })
      .select('id')
      .single();

    if (tenantError || !tenant) {
      return { success: false, error: tenantError?.message ?? 'Failed to create salon' };
    }

    // Create primary branch
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .insert({
        tenant_id: tenant.id,
        name: data.branchName,
        address: data.branchAddress ?? null,
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
    const { error: employeeError } = await supabase.from('employees').insert({
      tenant_id: tenant.id,
      branch_id: branch.id,
      auth_user_id: user.id,
      name: data.ownerName,
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
        name: svc.name,
        category: svc.category,
        duration_minutes: svc.duration_minutes,
        price: svc.price,
        is_active: true,
      }));

      await supabase.from('services').insert(serviceRows);
    }

    // Update user metadata with tenant context
    await supabase.auth.updateUser({
      data: {
        tenant_id: tenant.id,
        branch_id: branch.id,
        role: 'owner',
        name: data.ownerName,
      },
    });

    return { success: true, data: { tenantId: tenant.id, branchId: branch.id } };
  } catch (err) {
    return { success: false, error: 'An unexpected error occurred during onboarding' };
  }
}
