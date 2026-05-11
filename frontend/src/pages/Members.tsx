import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import { usePlan } from '@/hooks/usePlan';
import { useRole } from '@/hooks/useRole';
import UpgradeModal from '@/components/ui/UpgradeModal';
import { subscribeMembers, createMember, updateMember, deleteMember } from '@/services/members.service';
import { subscribePlans } from '@/services/plans.service';
import OtpProtectedConfirm from '@/components/ui/OtpProtectedConfirm';
import Modal from '@/components/ui/Modal';
import { PrimaryButton, GhostButton } from '@/components/ui/ModalButtons';
import { toast } from '@/components/ui/Toast';
import type { Member, Plan, MemberStatus } from '@/types';

const memberSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().min(10, 'Enter a valid 10-digit number').max(13),
  planId: z.string().min(1, 'Please select a plan'),
  startDate: z.string().min(1, 'Start date is required'),
  lastVisitDate: z.string().optional(),
});

type MemberFormData = z.infer<typeof memberSchema>;
type StatusFilter = 'all' | MemberStatus;

const Icons = {
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  ),
  external: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
};

const StatusBadge = ({ status }: { status: MemberStatus }) => {
  const config = {
    active:        { bg: '#ECFDF5',  color: '#059669', dot: '#10B981',  label: 'Active' },
    expiring_soon: { bg: '#FFFBEB', color: '#D97706', dot: '#F59E0B', label: 'Expiring' },
    expired:       { bg: '#FEF2F2',  color: '#DC2626', dot: '#EF4444', label: 'Expired' },
    inactive:      { bg: '#F1F5F9',  color: '#475569', dot: '#64748B', label: 'Inactive' },
  }[status];
  
  if (!config) return null;
  
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: config.bg, padding: '3px 10px', borderRadius: '20px', border: `1px solid ${config.bg}` }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: config.dot }} className="glow-dot" />
      <span style={{ fontSize: '11px', fontWeight: '700', color: config.color, letterSpacing: '0.01em' }}>{config.label}</span>
    </div>
  );
};

