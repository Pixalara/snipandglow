'use client';

import { useState } from 'react';
import Link from 'next/link';
import { X, Mail } from 'lucide-react';
import { formatISTDateTime } from '@/lib/datetime';

export interface AuditLog {
  id: string;
  created_at: string;
  admin_email: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

function actionClass(action: string): string {
  if (action.includes('delete')) return 'bg-red-500/15 text-red-600 dark:text-red-400';
  if (action.includes('view')) return 'bg-blue-500/15 text-blue-600 dark:text-blue-400';
  if (action.includes('send')) return 'bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400';
  return 'bg-muted text-foreground/80';
}

export function AuditLogClient({ logs }: { logs: AuditLog[] }) {
  const [active, setActive] = useState<AuditLog | null>(null);

  return (
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
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((log) => {
              const metaStr = log.metadata ? JSON.stringify(log.metadata) : '';
              return (
                <tr key={log.id} className="hover:bg-accent/40 cursor-pointer" onClick={() => setActive(log)}>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatISTDateTime(log.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-foreground/80">{log.admin_email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${actionClass(log.action)}`}>{log.action}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {log.target_type ? `${log.target_type}:${log.target_id?.substring(0, 8) ?? ''}…` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">{metaStr ? metaStr.substring(0, 80) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs font-medium text-blue-500 hover:text-blue-400">View</span>
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">No audit logs yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setActive(null)} />
          <div className="relative z-10 w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${actionClass(active.action)}`}>{active.action}</span>
                <span className="text-xs text-muted-foreground truncate">{formatISTDateTime(active.created_at)}</span>
              </div>
              <button onClick={() => setActive(null)} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              <Field label="Admin" value={active.admin_email} />
              <Field label="Action" value={active.action} />
              <Field label="Target" value={active.target_type ? `${active.target_type} · ${active.target_id ?? ''}` : '—'} />
              {active.ip_address && <Field label="IP" value={active.ip_address} />}

              {active.action === 'send_announcement' && (
                <div className="rounded-xl border border-fuchsia-300/50 bg-fuchsia-50 dark:bg-fuchsia-900/15 p-3">
                  <p className="text-xs text-fuchsia-800 dark:text-fuchsia-300">
                    This is an email campaign. To see the exact recipients and delivery status, open the full campaign log.
                  </p>
                  <Link href="/admin/announcements" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-300 hover:underline">
                    <Mail className="size-3.5" /> Go to Announcements → Campaign history
                  </Link>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Full details</p>
                <pre className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-foreground overflow-x-auto whitespace-pre-wrap break-words">
                  {active.metadata && Object.keys(active.metadata).length > 0
                    ? JSON.stringify(active.metadata, null, 2)
                    : 'No additional details.'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-medium text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-foreground text-right break-all">{value}</span>
    </div>
  );
}
