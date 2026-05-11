import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import { useRole } from '@/hooks/useRole';
import { useWallet } from '@/hooks/useWallet';
import {
  subscribeMembers,
  subscribeExpiringMembers,
  subscribeRecentAutomationLogs,
} from '@/services/members.service';
import type { Member, AutomationLog, MemberStatus, AutomationEventType } from '@/types';
import {
  subscribePayments,
  computeBillingStats,
} from '@/services/billing.service';
import { formatINR } from '@/utils/billing.utils';
import BranchComparisonChart from '@/components/ui/BranchComparisonChart';
import TopUpModal from '@/components/ui/TopUpModal';
import WhatsAppConnectCard from '@/components/ui/WhatsAppConnectCard';
import type { Payment } from '@/types';

const eventTypeShortLabels: Record<AutomationEventType, string> = {
  expiry_reminder_d3: 'Expiry Reminder',
  expiry_alert_d0: 'Expiry Alert',
  expiry_followup_d2: 'Follow-up',
  inactivity_d5: 'Inactive 5d',
  inactivity_d10: 'Inactive 10d',
};

/* Animated Counter Component */
function AnimatedCounter({ value, prefix = '', suffix = '' }: { value: number | string; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const numVal = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) || 0 : value;
  
  useEffect(() => {
    if (numVal === 0) { setDisplay(0); return; }
    const duration = 800;
    const steps = 30;
    const increment = numVal / steps;
    let current = 0;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      current = Math.min(current + increment, numVal);
      setDisplay(Math.round(current));
      if (step >= steps) { setDisplay(numVal); clearInterval(timer); }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [numVal]);

  return <span style={{ animation: 'countUp 600ms cubic-bezier(0.16, 1, 0.3, 1)' }}>{prefix}{typeof value === 'string' ? value : display}{suffix}</span>;
}

/* Skeleton Loader */
function Skeleton({ width = '100%', height = '20px', borderRadius = '8px' }: { width?: string; height?: string; borderRadius?: string }) {
  return <div className="skeleton" style={{ width, height, borderRadius }} />;
}

export default function Dashboard() {
  const { gym, user } = useAuthStore();
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const { isAdmin } = useRole();
  const { canAccessWallet } = useRole();
  const { balance } = useWallet();
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);

  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [expiringMembers, setExpiringMembers] = useState<Member[]>([]);
  const [recentLogs, setRecentLogs] = useState<AutomationLog[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Use gymId from store (resolves correctly for both admin and employee)
  const gymId = useAuthStore(s => s.gymId) || user?.uid;
  const activeBranchId = useAuthStore(s => s.activeBranchId);
  const branches = useAuthStore(s => s.branches);

  // Global view = admin with no branch selected (activeBranchId is null)
  const isGlobalView = isAdmin && !activeBranchId && branches.length > 1;

  useEffect(() => {
    if (!gymId) return;

    // Clear previous data immediately to prevent stale data flicker
    setAllMembers([]);
    setExpiringMembers([]);
    setRecentLogs([]);
    setPayments([]);
    setIsLoading(true);

    let loadedCount = 0;
    const checkLoaded = () => { loadedCount++; if (loadedCount >= 4) setIsLoading(false); };

    const unsubAll = subscribeMembers(gymId, (data) => { setAllMembers(data); checkLoaded(); }, () => checkLoaded());
    const unsubExpiring = subscribeExpiringMembers(gymId, 7, (data) => { setExpiringMembers(data); checkLoaded(); }, () => checkLoaded());
    const unsubLogs = subscribeRecentAutomationLogs(gymId, 10, (data) => { setRecentLogs(data); checkLoaded(); }, () => checkLoaded());
    const unsubPayments = subscribePayments(gymId, (data) => { setPayments(data); checkLoaded(); }, () => checkLoaded());

    return () => { unsubAll(); unsubExpiring(); unsubLogs(); unsubPayments(); };
  }, [gymId, activeBranchId]); // Re-subscribe when branch changes

  const statusCounts: Record<MemberStatus | 'total', number> = { total: allMembers.length, active: 0, expiring_soon: 0, expired: 0, inactive: 0 };
  allMembers.forEach(m => { statusCounts[m.status]++; });

  const statCards = [
    { label: 'Total Clients', count: statusCounts.total, icon: '💆', gradient: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', accentColor: '#3B82F6', iconBg: 'rgba(59,130,246,0.1)' },
    { label: 'Active', count: statusCounts.active, icon: '✨', gradient: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)', accentColor: '#10B981', iconBg: 'rgba(16,185,129,0.1)' },
    { label: 'Expiring Soon', count: statusCounts.expiring_soon, icon: '⏳', gradient: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)', accentColor: '#F59E0B', iconBg: 'rgba(245,158,11,0.1)' },
    { label: 'Expired', count: statusCounts.expired, icon: '🚨', gradient: 'linear-gradient(135deg, #FEF2F2 0%, #FECDD3 100%)', accentColor: '#EF4444', iconBg: 'rgba(239,68,68,0.1)' },
  ];

  const billingStats = computeBillingStats(payments);

  const revenueCards = [
    { label: 'Revenue This Month', value: formatINR(billingStats.totalCollectedThisMonth), icon: '💰', accentColor: '#10B981', iconBg: 'rgba(16,185,129,0.08)' },
    { label: 'Pending Dues', value: formatINR(billingStats.pendingDues), icon: '📋', accentColor: '#F59E0B', iconBg: 'rgba(245,158,11,0.08)' },
    { label: 'Revenue This Year', value: formatINR(billingStats.totalCollectedThisYear), icon: '📊', accentColor: '#3B82F6', iconBg: 'rgba(59,130,246,0.08)' },
  ];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Welcome Header */}
      <div style={{ marginBottom: isMobile ? '20px' : '28px', display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
        <div>
          <h1 style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: isMobile ? '22px' : '28px', fontWeight: '800',
            color: '#0F172A', margin: '0 0 4px',
            lineHeight: 1.2, letterSpacing: '-0.02em',
          }}>{greeting()}, {(gym?.ownerName || 'User').split(' ')[0]} 👋</h1>
          <p style={{
            fontSize: isMobile ? '13px' : '14px', color: '#64748B', margin: 0, fontWeight: '400',
          }}>Here's what's happening at <span style={{ fontWeight: '600', color: '#334155' }}>{isGlobalView ? 'all branches' : (gym?.name || 'your salon')}</span> today</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => navigate('/members')} 
            className="btn-press"
            style={{
              padding: '8px 16px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #E11D48, #BE123C)',
              color: '#FFFFFF', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: '600',
              boxShadow: '0 2px 8px rgba(225,29,72,0.25)',
              transition: 'all 200ms',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            Add Client
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stagger" style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : (isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)'),
        gap: isMobile ? '10px' : '14px',
        marginBottom: isMobile ? '16px' : '20px',
      }}>
        {statCards.map(card => (
          <div key={card.label} className="card-hover" style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: isMobile ? '14px' : '18px 20px',
            cursor: 'default',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Subtle gradient accent */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${card.accentColor}, transparent)`, opacity: 0.6 }} />
            
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', marginBottom: isMobile ? '10px' : '14px',
            }}>
              <span style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '600', color: '#64748B', letterSpacing: '0.01em' }}>{card.label}</span>
              <div style={{
                width: isMobile ? '28px' : '34px', height: isMobile ? '28px' : '34px', borderRadius: '10px',
                backgroundColor: card.iconBg,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: isMobile ? '14px' : '16px',
              }}>{card.icon}</div>
            </div>
            
            <div style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: isMobile ? '28px' : '36px', fontWeight: '800',
              color: '#0F172A', lineHeight: 1,
              letterSpacing: '-0.02em',
            }}>
              {isLoading ? <Skeleton width="60px" height={isMobile ? '28px' : '36px'} /> : <AnimatedCounter value={card.count} />}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Row */}
      <div className="stagger" style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : (canAccessWallet ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)'),
        gap: isMobile ? '10px' : '14px',
        marginBottom: isMobile ? '16px' : '20px',
      }}>
        {revenueCards.map(card => (
          <div key={card.label} className="card-hover" style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: isMobile ? '14px' : '18px 20px',
            cursor: 'default',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${card.accentColor}, transparent)`, opacity: 0.6 }} />
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', marginBottom: '10px',
            }}>
              <span style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '600', color: '#64748B' }}>{card.label}</span>
              <div style={{
                width: '34px', height: '34px', borderRadius: '10px',
                backgroundColor: card.iconBg,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '16px',
              }}>{card.icon}</div>
            </div>
            <div style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: isMobile ? '22px' : '26px', fontWeight: '800',
              color: '#0F172A', lineHeight: 1, letterSpacing: '-0.02em',
            }}>
              {isLoading ? <Skeleton width="80px" height="26px" /> : card.value}
            </div>
          </div>
        ))}

        {/* Wallet Card */}
        {canAccessWallet && (
          <div
            className="card-hover btn-press"
            onClick={() => setIsTopUpOpen(true)}
            style={{
              background: 'linear-gradient(135deg, #0F172A, #1E293B)',
              border: '1px solid #334155',
              borderRadius: '14px',
              padding: isMobile ? '14px' : '18px 20px',
              cursor: 'pointer',
              position: 'relative', overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #8B5CF6, transparent)', opacity: 0.6 }} />
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-start', marginBottom: '10px',
            }}>
              <span style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '600', color: '#94A3B8' }}>WhatsApp Wallet</span>
              <div style={{
                width: '34px', height: '34px', borderRadius: '10px',
                backgroundColor: 'rgba(139,92,246,0.15)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '16px',
              }}>💎</div>
            </div>
            <div style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: isMobile ? '22px' : '26px', fontWeight: '800',
              color: '#F0F6FF', lineHeight: 1, letterSpacing: '-0.02em',
              marginBottom: '8px',
            }}>
              ₹{balance.toFixed(2)}
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '3px 10px', borderRadius: '6px',
              backgroundColor: 'rgba(59,130,246,0.15)', color: '#60A5FA',
              fontSize: '10px', fontWeight: '800', letterSpacing: '0.04em',
            }}>+ TOP UP</div>
          </div>
        )}
      </div>

      {canAccessWallet && <TopUpModal isOpen={isTopUpOpen} onClose={() => setIsTopUpOpen(false)} currentBalance={balance} />}

      {/* WhatsApp Connect Card — Admin only */}
      {isAdmin && (
        <div style={{ marginBottom: isMobile ? '16px' : '20px' }}>
          <WhatsAppConnectCard />
        </div>
      )}

      {/* Branch Comparison — Global View only (Admin) */}
      {isGlobalView && (
        <div style={{
          backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '14px',
          padding: '20px', marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '16px' }}>🌐</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>Branch Performance</span>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#3B82F6', backgroundColor: '#EFF6FF', padding: '2px 8px', borderRadius: '6px' }}>GLOBAL VIEW</span>
          </div>
          <BranchComparisonChart
            data={branches.filter(b => b.isActive).map(b => ({
              branch: b,
              memberCount: allMembers.filter(m => (m as any).branchId === b.id).length || Math.floor(allMembers.length / Math.max(branches.length, 1)),
              revenue: payments.filter(p => (p as any).branchId === b.id).reduce((sum, p) => sum + p.paidAmount, 0) || Math.floor(billingStats.totalCollectedThisMonth / Math.max(branches.length, 1)),
            }))}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Bottom Widgets */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
        gap: isMobile ? '10px' : '14px',
        marginBottom: '20px'
      }}>
        {/* Expiring Soon Widget */}
        <div className="card-hover" style={{
          backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0',
          borderRadius: '14px', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#F59E0B' }}/>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>Expiring Soon</span>
              {expiringMembers.length > 0 && (
                <span style={{ fontSize: '11px', fontWeight: '700', backgroundColor: '#FEF3C7', color: '#92400E', padding: '1px 8px', borderRadius: '10px' }}>{expiringMembers.length}</span>
              )}
            </div>
            <button onClick={() => navigate('/members')} style={{ fontSize: '12px', color: '#E11D48', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}>View All →</button>
          </div>
          <div style={{ minHeight: '260px', maxHeight: '360px', overflowY: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: '12px' }}>
                {[1,2,3].map(i => <div key={i} style={{ padding: '10px', marginBottom: '6px' }}><Skeleton height="40px" /></div>)}
              </div>
            ) : expiringMembers.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
                <p style={{ fontSize: '14px', color: '#64748B', fontWeight: '500' }}>All clear! No expiries soon.</p>
              </div>
            ) : (
              <div style={{ padding: '6px' }}>
                {expiringMembers.map((m, i) => (
                  <div 
                    key={m.id} 
                    onClick={() => navigate(`/members/${m.id}`)} 
                    className="row-hover"
                    style={{ 
                      padding: '10px 12px', borderRadius: '10px', 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                      cursor: 'pointer',
                      animation: `fadeUp 400ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 50}ms forwards`,
                      opacity: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ 
                        width: '32px', height: '32px', borderRadius: '50%', 
                        background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
                        color: '#92400E', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        fontWeight: '700', fontSize: '12px' 
                      }}>{m.name.charAt(0)}</div>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: '600', margin: 0, color: '#0F172A' }}>{m.name}</p>
                        <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>{m.planName}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '12px', fontWeight: '600', margin: 0, color: '#334155' }}>{format(m.endDate.toDate(), 'dd MMM')}</p>
                      <p style={{ fontSize: '10px', color: '#F59E0B', fontWeight: '600', margin: 0 }}>{formatDistanceToNow(m.endDate.toDate(), { addSuffix: true })}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity Log Widget */}
        <div className="card-hover" style={{
          backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0',
          borderRadius: '14px', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#E11D48' }}/>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>Activity Log</span>
            </div>
            <button onClick={() => navigate('/automations')} style={{ fontSize: '12px', color: '#E11D48', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}>View All →</button>
          </div>
          <div style={{ minHeight: '260px', maxHeight: '360px', overflowY: 'auto' }}>
            {isLoading ? (
              <div style={{ padding: '12px' }}>
                {[1,2,3].map(i => <div key={i} style={{ padding: '10px', marginBottom: '6px' }}><Skeleton height="40px" /></div>)}
              </div>
            ) : recentLogs.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📡</div>
                <p style={{ fontSize: '14px', color: '#64748B', fontWeight: '500' }}>No automations sent yet.</p>
                <p style={{ fontSize: '12px', color: '#94A3B8' }}>Run your first trigger from the Automations page.</p>
              </div>
            ) : (
              <div style={{ padding: '6px', position: 'relative' }}>
                {/* Timeline line */}
                <div style={{ position: 'absolute', left: '22px', top: '20px', bottom: '20px', width: '1.5px', backgroundColor: '#F1F5F9' }} />
                {recentLogs.map((log, i) => (
                  <div 
                    key={log.id} 
                    style={{ 
                      padding: '10px 12px 10px 36px', borderRadius: '10px', 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      position: 'relative',
                      animation: `fadeUp 400ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 50}ms forwards`,
                      opacity: 0,
                    }}
                  >
                    {/* Timeline dot */}
                    <div style={{
                      position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)',
                      width: '8px', height: '8px', borderRadius: '50%',
                      backgroundColor: '#E11D48', border: '2px solid #FFFFFF',
                      boxShadow: '0 0 0 2px #FFF1F2',
                      zIndex: 1,
                    }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: '600', margin: 0, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.memberName}</p>
                      <p style={{ fontSize: '11px', color: '#64748B', margin: 0 }}>{eventTypeShortLabels[log.eventType]}</p>
                    </div>
                    <span style={{ fontSize: '10px', color: '#94A3B8', whiteSpace: 'nowrap', fontWeight: '500' }}>{log.timestamp ? formatDistanceToNow(log.timestamp.toDate(), { addSuffix: true }) : '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="stagger" style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        gap: isMobile ? '10px' : '14px',
        paddingBottom: '40px'
      }}>
        {[
          { label: 'Create Packages', desc: 'Set up service packages', icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14,2 14,8 20,8"/></svg>
          ), path: '/plans' },
          { label: 'Add Client', desc: 'Register a new client', icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          ), path: '/members' },
          { label: 'Run Automation', desc: 'Send renewal reminders', icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          ), path: '/automations' },
        ].map(item => (
          <div 
            key={item.label} 
            onClick={() => navigate(item.path)}
            className="card-hover btn-press"
            style={{
              backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer',
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#FFF1F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '700', margin: 0, color: '#0F172A' }}>{item.label}</p>
              <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>{item.desc}</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}><polyline points="9,18 15,12 9,6"/></svg>
          </div>
        ))}
      </div>
    </div>
  );
}
