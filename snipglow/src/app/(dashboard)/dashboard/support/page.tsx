import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SupportClient, type TicketRow } from './support-client';

export default async function SupportPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;
  const userName = user.user_metadata?.name ?? user.email ?? 'User';
  const userPhone = user.user_metadata?.phone ?? user.phone ?? '';

  if (!tenantId || !branchId) redirect('/onboarding');

  const admin = createAdminClient();

  // Fetch existing support tickets for this tenant
  const { data: tickets } = await admin
    .from('support_tickets' as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(50);

  const rows: TicketRow[] = (tickets ?? []).map((t: any) => ({
    id: t.id,
    subject: t.subject ?? '',
    description: t.description ?? '',
    category: t.category ?? 'general',
    status: t.status ?? 'open',
    priority: t.priority ?? 'medium',
    created_at: t.created_at,
  }));

  return (
    <SupportClient
      tickets={rows}
      userName={userName}
      userPhone={userPhone}
      tenantId={tenantId}
      branchId={branchId}
    />
  );
}