export default function MembersPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const { isAtLimit } = usePlan();
  const { can } = useRole();
  const [members, setMembers] = useState<Member[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
  });

  const selectedPlanId = watch('planId');
  const watchedStartDate = watch('startDate');

  const activeBranchId = useAuthStore(s => s.activeBranchId);

  useEffect(() => {
    if (!user) return;
    // Clear data on branch switch to prevent stale data flicker
    setMembers([]);
    setIsLoading(true);
    const unsubMembers = subscribeMembers(user.uid, (data) => { setMembers(data); setIsLoading(false); }, (err) => { console.error(err); setIsLoading(false); });
    const unsubPlans = subscribePlans(user.uid, (data) => setPlans(data.filter(p => p.isActive)), (err) => console.error(err));
    return () => { unsubMembers(); unsubPlans(); };
  }, [user, activeBranchId]);

  const filteredMembers = useMemo(() => {
    let result = members;
    if (statusFilter !== 'all') result = result.filter(m => m.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(m => m.name.toLowerCase().includes(q) || m.phone.includes(q) || m.planName.toLowerCase().includes(q));
    }
    return result;
  }, [members, statusFilter, searchQuery]);

  const openCreateDrawer = () => {
    if (isAtLimit('members', members.length)) {
      setShowUpgradeModal(true);
      return;
    }
    setEditingMember(null);
    reset({ name: '', phone: '', planId: '', startDate: format(new Date(), 'yyyy-MM-dd'), lastVisitDate: format(new Date(), 'yyyy-MM-dd') });
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (member: Member) => {
    setEditingMember(member);
    reset({ name: member.name, phone: member.phone.replace('+91', ''), planId: member.planId, startDate: format(member.startDate.toDate(), 'yyyy-MM-dd'), lastVisitDate: member.lastVisitDate ? format(member.lastVisitDate.toDate(), 'yyyy-MM-dd') : '' });
    setIsDrawerOpen(true);
  };

  const onSubmit = async (data: MemberFormData) => {
    if (!user) return;
    const plan = plans.find(p => p.id === data.planId);
    if (!plan) return toast('Selected plan not found', 'error');
    const startDate = new Date(data.startDate);
    const endDate = addDays(startDate, plan.durationDays);
    const lastVisitDate = data.lastVisitDate ? new Date(data.lastVisitDate) : null;
    setIsSaving(true);
    try {
      if (editingMember?.id) {
        await updateMember(user.uid, editingMember.id, { name: data.name, phone: data.phone, planId: data.planId, planName: plan.name, startDate, endDate, lastVisitDate });
        toast('Member updated successfully', 'success');
      } else {
        await createMember(user.uid, { name: data.name, phone: data.phone, planId: data.planId, planName: plan.name, startDate, endDate, lastVisitDate });
        toast('Member added successfully', 'success');
      }
      setIsDrawerOpen(false);
    } catch (err) { console.error(err); toast('Failed to save member', 'error'); } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!user || !deletingMember?.id) return;
    try {
      await deleteMember(user.uid, deletingMember.id);
      toast('Member deleted', 'success');
      setDeletingMember(null);
    } catch (err) {
      console.error(err);
      toast('Failed to delete member', 'error');
    }
  };

  const computedEndDate = useMemo(() => {
    if (!selectedPlanId || !watchedStartDate) return null;
    const plan = plans.find(p => p.id === selectedPlanId);
    if (!plan) return null;
    return addDays(new Date(watchedStartDate), plan.durationDays);
  }, [selectedPlanId, watchedStartDate, plans]);

  const labelStyle = { 
    display: 'block', fontSize: '11px', fontWeight: '700', color: '#64748B', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '8px' 
  };
  const inputStyle = { 
    width: '100%', height: '46px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '0 14px', fontSize: '14px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' as const, fontFamily: "'Inter', sans-serif", transition: 'all 150ms' 
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center', 
        justifyContent: 'space-between', 
        gap: '16px',
        marginBottom: '28px' 
      }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: isMobile ? '24px' : '28px', fontWeight: '800', color: 'var(--pf-text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Clients</h1>
          <p style={{ fontSize: '13px', color: 'var(--pf-text-muted)', margin: 0, fontWeight: '500' }}>{isLoading ? '...' : members.length} clients in your salon</p>
        </div>
        {can('create', 'members') && (
        <button 
          onClick={openCreateDrawer}
          className="btn-press"
          style={{ 
            width: isMobile ? '100%' : 'auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', 
            background: 'linear-gradient(135deg, #E11D48, #BE123C)', border: 'none', borderRadius: '12px', padding: '12px 24px', 
            cursor: 'pointer', fontSize: '14px', fontWeight: '800', color: '#FFFFFF', 
            boxShadow: '0 4px 14px rgba(225,29,72,0.3)',
            transition: 'all 200ms'
          }}
        >
          {Icons.plus}
          Add Client
        </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column-reverse' : 'row',
        gap: '16px', 
        marginBottom: '24px' 
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', display: 'flex' }}>{Icons.search}</span>
          <input 
            style={{ ...inputStyle, paddingLeft: '44px' }} 
            placeholder="Search by name, phone or plan..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
          />
        </div>
        <div style={{ 
          display: 'flex', 
          backgroundColor: '#F1F5F9', 
          border: '1px solid #E2E8F0', 
          borderRadius: '14px', 
          padding: '4px', 
          gap: '2px',
          overflowX: 'auto',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}>
          {['All', 'Active', 'Expiring', 'Expired', 'Inactive'].map(tab => {
            const val = tab.toLowerCase() === 'expiring' ? 'expiring_soon' : tab.toLowerCase();
            const active = (statusFilter === val) || (tab === 'All' && statusFilter === 'all');
            return (
              <button 
                key={tab} 
                onClick={() => setStatusFilter(val as StatusFilter)}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '8px 16px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                  backgroundColor: active ? '#FFFFFF' : 'transparent',
                  color: active ? '#E11D48' : '#64748B',
                  boxShadow: active ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                  letterSpacing: '0.01em'
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Container */}
      <div style={{ 
        backgroundColor: '#FFFFFF', 
        border: '1px solid #E2E8F0', 
        borderRadius: '16px', 
        overflow: 'hidden', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)' 
      }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: isMobile ? '700px' : 'auto' }}>
            {/* Table Header */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '2fr 1.5fr 1.2fr 1.2fr 100px', 
              padding: '14px 20px', 
              borderBottom: '1px solid #F1F5F9', 
              backgroundColor: '#FAFBFC' 
            }}>
              {['Client', 'Package', 'Expiry', 'Status', 'Actions'].map(h => (
                <span key={h} style={{ fontSize: '11px', fontWeight: '800', color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</span>
              ))}
            </div>

            {/* Table Body */}
            {isLoading ? (
              <div style={{ padding: '20px' }}>
                {[1,2,3,4,5].map(i => <div key={i} style={{ marginBottom: '12px' }}><div className="skeleton" style={{ height: '56px', borderRadius: '12px' }} /></div>)}
              </div>
            ) : filteredMembers.length === 0 ? (
              <div style={{ padding: '80px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>💆</div>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '20px', fontWeight: '800', color: 'var(--pf-text)', margin: '0 0 6px' }}>No clients found</p>
                <p style={{ fontSize: '14px', color: 'var(--pf-text-muted)', maxWidth: '340px', margin: '0 auto' }}>Try adjusting your filters or add a new client to the salon.</p>
              </div>
            ) : (
              <div className="stagger">
                {filteredMembers.map((member, idx) => (
                  <div 
                    key={member.id} 
                    className="row-hover"
                    onClick={() => navigate(`/members/${member.id}`)}
                    style={{ 
                      display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.2fr 1.2fr 100px', 
                      padding: '14px 20px', borderBottom: '1px solid #F8FAFC', 
                      alignItems: 'center', cursor: 'pointer', transition: 'all 200ms ease',
                      animationDelay: `${idx * 20}ms`
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ 
                        width: '38px', height: '38px', borderRadius: '12px', 
                        background: 'linear-gradient(135deg, #F8FAFC, #F1F5F9)', 
                        color: '#E11D48', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        fontSize: '14px', fontWeight: '800', border: '1px solid #E2E8F0' 
                      }}>
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</p>
                        <p style={{ fontSize: '12px', color: '#64748B', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>{member.phone}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: '13.5px', color: '#334155', fontWeight: '600' }}>{member.planName}</span>
                    <div>
                        <p style={{ fontSize: '13px', color: '#0F172A', fontWeight: '600', margin: 0 }}>{format(member.endDate.toDate(), 'dd MMM yyyy')}</p>
                        <p style={{ fontSize: '11px', color: '#94A3B8', margin: 0 }}>expires</p>
                    </div>
                    <div><StatusBadge status={member.status} /></div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {can('update', 'members') && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); openEditDrawer(member); }} 
                        className="btn-press"
                        style={{ width: '34px', height: '34px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#E11D48'; e.currentTarget.style.color = '#E11D48'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B'; }}
                      >{Icons.edit}</button>
                      )}
                      {can('delete', 'members') && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setDeletingMember(member); }} 
                        className="btn-press"
                        style={{ width: '34px', height: '34px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#64748B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#EF4444'; e.currentTarget.style.color = '#EF4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B'; }}
                      >{Icons.trash}</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={editingMember ? 'Edit Client Profile' : 'Add New Client'}
        subtitle="Client details for membership tracking and WhatsApp automation."
        footer={
          <>
            <GhostButton onClick={() => setIsDrawerOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => handleSubmit(onSubmit)()} loading={isSaving}>
              {editingMember ? 'Update Client' : 'Add Client'}
            </PrimaryButton>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '4px 0' }}>
          <div>
            <label style={labelStyle}>Full Name</label>
            <input {...register('name')} style={inputStyle} placeholder="e.g. Priya Sharma" />
            {errors.name && <p style={{ color: '#E11D48', fontSize: '11px', marginTop: '6px', fontWeight: '600' }}>{errors.name.message}</p>}
          </div>
          <div>
            <label style={labelStyle}>Mobile Number</label>
            <div style={{ display: 'flex' }}>
               <div style={{ height: '46px', display: 'flex', alignItems: 'center', padding: '0 14px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRight: 'none', borderRadius: '12px 0 0 12px', color: '#64748B', fontSize: '14px', fontWeight: '700' }}>+91</div>
               <input {...register('phone')} style={{...inputStyle, borderRadius: '0 12px 12px 0'}} placeholder="9876543210" maxLength={10} />
            </div>
            {errors.phone && <p style={{ color: '#E11D48', fontSize: '11px', marginTop: '6px', fontWeight: '600' }}>{errors.phone.message}</p>}
          </div>
          <div>
            <label style={labelStyle}>Service Package</label>
            <Controller name="planId" control={control} render={({ field }) => (
              <select {...field} style={{...inputStyle, cursor: 'pointer', appearance: 'none', background: '#FFF url("data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%20fill%3D%22none%22%20stroke%3D%22%2394A3B8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E") no-repeat right 14px center'}}>
                <option value="">Choose a package...</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} (₹{p.price})</option>)}
              </select>
            )} />
            {errors.planId && <p style={{ color: '#E11D48', fontSize: '11px', marginTop: '6px', fontWeight: '600' }}>{errors.planId.message}</p>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Start Date</label>
              <input type="date" {...register('startDate')} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Expiry (Auto-calculated)</label>
              <div style={{...inputStyle, display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', color: '#0F172A', fontWeight: '700'}}>
                {computedEndDate ? format(computedEndDate, 'dd MMM yyyy') : '—'}
              </div>
            </div>
          </div>
        </form>
      </Modal>

      <OtpProtectedConfirm 
        isOpen={!!deletingMember} 
        onClose={() => setDeletingMember(null)} 
        onConfirm={handleDelete} 
        title="Remove Client" 
        message={`This will permanently remove ${deletingMember?.name} and all their records. A WhatsApp OTP will be sent to verify this action.`} 
        confirmLabel="Send OTP & Delete"
        variant="danger"
      />

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason="Member limit reached"
      />
    </div>
  );
}
