import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ForceDeleteClient } from './force-delete-client';

export default async function ForceDeletePage({ searchParams }: { searchParams: { tenant?: string } }) {
  await requireAdmin();
  const admin = createAdminClient();

  // Fetch all tenants for the dropdown
  const { data: tenants } = await (admin
    .from('tenants' as any)
    .select('id, name, tenant_code, owner_name, phone, subscription_status')
    .order('name') as any);

  // If a specific tenant is pre-selected, get its stats
  let previewData: any = null;
  if (searchParams.tenant) {
    const tid = searchParams.tenant;
    const [custRes, apptRes, svcRes, empRes, branchRes] = await Promise.all([
      admin.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
      admin.from('appointments').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
      admin.from('services').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
      admin.from('employees').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
      admin.from('branches').select('id', { count: 'exact', head: true }).eq('tenant_id', tid),
    ]);
    const tenant = (tenants ?? []).find((t: any) => t.id === tid);
    previewData = {
      tenant,
      customers: custRes.count ?? 0,
      appointments: apptRes.count ?? 0,
      services: svcRes.count ?? 0,
      staff: empRes.count ?? 0,
      branches: branchRes.count ?? 0,
    };
  }

  return <ForceDeleteClient tenants={tenants ?? []} previewData={previewData} preselectedId={searchParams.tenant} />;
}
