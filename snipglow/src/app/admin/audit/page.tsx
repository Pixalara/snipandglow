import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';
import { formatISTDateTime } from '@/lib/datetime';

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
        <p className="text-sm text-muted-foreground mt-1">All platform admin actions are logged here · times in IST</p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Time (IST)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Admin</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Target</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(logs ?? []).map((log: any) => (
                <tr key={log.id} className="hover:bg-accent/40">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatISTDateTime(log.created_at)}
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground/80">{log.admin_email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      log.action.includes('delete') ? 'bg-red-500/15 text-red-600 dark:text-red-400' :
                      log.action.includes('view') ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' :
                      'bg-muted text-foreground/80'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {log.target_type ? `${log.target_type}:${log.target_id?.substring(0, 8)}...` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                    {log.metadata ? JSON.stringify(log.metadata).substring(0, 80) : '—'}
                  </td>
                </tr>
              ))}
              {(!logs || logs.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No audit logs yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
