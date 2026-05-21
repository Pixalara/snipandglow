import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';
import { AdminSupportClient } from './admin-support-client';

export default async function AdminSupportPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: tickets } = await (admin
    .from('support_tickets' as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100) as any);

  return <AdminSupportClient tickets={tickets ?? []} />;
}
