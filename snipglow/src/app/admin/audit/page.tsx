import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/admin/auth';

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
        <h1 className="text-2xl font-bold text-white">Admin Audit Logs</h1>
        <p className="text-sm text-slate-400 mt-1">All platform admin actions are logged here</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Admin</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Target</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(logs ?? []).map((log: any) => (
                <tr key={log.id} className="hover:bg-slate-800/20">
                  <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">{log.admin_email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                      log.action.includes('delete') ? 'bg-red-900/30 text-red-400' :
                      log.action.includes('view') ? 'bg-blue-900/30 text-blue-400' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {log.target_type ? `${log.target_type}:${log.target_id?.substring(0, 8)}...` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                    {log.metadata ? JSON.stringify(log.metadata).substring(0, 80) : '—'}
                  </td>
                </tr>
              ))}
              {(!logs || logs.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No audit logs yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
