import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AuditLogClient } from './audit-client';
import type { UserRole, AuditLog } from '@/types';

// =============================================================================
// Audit Log Page — Server Component
// Owner only (deny staff and manager — show "Access denied" message)
//
// Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
// =============================================================================

export default async function AuditLogPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // Owner only — deny staff and manager (Requirement 12.6)
  if (role !== 'owner') {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Audit Log</h1>
        <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
          <p className="text-sm text-muted-foreground">
            Access denied. Audit logs are available for owners only.
          </p>
        </div>
      </div>
    );
  }

  // Fetch audit_logs ordered by created_at DESC, limit 100
  const { data: auditLogs, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Audit Log</h1>
        <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
          <p className="text-sm text-destructive">
            Failed to load audit logs. Please try again.
          </p>
        </div>
      </div>
    );
  }

  const logs = (auditLogs ?? []) as AuditLog[];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Audit Log</h1>
      <AuditLogClient logs={logs} />
    </div>
  );
}
