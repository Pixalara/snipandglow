// PingFlow — Member Detail Page
// Premium Overhaul with Light Theme, Animations, and High-End Typography

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, addDays } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import { useRole } from '@/hooks/useRole';
import {
  getMember,
  updateMember,
  deleteMember,
  subscribeMemberAutomationLogs,
} from '@/services/members.service';
import { subscribePlans } from '@/services/plans.service';
import {
  subscribeMemberPayments,
  subscribeBillingSettings,
  createPayment,
  initBillingSettings,
} from '@/services/billing.service';
import { generateInvoice } from '@/utils/invoicePDF';
import { formatINR, formatDateIN, getStatusColor, statusLabels, modeConfig } from '@/utils/billing.utils';
import StatusBadge from '@/components/ui/StatusBadge';
import OtpProtectedConfirm from '@/components/ui/OtpProtectedConfirm';
import Modal from '@/components/ui/Modal';
import { PrimaryButton, GhostButton } from '@/components/ui/ModalButtons';
import Drawer from '@/components/ui/Drawer';
import { toast } from '@/components/ui/Toast';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Member, Plan, AutomationLog, AutomationEventType, Payment, PaymentMode, BillingSettings } from '@/types';

const memberSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().min(10, 'Enter a valid 10-digit number').max(13),
  planId: z.string().min(1, 'Please select a plan'),
  startDate: z.string().min(1, 'Start date is required'),
  lastVisitDate: z.string().optional(),
});

type MemberFormData = z.infer<typeof memberSchema>;

const eventTypeLabels: Record<AutomationEventType, { label: string; color: string; bg: string }> = {
  expiry_reminder_d3: { label: 'Expiry Reminder (3 days)', color: '#F59E0B', bg: '#FFFBEB' },
  expiry_alert_d0: { label: 'Expiry Alert (today)', color: '#E11D48', bg: '#FFF1F2' },
  expiry_followup_d2: { label: 'Expiry Follow-up (+2 days)', color: '#BE123C', bg: '#FFF1F2' },
  inactivity_d5: { label: 'Inactivity (5 days)', color: '#6366F1', bg: '#EEF2FF' },
  inactivity_d10: { label: 'Inactivity (10 days)', color: '#4F46E5', bg: '#EEF2FF' },
};

const Icons = {
    back: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
        </svg>
    ),
    edit: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
    ),
    trash: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
    ),
    history: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
    ),
    print: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
        </svg>
    )
};

