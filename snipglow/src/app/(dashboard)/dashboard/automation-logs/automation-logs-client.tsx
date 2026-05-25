'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import type { AutomationLogRow } from './page';

// =============================================================================
// Automation Logs Client — Dark table layout matching admin dashboard style
// =============================================================================

interface Props {
  logs: AutomationLogRow[];
}

type DirectionFilter = 'all' | 'outbound' | 'inbound';

const statusColors: Record<string, string> = {
  sent: 'text-emerald-400',
  delivered: 'text-blue-400',
  read: 'text-blue-300',
  failed: 'text-red-400',
  pending: 'text-slate-400',
};

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) +
    ', ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function AutomationLogsClient({ logs }: Props) {
  const [filter, setFilter] = useState<DirectionFilter>('all');

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.direction === filter);
  const outboundCount = logs.filter((l) => l.direction === 'outbound').length;
  const inboundCount = logs.filter((l) => l.direction === 'inbound').length;
  const failedCount = logs.filter((l) => l.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Automation Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">All WhatsApp activity for your salon</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Sent</p>
          <p className="text-2xl font-bold text-emerald-500 mt-1">{outboundCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Received</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{inboundCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Failed</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{failedCount}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as DirectionFilter)}
          className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Filter by direction"
        >
          <option value="all">All Messages</option>
          <option value="outbound">Sent Only</option>
          <option value="inbound">Received Only</option>
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} messages</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-900/20 mb-4">
            <Zap className="size-6 text-violet-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No automation logs yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            WhatsApp notifications will appear here once customers start booking via WhatsApp or you send bills.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Activity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Direction</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {log.phone}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground max-w-xs">
                      {log.description}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        log.direction === 'outbound'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {log.direction === 'outbound' ? '↑ sent' : '↓ received'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium capitalize ${statusColors[log.status] || 'text-muted-foreground'}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
