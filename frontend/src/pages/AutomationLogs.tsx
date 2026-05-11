import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import { triggerManualAutomation, syncMessageStatuses } from '@/services/whatsapp.service';
import {
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  collectionGroup,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

interface DeliveryHistoryEntry {
  status: string;
  rawStatus: string;
  timestamp: string;
  receivedAt?: any;
}

interface LogEntry {
  id: string;
  memberName: string;
  memberPhone?: string;
  destination?: string;
  eventType: string;
  status: string;
  error?: string;
  timestamp: any;
  campaignName?: string;
  templateParams?: string[];
  apiResponse?: string;
  gymId?: string;
  currentStatus?: string;
  deliveryHistory?: DeliveryHistoryEntry[];
  lastUpdated?: any;
}

const eventLabels: Record<string, { label: string; color: string; bg: string }> = {
  'D-3_WARNING': { label: 'D-3 Warning', color: '#F59E0B', bg: '#FFFBEB' },
  'D-0_EXPIRY': { label: 'Expiry Today', color: '#EF4444', bg: '#FEF2F2' },
  'D+2_PASSED': { label: 'Overdue +2', color: '#7C3AED', bg: '#F5F3FF' },
  'expiry_reminder_d3': { label: 'D-3 Warning', color: '#F59E0B', bg: '#FFFBEB' },
  'expiry_alert_d0': { label: 'Expiry Today', color: '#EF4444', bg: '#FEF2F2' },
  'expiry_followup_d2': { label: 'Follow-up', color: '#7C3AED', bg: '#F5F3FF' },
  'inactivity_d5': { label: 'Inactive 5d', color: '#6366F1', bg: '#EEF2FF' },
  'inactivity_d10': { label: 'Inactive 10d', color: '#EC4899', bg: '#FDF2F8' },
};

export default function AutomationLogs() {
  const { gym, user } = useAuthStore();
  const { isMobile } = useResponsive();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const gymId = gym?.id || user?.uid;

  useEffect(() => {
    if (!gymId) return;

    let unsubscribe: () => void;

    try {
      const logsRef = collectionGroup(db, 'automationLogs');
      const q = query(logsRef, where('gymId', '==', gymId), orderBy('timestamp', 'desc'), limit(50));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as LogEntry));
        setLogs(data);
        setIsLoading(false);
      }, (error) => {
        console.error('[AutomationLogs] Snapshot error:', error);
        setIsLoading(false);
      });
    } catch (err) {
      console.error('[AutomationLogs] Setup error:', err);
      setIsLoading(false);
    }

    return () => { if (unsubscribe) unsubscribe(); };
  }, [gymId]);

  const handleTrigger = async () => {
    if (!gymId || isTriggering) return;
    setIsTriggering(true);
    try {
      const result = await triggerManualAutomation(gymId);
      const count = (result as any)?.data?.count ?? (result as any)?.count ?? 0;
      alert(`✅ Automation Triggered! Processed ${count} messages.`);
    } catch (error: any) {
      alert(`❌ Trigger failed: ${error.message}`);
    } finally {
      setIsTriggering(false);
    }
  };

  const handleSyncStatuses = async () => {
    if (!gymId || isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await syncMessageStatuses(gymId);
      if (result.success) {
        alert(`✅ Synced ${result.synced || 0} statuses (${result.skipped || 0} skipped, ${result.errors || 0} errors)`);
      } else {
        alert(`❌ Sync failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`❌ Sync failed: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return '—';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  };

  const getEventInfo = (type: string) => eventLabels[type] || { label: type, color: '#64748B', bg: '#F1F5F9' };

  // Build a WhatsApp-style message preview from stored template params
  const getMessagePreview = (log: LogEntry): string => {
    const p = log.templateParams;
    if (!p || p.length < 3) return 'Message details not available';
    const name = p[0], gym = p[1], date = p[2];
    switch (log.eventType) {
      case 'D-3_WARNING':
        return `Hi ${name} 👋\n\nYour fitness journey at ${gym} has been incredible, but your current membership expires in 3 days on ${date}. 💪\n\nDon't let your momentum stop now! Renew today and stay on track toward your goals.`;
      case 'D-0_EXPIRY':
        return `Hi ${name} 👋\n\nThis is it! Your membership at ${gym} officially expires today, ${date}. 🏋️ Don't let your hard work go to waste!\n\nRenew right now to keep your access active.`;
      case 'D+2_PASSED':
        return `Hi ${name} 👋\n\nWe miss you at ${gym}! 😊 Your membership expired on ${date}.\n\nIt's not too late — come back and pick up where you left off!`;
      default:
        return `Message sent to ${name} for ${gym} (${date})`;
    }
  };

  // Parse AiSensy response for delivery tracking — uses webhook currentStatus if available
  const getDeliveryInfo = (log: LogEntry): { messageId: string | null; deliveryStatus: string; statusColor: string } => {
    if (log.status === 'FAILED') return { messageId: null, deliveryStatus: 'Failed', statusColor: '#EF4444' };

    // Use webhook-updated currentStatus if available
    if (log.currentStatus) {
      const colorMap: Record<string, string> = {
        'Delivered': '#10B981',
        'Read': '#3B82F6',
        'Failed': '#EF4444',
        'Sent': '#F59E0B',
        'Queued': '#94A3B8',
      };
      return {
        messageId: null,
        deliveryStatus: log.currentStatus,
        statusColor: colorMap[log.currentStatus] || '#64748B',
      };
    }

    try {
      const resp = log.apiResponse ? JSON.parse(log.apiResponse) : null;
      const messageId = resp?.submitted_message_id || null;
      return { messageId, deliveryStatus: messageId ? 'Submitted' : 'Queued', statusColor: '#F59E0B' };
    } catch {
      return { messageId: null, deliveryStatus: 'Sent', statusColor: '#F59E0B' };
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '24px', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
        <div>
          <h1 style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: isMobile ? '22px' : '28px', fontWeight: '800',
            color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.02em',
          }}>Automation Logs</h1>
          <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>Track your automated WhatsApp notifications</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexDirection: isMobile ? 'column' : 'row' }}>
          <button
            onClick={handleSyncStatuses}
            disabled={isSyncing}
            className="btn-press"
            style={{
              padding: '10px 18px', borderRadius: '12px',
              background: isSyncing ? '#94A3B8' : '#FFFFFF',
              color: isSyncing ? '#FFFFFF' : '#334155',
              border: '1px solid #E2E8F0',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: '700',
              transition: 'all 200ms',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            {isSyncing ? (
              <>
                <div style={{ width: '14px', height: '14px', border: '2px solid rgba(0,0,0,0.15)', borderTop: '2px solid #334155', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                Syncing…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                Sync Status
              </>
            )}
          </button>
          <button 
            onClick={handleTrigger} 
            disabled={isTriggering}
            className="btn-press"
            style={{
              padding: '10px 20px', borderRadius: '12px',
              background: isTriggering ? '#94A3B8' : 'linear-gradient(135deg, #E11D48, #BE123C)',
              color: '#FFFFFF', border: 'none', cursor: isTriggering ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: '700',
              boxShadow: isTriggering ? 'none' : '0 4px 14px rgba(225,29,72,0.3)',
              transition: 'all 200ms',
              display: 'flex', alignItems: 'center', gap: '8px',
              letterSpacing: '0.01em',
            }}
          >
            {isTriggering ? (
              <>
                <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #FFFFFF', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                Processing…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                Run Manual Trigger
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      {!isLoading && logs.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
          {[
            { label: 'Total Sent', value: logs.length, color: '#3B82F6' },
            { label: 'Successful', value: logs.filter(l => l.status === 'SUCCESS').length, color: '#10B981' },
            { label: 'Failed', value: logs.filter(l => l.status === 'FAILED').length, color: '#EF4444' },
            { label: 'Today', value: logs.filter(l => { try { const d = l.timestamp?.toDate?.(); return d && d.toDateString() === new Date().toDateString(); } catch { return false; } }).length, color: '#7C3AED' },
          ].map(stat => (
            <div key={stat.label} style={{
              backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px',
              padding: '14px 16px', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', backgroundColor: stat.color, opacity: 0.5 }} />
              <p style={{ fontSize: '11px', fontWeight: '600', color: '#64748B', margin: '0 0 4px' }}>{stat.label}</p>
              <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: '800', color: '#0F172A', margin: 0 }}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Logs Table */}
      <div style={{
        backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0',
        borderRadius: '14px', overflow: 'hidden',
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr auto' : '140px 1fr 120px 90px 1fr',
          padding: '12px 18px',
          borderBottom: '1px solid #F1F5F9',
          backgroundColor: '#FAFBFC',
        }}>
          {(isMobile ? ['Time', 'Member', 'Status'] : ['Time', 'Member', 'Event', 'Status', 'Details']).map(h => (
            <span key={h} style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</span>
          ))}
        </div>

        {/* Table Body */}
        {isLoading ? (
          <div style={{ padding: '16px' }}>
            {[1,2,3,4,5].map(i => <div key={i} style={{ marginBottom: '10px' }}><div className="skeleton" style={{ height: '48px', borderRadius: '8px' }} /></div>)}
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📡</div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '700', color: '#0F172A', margin: '0 0 4px' }}>No automations yet</p>
            <p style={{ fontSize: '14px', color: '#64748B', maxWidth: '300px', margin: '0 auto' }}>Click "Run Manual Trigger" to send your first batch of expiry reminders.</p>
          </div>
        ) : (
          <div>
            {logs.map((log, i) => {
              const evt = getEventInfo(log.eventType);
              const isExpanded = expandedRow === log.id;
              const delivery = getDeliveryInfo(log);
              return (
                <div key={log.id}>
                  <div 
                    className="row-hover"
                    onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr 1fr auto' : '140px 1fr 120px 90px 1fr',
                      padding: '14px 18px',
                      borderBottom: isExpanded ? 'none' : '1px solid #F8FAFC',
                      alignItems: 'center',
                      cursor: 'pointer',
                      animation: `fadeUp 400ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 30}ms forwards`,
                      opacity: 0,
                    }}
                  >
                    {/* Time */}
                    <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em' }}>
                      {formatTimestamp(log.timestamp)}
                    </span>

                    {/* Member */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #FFF1F2, #FECDD3)',
                        color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: '700', flexShrink: 0,
                      }}>{log.memberName?.charAt(0) || '?'}</div>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{log.memberName}</span>
                    </div>

                    {/* Event (desktop) */}
                    {!isMobile && (
                      <span style={{
                        fontSize: '11px', fontWeight: '700',
                        backgroundColor: evt.bg, color: evt.color,
                        padding: '3px 10px', borderRadius: '8px',
                        display: 'inline-block', width: 'fit-content',
                        letterSpacing: '0.02em',
                      }}>{evt.label}</span>
                    )}

                    {/* Status — shows real delivery status from webhook */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{
                        width: '7px', height: '7px', borderRadius: '50%',
                        backgroundColor: delivery.statusColor,
                      }} />
                      <span style={{
                        fontSize: '12px', fontWeight: '600',
                        color: delivery.statusColor,
                      }}>{log.status === 'FAILED' ? 'Failed' : delivery.deliveryStatus}</span>
                    </div>

                    {/* Details toggle (desktop) */}
                    {!isMobile && (
                      <span style={{ fontSize: '12px', color: '#3B82F6', fontWeight: '600', cursor: 'pointer' }}>
                        {isExpanded ? 'Hide ▲' : 'View ▼'}
                      </span>
                    )}
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div style={{
                      padding: '0 18px 18px',
                      borderBottom: '1px solid #F1F5F9',
                      animation: 'fadeUp 300ms ease forwards',
                    }}>
                      <div style={{
                        backgroundColor: '#F8FAFC', borderRadius: '14px',
                        border: '1px solid #E2E8F0', overflow: 'hidden',
                      }}>
                        {/* Message preview */}
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0' }}>
                          <p style={{ fontSize: '10px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>Message Sent</p>
                          <div style={{
                            backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '14px 16px',
                            border: '1px solid #E2E8F0', fontSize: '13px', color: '#334155',
                            lineHeight: '1.7', whiteSpace: 'pre-line',
                          }}>
                            {getMessagePreview(log)}
                          </div>
                        </div>

                        {/* Delivery details grid */}
                        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '16px' }}>
                          <div>
                            <p style={{ fontSize: '10px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Recipient</p>
                            <p style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', margin: 0 }}>{log.memberName}</p>
                            <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0', fontFamily: "'JetBrains Mono', monospace" }}>+{log.destination || log.memberPhone || '—'}</p>
                          </div>
                          <div>
                            <p style={{ fontSize: '10px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Delivery Status</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: delivery.statusColor }} />
                              <p style={{ fontSize: '13px', fontWeight: '700', color: delivery.statusColor, margin: 0 }}>{delivery.deliveryStatus}</p>
                            </div>
                            {delivery.messageId && (
                              <p style={{ fontSize: '10px', color: '#94A3B8', margin: '4px 0 0', fontFamily: "'JetBrains Mono', monospace", wordBreak: 'break-all' }}>ID: {delivery.messageId}</p>
                            )}
                            {/* Delivery history timeline */}
                            {log.deliveryHistory && log.deliveryHistory.length > 0 && (
                              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {log.deliveryHistory.map((h, idx) => (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: h.status === 'Read' ? '#3B82F6' : h.status === 'Delivered' ? '#10B981' : h.status === 'Failed' ? '#EF4444' : '#94A3B8', flexShrink: 0 }} />
                                    <span style={{ fontWeight: '600', color: '#334155' }}>{h.status}</span>
                                    <span style={{ color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px' }}>{h.timestamp ? new Date(h.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <p style={{ fontSize: '10px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Template</p>
                            <p style={{ fontSize: '12px', fontWeight: '600', color: '#334155', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>{log.campaignName || '—'}</p>
                          </div>
                        </div>

                        {/* Error section if failed */}
                        {log.error && (
                          <div style={{ padding: '12px 20px', backgroundColor: '#FEF2F2', borderTop: '1px solid #FECDD3' }}>
                            <p style={{ fontSize: '10px', fontWeight: '800', color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px' }}>Error</p>
                            <p style={{ fontSize: '12px', color: '#DC2626', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>{log.error}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
