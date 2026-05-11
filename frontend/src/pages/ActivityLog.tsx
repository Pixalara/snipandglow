// PingFlow — Activity Log Page (Admin Only)
// Professional audit trail with date filters, stats, and timeline view

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import { useBranch } from '@/hooks/useBranch';
import { subscribeAuditLogs, type AuditLogEntry, type ActionType } from '@/services/audit.service';

const actionConfig: Record<ActionType, { icon: string; label: string; color: string; bg: string }> = {
  LOGIN:                { icon: '🔑', label: 'Login',            color: '#059669', bg: '#ECFDF5' },
  LOGOUT:               { icon: '🚪', label: 'Logout',           color: '#64748B', bg: '#F1F5F9' },
  MEMBER_ADDED:         { icon: '➕', label: 'Member Added',     color: '#2563EB', bg: '#EFF6FF' },
  MEMBER_UPDATED:       { icon: '✏️', label: 'Member Updated',   color: '#D97706', bg: '#FFFBEB' },
  MEMBER_DELETED:       { icon: '🗑️', label: 'Member Deleted',   color: '#DC2626', bg: '#FEF2F2' },
  PLAN_ADDED:           { icon: '📋', label: 'Plan Added',       color: '#7C3AED', bg: '#F5F3FF' },
  PLAN_UPDATED:         { icon: '📋', label: 'Plan Updated',     color: '#7C3AED', bg: '#F5F3FF' },
  PAYMENT_RECORDED:     { icon: '💰', label: 'Payment',          color: '#059669', bg: '#ECFDF5' },
  PAYMENT_COLLECTED:    { icon: '💵', label: 'Collection',       color: '#059669', bg: '#ECFDF5' },
  BROADCAST_SENT:       { icon: '📢', label: 'Broadcast',        color: '#7C3AED', bg: '#F5F3FF' },
  EMPLOYEE_CREATED:     { icon: '👤', label: 'Employee Created', color: '#2563EB', bg: '#EFF6FF' },
  EMPLOYEE_UPDATED:     { icon: '👤', label: 'Employee Updated', color: '#D97706', bg: '#FFFBEB' },
  AUTOMATION_TRIGGERED: { icon: '⚡', label: 'Automation',       color: '#E11D48', bg: '#FFF1F2' },
  SETTINGS_UPDATED:     { icon: '⚙️', label: 'Settings',         color: '#64748B', bg: '#F1F5F9' },
  LEAD_ADDED:           { icon: '🎯', label: 'Lead Added',       color: '#2563EB', bg: '#EFF6FF' },
  LEAD_UPDATED:         { icon: '🎯', label: 'Lead Updated',     color: '#D97706', bg: '#FFFBEB' },
  LEAD_DELETED:         { icon: '🎯', label: 'Lead Deleted',     color: '#DC2626', bg: '#FEF2F2' },
  LEAD_CLAIMED:         { icon: '🤝', label: 'Lead Claimed',     color: '#7C3AED', bg: '#F5F3FF' },
  LEAD_WHATSAPP_SENT:   { icon: '💬', label: 'Lead WhatsApp',    color: '#059669', bg: '#ECFDF5' },
  LEAD_CONVERTED:       { icon: '🎉', label: 'Lead Converted',   color: '#059669', bg: '#ECFDF5' },
};

function toDate(ts: any): Date {
  if (!ts) return new Date();
  return ts.toDate ? ts.toDate() : new Date(ts);
}

