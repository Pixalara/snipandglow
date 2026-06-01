import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOwnerPhone } from '@/lib/whatsapp/notify-owner';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Get all tenants with their phone info
  const { data: tenants } = await (admin
    .from('tenants')
    .select('id, name, phone') as any);

  const results = [];
  for (const tenant of tenants ?? []) {
    const resolvedPhone = await getOwnerPhone(admin, tenant.id);
    
    // Also get employees
    const { data: employees } = await (admin
      .from('employees')
      .select('name, phone, role')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true) as any);

    results.push({
      tenant: tenant.name,
      tenants_phone: tenant.phone,
      resolved_phone: resolvedPhone,
      employees: employees?.map((e: any) => ({ name: e.name, phone: e.phone, role: e.role })),
    });
  }

  return NextResponse.json({ results }, { status: 200 });
}
