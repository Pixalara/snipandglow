import { checkAdmin } from '@/lib/admin/auth';
import { redirect } from 'next/navigation';
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

  return (
    <AdminShell adminEmail={user?.email || ''}>
      {children}
    </AdminShell>
  );
}
