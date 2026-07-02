import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';
import { AuditLogClient, type AuditLog } from './audit-client';

export default async function AdminAuditPage() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: logs } = await (admin
    .from('admin_audit_logs' as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100) as any);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Audit Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">All platform admin actions are logged here · click a row for full details · times in IST</p>
      </div>

      <AuditLogClient logs={(logs ?? []) as AuditLog[]} />
    </div>
  );
}
