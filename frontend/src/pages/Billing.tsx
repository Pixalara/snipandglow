// PingFlow — Billing Page
// Premium Overhaul with Light Theme, Animations, and High-End Typography

import { useState, useEffect, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import {
  subscribePayments,
  subscribeBillingSettings,
  createPayment,
  computeBillingStats,
  initBillingSettings,
  recordAdditionalPayment,
} from '@/services/billing.service';
import { subscribeMembers } from '@/services/members.service';
import { subscribePlans } from '@/services/plans.service';
import { generateInvoice } from '@/utils/invoicePDF';
import {
  formatINR,
  formatDateIN,
  getStatusColor,
  statusLabels,
  modeConfig,
} from '@/utils/billing.utils';
import Modal from '@/components/ui/Modal';
import { PrimaryButton, GhostButton } from '@/components/ui/ModalButtons';
import { toast } from '@/components/ui/Toast';
import type {
  Payment,
  BillingSettings,
  Member,
  Plan,
  PaymentStatus,
  PaymentMode,
} from '@/types';

const Icons = {
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  print: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
    </svg>
  ),
  collect: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
};

export default function BillingPage() {
  const { user, gym } = useAuthStore();
  const { isMobile, isTablet } = useResponsive();

  // Data state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingSettings, setBillingSettings] = useState<BillingSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // UI state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCollectOpen, setIsCollectOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | PaymentStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Create form state
  const [formMemberId, setFormMemberId] = useState('');
  const [formMemberSearch, setFormMemberSearch] = useState('');
  const [formMemberDropdownOpen, setFormMemberDropdownOpen] = useState(false);
  const [formPlanId, setFormPlanId] = useState('');
  const [formSubtotal, setFormSubtotal] = useState('');
  const [formPaidAmount, setFormPaidAmount] = useState('');
  const [formPaymentMode, setFormPaymentMode] = useState<PaymentMode>('cash');
  const [formUpiTxnId, setFormUpiTxnId] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Collect form state
  const [collectAmount, setCollectAmount] = useState('');

  // Ref for click-outside on member search dropdown
  const memberSearchRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (memberSearchRef.current && !memberSearchRef.current.contains(e.target as Node)) {
        setFormMemberDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Data subscriptions ─────────────────────────────────────────────────
  const activeBranchId = useAuthStore(s => s.activeBranchId);

  useEffect(() => {
    if (!user) return;

    // Clear data on branch switch
    setPayments([]);
    setMembers([]);
    setPlans([]);
    setIsLoading(true);

    let loaded = 0;
    const checkLoaded = () => { loaded++; if (loaded >= 4) setIsLoading(false); };

    if (gym) {
      initBillingSettings(user.uid, gym.name, gym.phone)
        .then(() => checkLoaded())
        .catch((err) => { console.error('Init billing settings failed:', err); checkLoaded(); });
    } else {
      checkLoaded();
    }

    const unsubPayments = subscribePayments(
      user.uid,
      (data) => { setPayments(data); checkLoaded(); },
      () => checkLoaded()
    );

    const unsubMembers = subscribeMembers(
      user.uid,
      (data) => { setMembers(data); checkLoaded(); },
      () => checkLoaded()
    );

    const unsubPlans = subscribePlans(
      user.uid,
      (data) => { setPlans(data.filter(p => p.isActive)); checkLoaded(); },
      () => checkLoaded()
    );

    const unsubSettings = subscribeBillingSettings(
      user.uid,
      (data) => setBillingSettings(data),
      () => {}
    );

    return () => {
      unsubPayments();
      unsubMembers();
      unsubPlans();
      unsubSettings();
    };
  }, [user, gym, activeBranchId]);

  // ─── Computed values ──────────────────────────────────────────────────

  const stats = useMemo(() => computeBillingStats(payments), [payments]);

  // Filtered members for searchable dropdown
  const filteredMembers = useMemo(() => {
    if (!formMemberSearch.trim()) return members;
    const q = formMemberSearch.toLowerCase();
    return members.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.phone.includes(q)
    );
  }, [members, formMemberSearch]);

  // Auto-fill plan when member is selected
  const handleMemberSelect = (member: Member) => {
    setFormMemberId(member.id!);
    setFormMemberSearch(member.name);
    setFormMemberDropdownOpen(false);

    // Auto-fill the member's current plan
    if (member.planId) {
      const memberPlan = plans.find(p => p.id === member.planId);
      if (memberPlan) {
        setFormPlanId(member.planId);
      }
    }
  };

  const filteredPayments = useMemo(() => {
    let result = payments;
    if (filterStatus !== 'all') {
      result = result.filter(p => p.status === filterStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.memberName.toLowerCase().includes(q) ||
        p.invoiceNumber.toLowerCase().includes(q)
      );
    }
    return result;
  }, [payments, filterStatus, searchQuery]);

  useEffect(() => {
    if (formPlanId) {
      const plan = plans.find(p => p.id === formPlanId);
      if (plan) {
        setFormSubtotal(String(plan.price));
        if (formStartDate) {
          const start = new Date(formStartDate);
          const end = new Date(start);
          end.setDate(end.getDate() + plan.durationDays);
          setFormEndDate(format(end, 'yyyy-MM-dd'));
        }
      }
    }
  }, [formPlanId, formStartDate, plans]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const resetCreateForm = () => {
    setFormMemberId('');
    setFormMemberSearch('');
    setFormMemberDropdownOpen(false);
    setFormPlanId('');
    setFormSubtotal('');
    setFormPaidAmount('');
    setFormPaymentMode('cash');
    setFormUpiTxnId('');
    setFormStartDate(format(new Date(), 'yyyy-MM-dd'));
    setFormEndDate('');
    setFormNotes('');
  };

  const openCreateModal = () => {
    resetCreateForm();
    setFormStartDate(format(new Date(), 'yyyy-MM-dd'));
    setIsCreateOpen(true);
  };

  const handleCreatePayment = async () => {
    if (!user) return;
    let settings = billingSettings;
    if (!settings) {
      try {
        settings = await initBillingSettings(user.uid, gym?.name || 'My Gym', gym?.phone || '');
        setBillingSettings(settings);
      } catch (err) {
        toast('Billing settings failed to initialize.', 'error');
        return;
      }
    }

    if (!formMemberId || !formPlanId || !formStartDate || !formEndDate) {
      toast('Please fill all required fields.', 'error');
      return;
    }

    const member = members.find(m => m.id === formMemberId);
    const plan = plans.find(p => p.id === formPlanId);
    if (!member || !plan) { toast('Invalid selection.', 'error'); return; }

    setIsSaving(true);
    try {
      await createPayment(user.uid, {
          memberId: formMemberId,
          planId: formPlanId,
          subtotal: Number(formSubtotal) || 0,
          paidAmount: Number(formPaidAmount) || 0,
          paymentMode: formPaymentMode,
          upiTransactionId: formUpiTxnId || undefined,
          membershipStartDate: new Date(formStartDate),
          membershipEndDate: new Date(formEndDate),
          notes: formNotes || undefined,
        }, member, plan, settings);
      toast('Payment recorded successfully!', 'success');
      setIsCreateOpen(false);
    } catch (err) {
      toast('Failed to record payment.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCollectPayment = async () => {
    if (!user || !selectedPayment) return;
    const amount = Number(collectAmount);
    if (!amount || amount <= 0) { toast('Enter valid amount', 'error'); return; }

    setIsSaving(true);
    try {
      await recordAdditionalPayment(user.uid, selectedPayment.id, amount);
      toast('Payment success!', 'success');
      setIsCollectOpen(false);
      setSelectedPayment(null);
      setCollectAmount('');
    } catch (err) {
      toast('Failed to collect payment.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintInvoice = (payment: Payment) => {
    if (!billingSettings) { toast('Setup billing info first.', 'error'); return; }
    generateInvoice(payment, billingSettings, gym?.name, gym?.logoUrl);
  };

  const formGstRate = billingSettings?.gstRate || 18;
  const formGstAmount = Math.round((Number(formSubtotal) || 0) * formGstRate) / 100;
  const formTotal = (Number(formSubtotal) || 0) + formGstAmount;

  const statCardsData = [
    { label: 'Monthly Revenue', value: formatINR(stats.totalCollectedThisMonth), icon: '💰', color: '#10B981', bg: '#ECFDF5' },
    { label: 'Pending Receivables', value: formatINR(stats.pendingDues), icon: '⏳', color: '#F59E0B', bg: '#FFFBEB' },
    { label: 'Defaulters', value: String(stats.overdueCount), icon: '🚨', color: '#EF4444', bg: '#FEF2F2' },
    { label: 'Payments Today', value: String(stats.paidCountThisMonth), icon: '📈', color: '#3B82F6', bg: '#EFF6FF' },
  ];

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: '800', color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' };
  const inputStyle: React.CSSProperties = { width: '100%', height: '46px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '0 14px', fontSize: '14px', color: '#0F172A', outline: 'none', transition: 'all 200ms' };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ 
        display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', 
        justifyContent: 'space-between', gap: '16px', marginBottom: '32px' 
      }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: isMobile ? '24px' : '28px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Financial Ledger</h1>
          <p style={{ fontSize: '14px', color: '#64748B', margin: 0, fontWeight: '500' }}>Comprehensive revenue and collection management dashboard</p>
        </div>
        <button 
          onClick={openCreateModal} 
          className="btn-press"
          style={{ 
            width: isMobile ? '100%' : 'auto', 
            background: 'linear-gradient(135deg, #E11D48, #BE123C)',
            color: '#FFF', border: 'none', borderRadius: '12px', padding: '12px 24px', 
            fontWeight: '800', fontSize: '14px', cursor: 'pointer', 
            boxShadow: '0 4px 14px rgba(225,29,72,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
          }}
        >
          {Icons.plus}
          Record Payment
        </button>
      </div>

      {/* Stats Summary */}
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : (isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)'), gap: '16px', marginBottom: '32px' }}>
        {statCardsData.map((card, idx) => (
          <div key={card.label} className="card-hover" style={{ 
            backgroundColor: '#FFFFFF', 
            border: '1px solid #E2E8F0', 
            borderRadius: '20px', 
            padding: '24px', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            position: 'relative', overflow: 'hidden',
            animationDelay: `${idx * 50}ms`
          }}>
             <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', backgroundColor: card.color, opacity: 0.6 }} />
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
               <span style={{ fontSize: '12px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</span>
               <div style={{ width: '32px', height: '32px', borderRadius: '10px', backgroundColor: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>{card.icon}</div>
             </div>
             <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '28px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>{isLoading ? '—' : card.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ 
        display: 'flex', flexDirection: isMobile ? 'column' : 'row', 
        justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center',
        gap: '16px', marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: isMobile ? '8px' : '0' }}>
            {['All', 'Paid', 'Pending', 'Overdue'].map(tab => {
                const val = tab.toLowerCase() as any;
                const active = filterStatus === val;
                return (
                    <button 
                        key={tab}
                        onClick={() => setFilterStatus(val)}
                        style={{
                            padding: '8px 16px', borderRadius: '10px', border: 'none', 
                            fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                            backgroundColor: active ? '#FFF1F2' : '#F1F5F9',
                            color: active ? '#E11D48' : '#64748B',
                            transition: 'all 200ms', whiteSpace: 'nowrap'
                        }}
                    >{tab}</button>
                )
            })}
        </div>
        <div style={{ position: 'relative', width: isMobile ? '100%' : '260px' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', display: 'flex' }}>{Icons.search}</span>
            <input 
                type="text" 
                placeholder="Search invoice or member..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                style={{ ...inputStyle, paddingLeft: '40px', height: '40px' }} 
            />
        </div>
      </div>

      {/* Table Container */}
      <div style={{ backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: isMobile ? '900px' : 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: '#FAFBFC' }}>
                  {['Invoice', 'Member', 'Plan', 'Total Amount', 'Collected', 'Status', 'Mode', 'Date', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '16px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={9} style={{ padding: '40px' }}>
                    {[1,2,3,4,5].map(i => <div key={i} style={{ marginBottom: '12px' }}><div className="skeleton" style={{ height: '48px' }} /></div>)}
                  </td></tr>
                ) : filteredPayments.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: '80px 20px', textAlign: 'center' }}>
                     <div style={{ fontSize: '48px', marginBottom: '16px' }}>📑</div>
                     <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: '800', color: '#0F172A', margin: '0 0 6px' }}>No payment records</p>
                     <p style={{ fontSize: '14px', color: '#64748B' }}>Your financial transactions will appear here once recorded.</p>
                  </td></tr>
                ) : (
                  filteredPayments.map((p, idx) => {
                    const sc = getStatusColor(p.status);
                    const mc = modeConfig[p.paymentMode] || modeConfig.other;
                    const isFullyPaid = p.paidAmount >= p.totalAmount;
                    
                    return (
                      <tr 
                        key={p.id} 
                        className="row-hover"
                        style={{ 
                            borderBottom: '1px solid #F8FAFC', 
                            animation: `fadeUp 400ms cubic-bezier(0.16, 1, 0.3, 1) ${idx * 30}ms forwards`,
                            opacity: 0,
                        }}
                      >
                        <td style={{ padding: '16px 20px' }}><span style={{ fontWeight: '800', fontFamily: "'JetBrains Mono', monospace", color: '#E11D48', fontSize: '12px', letterSpacing: '-0.02em' }}>{p.invoiceNumber}</span></td>
                        <td style={{ padding: '16px 20px' }}>
                          <p style={{ margin: 0, fontWeight: '700', fontSize: '13.5px', color: '#0F172A' }}>{p.memberName}</p>
                          <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>{p.memberPhone}</p>
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: '13px', color: '#334155', fontWeight: '600' }}>{p.planName}</td>
                        <td style={{ padding: '16px 20px', fontWeight: '800', fontSize: '14px', color: '#0F172A' }}>{formatINR(p.totalAmount)}</td>
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{ fontWeight: '800', fontSize: '14px', color: isFullyPaid ? '#10B981' : '#0F172A' }}>{formatINR(p.paidAmount)}</span>
                          {p.balanceDue > 0 && <p style={{ fontSize: '10px', color: '#EF4444', margin: '2px 0 0', fontWeight: '700' }}>Due: {formatINR(p.balanceDue)}</p>}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '20px', backgroundColor: sc.bg, color: sc.color, fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }}>
                             <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: sc.dot }} className="glow-dot" /> {statusLabels[p.status]}
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                           <div style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: '20px', backgroundColor: mc.bg, color: mc.color, fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }}>{mc.label}</div>
                        </td>
                        <td style={{ padding: '16px 20px', fontSize: '12px', color: '#64748B', fontWeight: '500' }}>{p.createdAt ? formatDateIN(p.createdAt) : '—'}</td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button 
                                onClick={() => handlePrintInvoice(p)} 
                                className="btn-press"
                                title="Print Invoice"
                                style={{ width: '34px', height: '34px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', transition: 'all 200ms' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#E11D48'; e.currentTarget.style.color = '#E11D48'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B'; }}
                            >
                                {Icons.print}
                            </button>
                            {p.status !== 'paid' && (
                              <button 
                                onClick={() => { setSelectedPayment(p); setCollectAmount(''); setIsCollectOpen(true); }} 
                                className="btn-press"
                                style={{ padding: '0 14px', height: '34px', borderRadius: '10px', backgroundColor: '#ECFDF5', color: '#059669', border: '1px solid #10B981', fontSize: '11px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                {Icons.collect}
                                Collect
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New Payment Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Financial Entry" subtitle="Record membership fee collection and invoice generation" footer={
        <>
          <GhostButton onClick={() => setIsCreateOpen(false)}>Discard</GhostButton>
          <PrimaryButton onClick={handleCreatePayment} loading={isSaving}>Authorize Entry</PrimaryButton>
        </>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '4px 0' }}>
          <div ref={memberSearchRef}>
            <label style={labelStyle}>Search Member</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                style={inputStyle}
                placeholder="Type member name or phone..."
                value={formMemberSearch}
                onChange={e => {
                  setFormMemberSearch(e.target.value);
                  setFormMemberId('');
                  setFormMemberDropdownOpen(true);
                }}
                onFocus={() => setFormMemberDropdownOpen(true)}
              />
              {formMemberDropdownOpen && filteredMembers.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px',
                  marginTop: '4px', maxHeight: '200px', overflowY: 'auto',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                }}>
                  {filteredMembers.map(m => (
                    <div
                      key={m.id}
                      onClick={() => handleMemberSelect(m)}
                      style={{
                        padding: '10px 14px', cursor: 'pointer',
                        borderBottom: '1px solid #F8FAFC',
                        transition: 'background 150ms',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                    >
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{m.name}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#94A3B8', fontWeight: '500' }}>+91 {m.phone} · {m.planName || 'No plan'}</p>
                    </div>
                  ))}
                </div>
              )}
              {formMemberDropdownOpen && formMemberSearch.trim() && filteredMembers.length === 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px',
                  marginTop: '4px', padding: '16px', textAlign: 'center',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8', fontWeight: '600' }}>No members found</p>
                </div>
              )}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Assignment Plan</label>
            <select style={{...inputStyle, appearance: 'none', background: '#FFF url("data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%20fill%3D%22none%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E") no-repeat right 14px center'}} value={formPlanId} onChange={e => setFormPlanId(e.target.value)}>
              <option value="">Choose plan...</option>
              {plans.map(p => <option key={p.id} value={p.id!}>{p.name} — ₹{p.price}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div><label style={labelStyle}>Start Date</label><input type="date" style={inputStyle} value={formStartDate} onChange={e => setFormStartDate(e.target.value)} /></div>
            <div><label style={labelStyle}>End Date</label><input type="date" style={{...inputStyle, backgroundColor: '#F8FAFC', cursor: 'not-allowed', fontWeight: '700'}} value={formEndDate} readOnly /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div><label style={labelStyle}>Immediate Payment (₹)</label><input type="number" style={{...inputStyle, fontWeight: '800', fontSize: '16px'}} value={formPaidAmount} onChange={e => setFormPaidAmount(e.target.value)} placeholder="0.00" /></div>
            <div>
              <label style={labelStyle}>Payment Mode</label>
              <select style={inputStyle} value={formPaymentMode} onChange={e => setFormPaymentMode(e.target.value as any)}>
                <option value="cash">Cash Collection</option>
                <option value="upi">UPI / QR Scan</option>
                <option value="card">Card Payment</option>
                <option value="bank_transfer">Digital Transfer</option>
              </select>
            </div>
          </div>
          <div style={{ backgroundColor: '#F8FAFC', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0', marginTop: '4px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', color: '#64748B', fontWeight: '600' }}><span>Sub Invoice Amount</span><span>{formatINR(Number(formSubtotal) || 0)}</span></div>
             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '12px', color: '#64748B', fontWeight: '600' }}><span>Taxation ({formGstRate}%)</span><span>{formatINR(formGstAmount)}</span></div>
             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '900', borderTop: '2px dashed #E2E8F0', paddingTop: '12px', color: '#0F172A' }}><span>GRAND TOTAL</span><span style={{ color: '#E11D48' }}>{formatINR(formTotal)}</span></div>
          </div>
        </div>
      </Modal>

      {/* Collect Balance Modal */}
      <Modal isOpen={isCollectOpen} onClose={() => setIsCollectOpen(false)} title="Balance Reconciliation" subtitle={`Finalize outstanding dues for ${selectedPayment?.memberName}`} footer={
        <>
          <GhostButton onClick={() => setIsCollectOpen(false)}>Later</GhostButton>
          <PrimaryButton onClick={handleCollectPayment} loading={isSaving}>Finalize Payment</PrimaryButton>
        </>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '4px 0' }}>
           <div style={{ padding: '24px', background: 'linear-gradient(135deg, #FEF2F2, #FFF)', border: '1px solid #FECDD3', borderRadius: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '11px', fontWeight: '900', color: '#E11D48', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Outstanding Liability</p>
              <p style={{ fontSize: '36px', fontWeight: '900', color: '#0F172A', margin: 0, letterSpacing: '-0.03em' }}>{formatINR(selectedPayment?.balanceDue || 0)}</p>
           </div>
           <div>
             <label style={labelStyle}>Reconciliation Amount (₹)</label>
             <input 
                type="number" 
                style={{ ...inputStyle, height: '56px', fontSize: '24px', fontWeight: '900', textAlign: 'center', color: '#10B981', border: '2px solid #10B981' }} 
                value={collectAmount} 
                onChange={e => setCollectAmount(e.target.value)} 
                autoFocus 
                placeholder="0.00"
            />
           </div>
        </div>
      </Modal>
    </div>
  );
}