export default function ActivityLogPage() {
  const { user, gymId: storeGymId } = useAuthStore();
  const { isMobile } = useResponsive();
  const { branches } = useBranch();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterUser, setFilterUser] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const gymId = storeGymId || user?.uid;

  useEffect(() => {
    if (!gymId) return;
    const unsub = subscribeAuditLogs(gymId, { limitCount: 500 }, (data) => {
      setLogs(data);
      setIsLoading(false);
    }, () => setIsLoading(false));
    return unsub;
  }, [gymId]);

  // Branch ID → name lookup
  const branchNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    branches.forEach(b => { if (b.id) map[b.id] = b.name; });
    return map;
  }, [branches]);

  const uniqueUsers = useMemo(() => {
    const names = new Set(logs.map(l => l.userName));
    return Array.from(names).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    let result = logs;
    if (filterUser !== 'all') result = result.filter(l => l.userName === filterUser);
    if (filterAction !== 'all') result = result.filter(l => l.actionType === filterAction);
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter(l => toDate(l.timestamp) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter(l => toDate(l.timestamp) <= to);
    }
    return result;
  }, [logs, filterUser, filterAction, dateFrom, dateTo]);

  // Stats for the filtered period
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(l => { counts[l.actionType] = (counts[l.actionType] || 0) + 1; });
    const uniqueActors = new Set(filtered.map(l => l.userName)).size;
    return { total: filtered.length, uniqueActors, counts };
  }, [filtered]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, AuditLogEntry[]> = {};
    for (const log of filtered) {
      const d = toDate(log.timestamp);
      const key = format(d, 'yyyy-MM-dd');
      if (!groups[key]) groups[key] = [];
      groups[key].push(log);
    }
    return groups;
  }, [filtered]);

  const clearFilters = () => {
    setFilterUser('all');
    setFilterAction('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasFilters = filterUser !== 'all' || filterAction !== 'all' || dateFrom || dateTo;

  const selectStyle: React.CSSProperties = {
    height: '40px', padding: '0 14px', borderRadius: '10px', border: '1px solid #E2E8F0',
    backgroundColor: '#FFF', color: '#0F172A', fontSize: '13px', fontWeight: '600', outline: 'none',
    fontFamily: "'Inter', sans-serif",
  };
  const dateStyle: React.CSSProperties = {
    ...selectStyle, width: isMobile ? '100%' : '150px',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '10px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: '4px', display: 'block',
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Audit Trail</h1>
        <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '500' }}>Complete activity log with timestamps, actors, and action details</p>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <div style={{ padding: '16px 20px', backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '14px' }}>
          <p style={{ fontSize: '10px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Total Events</p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: '800', color: '#0F172A', margin: 0 }}>{stats.total}</p>
        </div>
        <div style={{ padding: '16px 20px', backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '14px' }}>
          <p style={{ fontSize: '10px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Active Users</p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: '800', color: '#2563EB', margin: 0 }}>{stats.uniqueActors}</p>
        </div>
        <div style={{ padding: '16px 20px', backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '14px' }}>
          <p style={{ fontSize: '10px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Automations</p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: '800', color: '#E11D48', margin: 0 }}>{stats.counts['AUTOMATION_TRIGGERED'] || 0}</p>
        </div>
        <div style={{ padding: '16px 20px', backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '14px' }}>
          <p style={{ fontSize: '10px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Deletions</p>
          <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: '800', color: '#DC2626', margin: 0 }}>{stats.counts['MEMBER_DELETED'] || 0}</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>Filters</span>
          {hasFilters && (
            <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: '#E11D48', fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: 0 }}>Clear all</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
          <div style={{ flex: isMobile ? '1 1 100%' : 'none' }}>
            <label style={labelStyle}>Date From</label>
            <input type="date" style={{ ...dateStyle, width: isMobile ? '100%' : '150px' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div style={{ flex: isMobile ? '1 1 100%' : 'none' }}>
            <label style={labelStyle}>Date To</label>
            <input type="date" style={{ ...dateStyle, width: isMobile ? '100%' : '150px' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div style={{ flex: isMobile ? '1 1 100%' : 'none' }}>
            <label style={labelStyle}>User</label>
            <select style={{ ...selectStyle, width: isMobile ? '100%' : 'auto' }} value={filterUser} onChange={e => setFilterUser(e.target.value)}>
              <option value="all">All Users</option>
              {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div style={{ flex: isMobile ? '1 1 100%' : 'none' }}>
            <label style={labelStyle}>Action Type</label>
            <select style={{ ...selectStyle, width: isMobile ? '100%' : 'auto' }} value={filterAction} onChange={e => setFilterAction(e.target.value)}>
              <option value="all">All Actions</option>
              {Object.entries(actionConfig).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {isLoading ? (
          <div style={{ padding: '20px' }}>{[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: '52px', marginBottom: '8px', borderRadius: '10px' }} />)}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '80px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: '0 0 6px' }}>No activity found</p>
            <p style={{ fontSize: '14px', color: '#64748B', maxWidth: '340px', margin: '0 auto' }}>
              {hasFilters ? 'Try adjusting your filters to see more results.' : 'Actions will appear here as your team uses PingFlow.'}
            </p>
          </div>
        ) : (
          Object.entries(groupedByDate).map(([dateKey, entries]) => {
            const d = new Date(dateKey);
            const isToday = format(new Date(), 'yyyy-MM-dd') === dateKey;
            const isYesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd') === dateKey;
            const dateLabel = isToday ? 'Today' : isYesterday ? 'Yesterday' : format(d, 'EEEE, dd MMM yyyy');

            return (
              <div key={dateKey}>
                {/* Date separator */}
                <div style={{
                  padding: '12px 24px', backgroundColor: '#FAFBFC', borderBottom: '1px solid #F1F5F9',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  position: 'sticky', top: 0, zIndex: 2,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isToday ? '#10B981' : '#CBD5E1' }} />
                    <span style={{ fontSize: '13px', fontWeight: '800', color: isToday ? '#059669' : '#334155' }}>{dateLabel}</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', backgroundColor: '#F1F5F9', padding: '2px 10px', borderRadius: '20px' }}>{entries.length} events</span>
                </div>

                {/* Log entries */}
                {entries.map((log, i) => {
                  const cfg = actionConfig[log.actionType] || { icon: '📌', label: log.actionType, color: '#64748B', bg: '#F1F5F9' };
                  const time = toDate(log.timestamp);
                  const isStaff = log.userRole !== 'admin';

                  return (
                    <div key={log.id || i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '16px',
                      padding: '14px 24px', borderBottom: '1px solid #F8FAFC',
                      transition: 'background-color 150ms',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FAFBFC'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      {/* Timestamp */}
                      <div style={{ minWidth: '56px', paddingTop: '2px', textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>
                          {format(time, 'HH:mm')}
                        </span>
                      </div>

                      {/* Timeline dot + line */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: '4px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: cfg.color, boxShadow: `0 0 0 3px ${cfg.bg}` }} />
                        {i < entries.length - 1 && <div style={{ width: '2px', flex: 1, backgroundColor: '#F1F5F9', marginTop: '4px', minHeight: '20px' }} />}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>{log.userName}</span>
                          {isStaff && <span style={{ fontSize: '9px', fontWeight: '800', color: '#64748B', backgroundColor: '#F1F5F9', padding: '2px 7px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{log.userRole}</span>}
                          <span style={{ fontSize: '9px', fontWeight: '800', color: cfg.color, backgroundColor: cfg.bg, padding: '2px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {cfg.icon} {cfg.label}
                          </span>
                        </div>
                        <p style={{ fontSize: '13px', color: '#64748B', margin: 0, lineHeight: '1.5', fontWeight: '500' }}>{log.description}</p>
                        {log.branchId && log.branchId !== 'GLOBAL' && (
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', marginTop: '4px', display: 'inline-block' }}>📍 {branchNameMap[log.branchId] || log.branchId}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
