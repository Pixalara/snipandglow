import { checkAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { AdminShell } from './admin-shell';

export const metadata = {
  title: 'Admin — SnipandGlow Platform',
  robots: 'noindex, nofollow',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { ok, user } = await checkAdmin();

  // If not authenticated or not admin, the individual pages handle their own rendering
  // Login and forbidden pages render without the shell
  if (!ok) {
    return <>{children}</>;
  }

  // Count of open WhatsApp setup requests for the sidebar badge (best-effort).
  let pendingSetupRequests = 0;
  try {
    const admin = createAdminClient();
    const { count } = await (admin
      .from('whatsapp_setup_requests' as any)
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'in_progress']) as any);
    pendingSetupRequests = count ?? 0;
  } catch {
    pendingSetupRequests = 0;
  }

  return (
    <AdminShell adminEmail={user?.email || ''} pendingSetupRequests={pendingSetupRequests}>
      {children}
    </AdminShell>
  );
}
