'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Headphones, Clock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { updateTicketStatus } from './actions';

interface Ticket {
  id: string;
  ticket_number: string | null;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  salon_name: string;
  user_name: string;
  user_phone: string;
  created_at: string;
}

const statusOptions = [
  { value: 'open', label: 'Open', color: 'bg-blue-900/30 text-blue-400' },
  { value: 'acknowledged', label: 'Acknowledged', color: 'bg-amber-900/30 text-amber-400' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-violet-900/30 text-violet-400' },
  { value: 'resolved', label: 'Resolved', color: 'bg-emerald-900/30 text-emerald-400' },
  { value: 'closed', label: 'Closed', color: 'bg-slate-800 text-slate-400' },
];

const priorityColors: Record<string, string> = {
  low: 'text-slate-400',
  medium: 'text-amber-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
};

export function AdminSupportClient({ tickets }: { tickets: Ticket[] }) {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? tickets : tickets.filter((t) => t.status === filter);

  const counts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    acknowledged: tickets.filter((t) => t.status === 'acknowledged').length,
    in_progress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Headphones className="size-6 text-blue-400" />
            Support Tickets
          </h1>
          <p className="text-sm text-slate-400 mt-1">{tickets.length} total tickets from tenants</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'all', label: `All (${counts.all})` },
          { key: 'open', label: `Open (${counts.open})` },
          { key: 'acknowledged', label: `Acknowledged (${counts.acknowledged})` },
          { key: 'in_progress', label: `In Progress (${counts.in_progress})` },
          { key: 'resolved', label: `Resolved (${counts.resolved})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === tab.key
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tickets list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center">
          <p className="text-slate-500">No tickets found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);

  function handleStatusChange(newStatus: string) {
    startTransition(async () => {
      await updateTicketStatus(ticket.id, newStatus);
      router.refresh();
    });
  }

  const currentStatus = statusOptions.find((s) => s.value === ticket.status);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{ticket.ticket_number || ticket.id.substring(0, 8)}</span>
            <p className="text-sm font-medium text-white truncate">{ticket.subject}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${currentStatus?.color || 'bg-slate-800 text-slate-400'}`}>
              {currentStatus?.label || ticket.status}
            </span>
            <span className={`text-[10px] font-medium ${priorityColors[ticket.priority] || 'text-slate-400'}`}>
              {ticket.priority}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <span>{ticket.salon_name}</span>
            <span>&middot;</span>
            <span>{ticket.user_name}</span>
            <span>&middot;</span>
            <span>{new Date(ticket.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
        <svg className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800 pt-3 space-y-4">
          {/* Description */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Description</p>
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-slate-500">Category</p>
              <p className="text-slate-300 font-medium mt-0.5">{ticket.category}</p>
            </div>
            <div>
              <p className="text-slate-500">Phone</p>
              <p className="text-slate-300 font-medium mt-0.5">{ticket.user_phone || '—'}</p>
            </div>
            <div>
              <p className="text-slate-500">Salon</p>
              <p className="text-slate-300 font-medium mt-0.5">{ticket.salon_name}</p>
            </div>
            <div>
              <p className="text-slate-500">Ticket ID</p>
              <p className="text-slate-300 font-mono mt-0.5">{ticket.ticket_number || ticket.id.substring(0, 8)}</p>
            </div>
          </div>

          {/* Status update buttons */}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-800">
            <p className="text-xs text-slate-500 mr-2">Update status:</p>
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                disabled={isPending || ticket.status === opt.value}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  ticket.status === opt.value
                    ? 'bg-slate-700 text-white ring-1 ring-white/20'
                    : 'bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-700'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {isPending ? '...' : opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
