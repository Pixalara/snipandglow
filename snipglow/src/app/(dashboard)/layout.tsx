import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';
import type { UserRole, Branch } from '@/types';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Backup redirect for middleware — if no session, go to login
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';
  const tenantId = user.user_metadata?.tenant_id as string | undefined;
  const branchId = user.user_metadata?.branch_id as string | undefined;
  const userName = user.user_metadata?.name ?? user.email ?? 'User';

  // Fetch branches for the tenant (used by branch switcher for owners)
  let branches: Branch[] = [];
  if (tenantId && role === 'owner') {
    const { data } = await supabase
      .from('branches')
      .select('id, name, address, phone, is_default, is_active, tenant_id, operating_hours, invoice_counter, created_at')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name');

    branches = (data ?? []) as Branch[];
  } else if (tenantId && branchId) {
    const { data } = await supabase
      .from('branches')
      .select('id, name, address, phone, is_default, is_active, tenant_id, operating_hours, invoice_counter, created_at')
      .eq('id', branchId)
      .single();

    if (data) {
      branches = [data as Branch];
    }
  }

  const activeBranchId = branchId ?? branches[0]?.id ?? '';

  return (
    <AppShell
      role={role}
      userName={userName}
      branches={branches}
      activeBranchId={activeBranchId}
    >
      {children}
    </AppShell>
  );
}
