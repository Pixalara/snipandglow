'use client';

import { useState } from 'react';
import { Zap, ArrowUpRight, ArrowDownLeft, CheckCircle2, XCircle, Clock, Filter } from 'lucide-react';
import type { AutomationLogRow } from './page';

// =============================================================================
// Automation Logs Client — Shows WhatsApp notification activity in plain English
// =============================================================================

interface Props {
  logs: AutomationLogRow[];
}

type DirectionFilter = 'all' | 'outbound' | 'inbound';

const statusIcons: Record<string, React.ReactNode> = {
  sent: <CheckCircle2 className="size-3.5 text-emerald-500" />,
  delivered: <CheckCircle2 className="size-3.5 text-blue-500" />,
  read: <CheckCircle2 className="size-3.5 text-blue-600" />,
  failed: <XCircle className="size-3.5 text-red-500" />,
};

const statusLabels: Record<string, string> = {
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed',
};

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function AutomationLogsClient({ logs }: Props) {
  const [filter, setFilter] = useState<DirectionFilter>('all');

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.direction === filter);

  const outboundCount = logs.filter((l) => l.direction === 'outbound').length;
  const inboundCount = logs.filter((l) => l.direction === 'inbound').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent border border-violet-200/50 dark:border-violet-800/30 p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
              <Zap className="size-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Automation Logs</h1>
              <p className="text-sm text-muted-foreground">
                {filtered.length} messages · {outboundCount} sent · {inboundCount} received
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="size-3.5 text-muted-foreground" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as DirectionFilter)}
              className="h-9 min-h-[44px] sm:min-h-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
              aria-label="Filter by direction"
            >
              <option value="all">All Messages</option>
              <option value="outbound">Sent Only</option>
              <option value="inbound">Received Only</option>
            </select>
          </div>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-violet-500/5" />
      </div>

      {/* Logs List */}
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
        <div className="space-y-2">
          {filtered.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted/30 transition-colors"
            >
              {/* Direction icon */}
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                log.direction === 'outbound'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20'
                  : 'bg-blue-50 dark:bg-blue-900/20'
              }`}>
                {log.direction === 'outbound' ? (
                  <ArrowUpRight className="size-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <ArrowDownLeft className="size-4 text-blue-600 dark:text-blue-400" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug">
                  {log.description}
                </p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground">{log.phone}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-1.5 shrink-0">
                {statusIcons[log.status] || <Clock className="size-3.5 text-muted-foreground" />}
                <span className="text-xs text-muted-foreground capitalize">
                  {statusLabels[log.status] || log.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
