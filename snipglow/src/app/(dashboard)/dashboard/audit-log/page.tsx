import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AuditLogClient } from './audit-client';
import { ShieldAlert } from 'lucide-react';
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
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent border border-red-200/50 dark:border-red-800/30 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
              <ShieldAlert className="size-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Audit Log</h1>
              <p className="text-sm text-muted-foreground">Access restricted</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 mb-4">
            <ShieldAlert className="size-6 text-red-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Access Denied</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Audit logs are available for owners only. Contact your salon owner for access.
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
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-500/10 via-slate-500/5 to-transparent border border-slate-200/50 dark:border-slate-800/30 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900/30">
              <ShieldAlert className="size-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Audit Log</h1>
              <p className="text-sm text-destructive">Failed to load data</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <p className="text-sm text-destructive">
            Failed to load audit logs. Please try again.
          </p>
        </div>
      </div>
    );
  }

  const logs = (auditLogs ?? []) as AuditLog[];

  return <AuditLogClient logs={logs} />;
}