export default function MemberDetailPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const { user, gym } = useAuthStore();
  const { isMobile } = useResponsive();
  const { can } = useRole();

  const [member, setMember] = useState<Member | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [memberPayments, setMemberPayments] = useState<Payment[]>([]);
  const [billingSettings, setBillingSettings] = useState<BillingSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Record Payment state
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [payPlanId, setPayPlanId] = useState('');
  const [paySubtotal, setPaySubtotal] = useState('');
  const [payPaidAmount, setPayPaidAmount] = useState('');
  const [payMode, setPayMode] = useState<PaymentMode>('cash');
  const [payStartDate, setPayStartDate] = useState('');
  const [payEndDate, setPayEndDate] = useState('');
  const [isPaySaving, setIsPaySaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
  });

  const selectedPlanId = watch('planId');
  const watchedStartDate = watch('startDate');

  // Load member data
  useEffect(() => {
    if (!user || !memberId) return;

    const loadMember = async () => {
      try {
        const data = await getMember(user.uid, memberId);
        if (data) {
          setMember(data);
        } else {
          toast('Member registry not found', 'error');
          navigate('/members');
        }
      } catch (err) {
        console.error('Load member error:', err);
        toast('Failed to load member', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadMember();

    const unsubLogs = subscribeMemberAutomationLogs(
      user.uid,
      memberId,
      10,
      (data) => setLogs(data),
      (error) => console.error('Logs error:', error)
    );

    const unsubPlans = subscribePlans(
      user.uid,
      (data) => setPlans(data.filter((p) => p.isActive)),
      (error) => console.error('Plans error:', error)
    );

    const unsubPayments = subscribeMemberPayments(
      user.uid,
      memberId,
      (data) => setMemberPayments(data),
      (error) => console.error('Member payments error:', error)
    );

    const unsubBilling = subscribeBillingSettings(
      user.uid,
      (data) => setBillingSettings(data),
      (error) => console.error('Billing settings error:', error)
    );

    return () => {
      unsubLogs();
      unsubPlans();
      unsubPayments();
      unsubBilling();
    };
  }, [user, memberId, navigate]);

  const openEditDrawer = () => {
    if (!member) return;
    reset({
      name: member.name,
      phone: member.phone.replace('+91', ''),
      planId: member.planId,
      startDate: format(member.startDate.toDate(), 'yyyy-MM-dd'),
      lastVisitDate: member.lastVisitDate
        ? format(member.lastVisitDate.toDate(), 'yyyy-MM-dd')
        : '',
    });
    setIsDrawerOpen(true);
  };

  const onSubmit = async (data: MemberFormData) => {
    if (!user || !memberId) return;
    const plan = plans.find((p) => p.id === data.planId);
    if (!plan) {
      toast('Selected membership tier no longer exists', 'error');
      return;
    }

    const startDate = new Date(data.startDate);
    const endDate = addDays(startDate, plan.durationDays);
    const lastVisitDate = data.lastVisitDate ? new Date(data.lastVisitDate) : null;

    setIsSaving(true);
    try {
      await updateMember(user.uid, memberId, {
        name: data.name,
        phone: data.phone,
        planId: data.planId,
        planName: plan.name,
        startDate,
        endDate,
        lastVisitDate,
      });
      const updated = await getMember(user.uid, memberId);
      if (updated) setMember(updated);
      toast('Member profile updated', 'success');
      setIsDrawerOpen(false);
    } catch (err) {
      console.error('Update member error:', err);
      toast('Failed to update registry', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !memberId) return;
    try {
      await deleteMember(user.uid, memberId);
      toast('Member permanently removed', 'success');
      navigate('/members');
    } catch (err) {
      console.error('Delete member error:', err);
      toast('Failed to delete member', 'error');
    }
  };

  // Record Payment helpers
  const openPaymentModal = () => {
    if (!member) return;
    setPayPlanId(member.planId || '');
    setPayPaidAmount('');
    setPayMode('cash');
    setPayStartDate(format(new Date(), 'yyyy-MM-dd'));
    setPayEndDate('');
    setPaySubtotal('');
    // Auto-fill from current plan
    const plan = plans.find(p => p.id === member.planId);
    if (plan) {
      setPaySubtotal(String(plan.price));
      const start = new Date();
      const end = new Date(start);
      end.setDate(end.getDate() + plan.durationDays);
      setPayEndDate(format(end, 'yyyy-MM-dd'));
    }
    setIsPaymentOpen(true);
  };

  // Auto-update subtotal and end date when plan changes
  useEffect(() => {
    if (payPlanId && payStartDate) {
      const plan = plans.find(p => p.id === payPlanId);
      if (plan) {
        setPaySubtotal(String(plan.price));
        const start = new Date(payStartDate);
        const end = new Date(start);
        end.setDate(end.getDate() + plan.durationDays);
        setPayEndDate(format(end, 'yyyy-MM-dd'));
      }
    }
  }, [payPlanId, payStartDate, plans]);

  const payGstRate = billingSettings?.gstRate ?? 18;
  const payGstAmount = Math.round((Number(paySubtotal) || 0) * payGstRate) / 100;
  const payTotal = (Number(paySubtotal) || 0) + payGstAmount;

  const handleRecordPayment = async () => {
    if (!user || !member || !memberId) return;
    let settings = billingSettings;
    if (!settings) {
      try {
        settings = await initBillingSettings(user.uid, gym?.name || 'My Gym', gym?.phone || '');
        setBillingSettings(settings);
      } catch {
        toast('Billing settings failed to initialize', 'error');
        return;
      }
    }
    if (!payPlanId || !payStartDate || !payEndDate) {
      toast('Please fill all required fields', 'error');
      return;
    }
    const plan = plans.find(p => p.id === payPlanId);
    if (!plan) { toast('Invalid plan', 'error'); return; }

    setIsPaySaving(true);
    try {
      await createPayment(user.uid, {
        memberId,
        planId: payPlanId,
        subtotal: Number(paySubtotal) || 0,
        paidAmount: Number(payPaidAmount) || 0,
        paymentMode: payMode,
        membershipStartDate: new Date(payStartDate),
        membershipEndDate: new Date(payEndDate),
      }, member, plan, settings);
      toast('Payment recorded!', 'success');
      setIsPaymentOpen(false);
    } catch {
      toast('Failed to record payment', 'error');
    } finally {
      setIsPaySaving(false);
    }
  };

  const computedEndDate = (() => {
    if (!selectedPlanId || !watchedStartDate) return null;
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan) return null;
    return addDays(new Date(watchedStartDate), plan.durationDays);
  })();

  if (isLoading) {
    return (
      <div className="stagger" style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div className="skeleton" style={{ height: '40px', width: '200px', marginBottom: '32px' }} />
        <div className="skeleton" style={{ height: '300px', borderRadius: '24px', marginBottom: '24px' }} />
        <div className="skeleton" style={{ height: '400px', borderRadius: '24px' }} />
      </div>
    );
  }

  if (!member) return null;

  return (
    <div style={{ maxWidth: '940px', margin: '0 auto' }}>
      {/* Header Actions */}
      <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: '32px', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '16px' : '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
                onClick={() => navigate('/members')}
                className="btn-press"
                style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', cursor: 'pointer', transition: 'all 200ms' }}
            >
                {Icons.back}
            </button>
            <div>
                <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>{member.name}</h1>
                <p style={{ fontSize: '13.5px', color: '#94A3B8', fontWeight: '600', margin: 0 }}>Membership ID: {memberId?.slice(-6).toUpperCase()}</p>
            </div>
        </div>
        <div style={{ display: 'flex', gap: isMobile ? '8px' : '12px', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
            {can('create', 'billing') && (
            <button
                onClick={openPaymentModal}
                className="btn-press"
                style={{ height: '40px', padding: isMobile ? '0 12px' : '0 18px', borderRadius: '12px', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', color: '#FFFFFF', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 200ms', boxShadow: '0 4px 12px rgba(16,185,129,0.25)', flex: isMobile ? '1 1 auto' : 'none' }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                Record Payment
            </button>
            )}
            {can('update', 'members') && (
            <button
                onClick={openEditDrawer}
                className="btn-press"
                style={{ height: '40px', padding: isMobile ? '0 12px' : '0 18px', borderRadius: '12px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#334155', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 200ms' }}
            >
                {Icons.edit} Edit Details
            </button>
            )}
            {can('delete', 'members') && (
            <button
                onClick={() => setIsDeleteOpen(true)}
                className="btn-press"
                style={{ height: '40px', padding: isMobile ? '0 12px' : '0 18px', borderRadius: '12px', backgroundColor: '#FFF1F2', border: '1px solid #FECDD3', color: '#E11D48', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 200ms' }}
            >
                {Icons.trash} Delete
            </button>
            )}
        </div>
      </div>

      <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Profile Card */}
        <section className="card-hover" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr', gap: '40px', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', background: 'linear-gradient(90deg, #E11D48, #BE123C)' }} />
            
            {/* Massive Avatar */}
            <div style={{ width: '120px', height: '120px', borderRadius: '32px', background: 'linear-gradient(135deg, #FFF1F2, #FFE4E6)', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', fontWeight: '900', fontFamily: "'Outfit', sans-serif", boxShadow: '0 10px 25px rgba(225,29,72,0.1)' }}>
                {member.name.charAt(0).toUpperCase()}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '32px' }}>
                <div>
                   <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Member Status</p>
                   <StatusBadge status={member.status} />
                </div>
                <div>
                   <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Current Plan</p>
                   <p style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A', margin: 0 }}>{member.planName}</p>
                </div>
                <div>
                   <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Phone Registry</p>
                   <p style={{ fontSize: '16px', fontWeight: '700', color: '#334155', margin: 0 }}>{member.phone}</p>
                </div>
                <div>
                   <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Effective Date</p>
                   <p style={{ fontSize: '16px', fontWeight: '700', color: '#334155', margin: 0 }}>{format(member.startDate.toDate(), 'dd MMM, yyyy')}</p>
                </div>
                <div>
                   <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Expiry Threshold</p>
                   <p style={{ fontSize: '16px', fontWeight: '800', color: member.status === 'expired' ? '#E11D48' : '#0F172A', margin: 0 }}>{format(member.endDate.toDate(), 'dd MMM, yyyy')}</p>
                   <p style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600', marginTop: '4px' }}>{formatDistanceToNow(member.endDate.toDate(), { addSuffix: true })}</p>
                </div>
                <div>
                   <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Facility Access</p>
                   <p style={{ fontSize: '16px', fontWeight: '700', color: '#334155', margin: 0 }}>{member.lastVisitDate ? format(member.lastVisitDate.toDate(), 'dd MMM, yyyy') : 'No check-ins'}</p>
                   {member.lastVisitDate && <p style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600', marginTop: '4px' }}>Last active {formatDistanceToNow(member.lastVisitDate.toDate(), { addSuffix: true })}</p>}
                </div>
            </div>
        </section>

        {/* Financial History */}
        <section style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', backgroundColor: '#FAFBFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>Ledger Records</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{memberPayments.length} Total Receipts</span>
            </div>
            
            {memberPayments.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>💳</div>
                    <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px' }}>No Transactional History</p>
                    <p style={{ fontSize: '14px', color: '#64748B' }}>Every payment generated in the Billing module will appear here.</p>
                </div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#F8FAFC' }}>
                                {['Invoice Sequence', 'Nominal Value', 'Reconciliation', 'Status', 'Protocol', 'Timestamp', ''].map(h => (
                                    <th key={h} style={{ padding: '16px 24px', textAlign: 'left', fontSize: '10px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #F1F5F9' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {memberPayments.map((p) => {
                                const sc = getStatusColor(p.status);
                                const mc = modeConfig[p.paymentMode] || modeConfig.other;
                                return (
                                    <tr key={p.id} className="row-hover" style={{ borderBottom: '1px solid #F8FAFC' }}>
                                        <td style={{ padding: '16px 24px' }}><span style={{ fontWeight: '800', fontFamily: "'JetBrains Mono', monospace", color: '#E11D48', fontSize: '12px' }}>{p.invoiceNumber}</span></td>
                                        <td style={{ padding: '16px 24px', fontWeight: '800', fontSize: '14px', color: '#0F172A' }}>{formatINR(p.totalAmount)}</td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <span style={{ fontWeight: '800', color: p.paidAmount >= p.totalAmount ? '#10B981' : '#0F172A' }}>{formatINR(p.paidAmount)}</span>
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '20px', backgroundColor: sc.bg, color: sc.color, fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }}>
                                                <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: sc.dot }} className="glow-dot" /> {statusLabels[p.status]}
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ display: 'inline-flex', padding: '3px 10px', borderRadius: '20px', backgroundColor: mc.bg, color: mc.color, fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }}>{mc.label}</div>
                                        </td>
                                        <td style={{ padding: '16px 24px', fontSize: '12px', color: '#64748B', fontWeight: '500' }}>{p.createdAt ? formatDateIN(p.createdAt) : '—'}</td>
                                        <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                            <button 
                                                onClick={() => billingSettings ? generateInvoice(p, billingSettings, gym?.name, gym?.logoUrl) : toast('Billing settings required', 'error')}
                                                style={{ width: '34px', height: '34px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}
                                            >
                                                {Icons.print}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>

        {/* Automation Feed */}
        <section style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '24px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
           <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '800', color: '#0F172A', margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ color: '#10B981' }}>{Icons.history}</div>
                Message Execution Logs
           </h2>

           {logs.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '20px', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    </div>
                    <p style={{ fontSize: '14px', color: '#64748B', fontWeight: '600' }}>No automated signals transmitted to this member handset.</p>
                </div>
           ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {logs.map((log) => {
                        const eventConfig = eventTypeLabels[log.eventType];
                        return (
                            <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '16px 20px', backgroundColor: '#FAFBFC', border: '1px solid #F1F5F9', borderRadius: '16px' }}>
                                <div style={{ width: '44px', height: '44px', borderRadius: '14px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: log.messageStatus === 'sent' ? '#ECFDF5' : (log.messageStatus === 'failed' ? '#FEF2F2' : '#F1F5F9'), color: log.messageStatus === 'sent' ? '#10B981' : (log.messageStatus === 'failed' ? '#E11D48' : '#64748B') }}>
                                    {log.messageStatus === 'sent' ? '✓' : (log.messageStatus === 'failed' ? '!' : '…')}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: '800', color: '#0F172A' }}>{eventConfig.label}</span>
                                        <span style={{ fontSize: '10px', fontWeight: '900', color: eventConfig.color, backgroundColor: eventConfig.bg, padding: '2px 8px', borderRadius: '20px', textTransform: 'uppercase' }}>{log.messageStatus}</span>
                                    </div>
                                    <p style={{ fontSize: '12px', color: '#64748B', fontWeight: '600', margin: 0 }}>Gateway Protocol: {log.templateName}</p>
                                    {log.errorMessage && <p style={{ fontSize: '11px', color: '#E11D48', fontWeight: '700', marginTop: '4px' }}>Error: {log.errorMessage}</p>}
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', margin: 0 }}>{log.timestamp ? format(log.timestamp.toDate(), 'dd MMM') : '—'}</p>
                                    <p style={{ fontSize: '10px', color: '#CBD5E1', fontWeight: '600' }}>{log.timestamp ? format(log.timestamp.toDate(), 'h:mm a') : ''}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
           )}
        </section>
      </div>

      {/* Edit Registry Drawer */}
      <Drawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} title="Audit Member Registry">
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '10px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Official Identity</label>
                <input {...register('name')} style={{ height: '48px', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '0 16px', fontSize: '14px', color: '#0F172A', fontWeight: '600', outline: 'none' }} />
                {errors.name && <p style={{ color: '#E11D48', fontSize: '11px', marginTop: '6px' }}>{errors.name.message}</p>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Handset Registry</label>
                <div style={{ display: 'flex', height: '48px' }}>
                    <div style={{ width: '48px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRight: 'none', borderRadius: '12px 0 0 12px', fontSize: '13px', fontWeight: '700', color: '#64748B' }}>+91</div>
                    <input {...register('phone')} style={{ flex: 1, border: '1px solid #E2E8F0', borderRadius: '0 12px 12px 0', padding: '0 16px', fontSize: '14px', color: '#0F172A', fontWeight: '600', outline: 'none' }} />
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Membership Protocol</label>
                <Controller
                    name="planId"
                    control={control}
                    render={({ field }) => (
                        <select {...field} style={{ height: '48px', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '0 16px', fontSize: '14px', color: '#0F172A', fontWeight: '600', outline: 'none', appearance: 'none', background: '#FFF url("data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%20fill%3D%22none%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E") no-repeat right 14px center' }}>
                            <option value="">Choose tier...</option>
                            {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ₹{p.price}</option>)}
                        </select>
                    )}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Term Start</label>
                    <input type="date" {...register('startDate')} style={{ height: '48px', width: '100%', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '0 16px', fontSize: '14px', fontWeight: '600', color: '#0F172A', outline: 'none' }} />
                </div>
                <div>
                   <label style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Check-in Threshold</label>
                    <input type="date" {...register('lastVisitDate')} style={{ height: '48px', width: '100%', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '0 16px', fontSize: '14px', fontWeight: '600', color: '#0F172A', outline: 'none' }} />
                </div>
            </div>

            {computedEndDate && (
                <div style={{ padding: '16px', backgroundColor: '#FFF1F2', borderRadius: '14px', border: '1px solid #FFE4E6', display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <div style={{ fontSize: '20px' }}>🗓️</div>
                     <div>
                        <p style={{ fontSize: '10px', fontWeight: '800', color: '#E11D48', textTransform: 'uppercase', margin: 0 }}>Computed Expiry Milestone</p>
                        <p style={{ fontSize: '15px', fontWeight: '900', color: '#0F172A', margin: 0 }}>{format(computedEndDate, 'dd MMMM, yyyy')}</p>
                     </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button 
                  type="button"
                  onClick={() => setIsDrawerOpen(false)} 
                  style={{ flex: 1, height: '48px', borderRadius: '12px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
                >
                  Abort
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  style={{ flex: 1, height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #E11D48, #BE123C)', color: '#FFF', border: 'none', fontSize: '14px', fontWeight: '800', cursor: 'pointer', opacity: isSaving ? 0.6 : 1 }}
                >
                  {isSaving ? 'Synchronizing...' : 'Synchronize Profile'}
                </button>
            </div>
        </form>
      </Drawer>

      <OtpProtectedConfirm
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Member"
        message={`This will permanently remove ${member.name} and all their records. This cannot be undone.`}
        confirmLabel="Send OTP & Delete"
        variant="danger"
      />

      {/* Record Payment Modal */}
      <Modal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} title="Record Payment" subtitle={`Record a payment for ${member.name}`} footer={
        <>
          <GhostButton onClick={() => setIsPaymentOpen(false)}>Cancel</GhostButton>
          <PrimaryButton onClick={handleRecordPayment} loading={isPaySaving}>Record Payment</PrimaryButton>
        </>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '4px 0' }}>
          {/* Member info banner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #FFF1F2, #FFE4E6)', color: '#E11D48', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '800' }}>{member.name.charAt(0).toUpperCase()}</div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', margin: 0 }}>{member.name}</p>
              <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>{member.phone} · {member.planName}</p>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Plan</label>
            <select style={{ width: '100%', height: '46px', padding: '0 16px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#FFF', color: '#0F172A', fontSize: '14px', fontFamily: "'Inter', sans-serif", outline: 'none', appearance: 'none', background: '#FFF url("data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E") no-repeat right 14px center' }} value={payPlanId} onChange={e => setPayPlanId(e.target.value)}>
              <option value="">Choose plan...</option>
              {plans.map(p => <option key={p.id} value={p.id!}>{p.name} — ₹{p.price}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Start Date</label>
              <input type="date" style={{ width: '100%', height: '46px', padding: '0 16px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#FFF', color: '#0F172A', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} value={payStartDate} onChange={e => setPayStartDate(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>End Date</label>
              <input type="date" style={{ width: '100%', height: '46px', padding: '0 16px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontWeight: '700', cursor: 'not-allowed' }} value={payEndDate} readOnly />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Amount Paid (₹)</label>
              <input type="number" style={{ width: '100%', height: '46px', padding: '0 16px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#FFF', color: '#0F172A', fontSize: '16px', fontWeight: '800', outline: 'none', boxSizing: 'border-box' }} value={payPaidAmount} onChange={e => setPayPaidAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Payment Mode</label>
              <select style={{ width: '100%', height: '46px', padding: '0 16px', borderRadius: '12px', border: '1px solid #E2E8F0', backgroundColor: '#FFF', color: '#0F172A', fontSize: '14px', outline: 'none' }} value={payMode} onChange={e => setPayMode(e.target.value as PaymentMode)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI / QR</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          {/* Invoice summary */}
          <div style={{ backgroundColor: '#F8FAFC', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', color: '#64748B', fontWeight: '600' }}><span>Subtotal</span><span>{formatINR(Number(paySubtotal) || 0)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '12px', color: '#64748B', fontWeight: '600' }}><span>GST ({payGstRate}%)</span><span>{formatINR(payGstAmount)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '900', borderTop: '2px dashed #E2E8F0', paddingTop: '12px', color: '#0F172A' }}><span>Total</span><span style={{ color: '#E11D48' }}>{formatINR(payTotal)}</span></div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
