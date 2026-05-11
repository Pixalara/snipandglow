import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@/store/authStore';
import { subscribePlans, createPlan, updatePlan, deletePlan } from '@/services/plans.service';
import Modal from '@/components/ui/Modal';
import { PrimaryButton, GhostButton } from '@/components/ui/ModalButtons';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/Toast';
import type { Plan } from '@/types';

const planSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(50, 'Plan name too long'),
  durationDays: z.coerce.number().min(1, 'Duration must be at least 1 day').max(365, 'Duration cannot exceed 365 days'),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
});

type PlanFormData = z.infer<typeof planSchema>;

const Icons = {
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  ),
  plan: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14,2 14,8 20,8" />
    </svg>
  )
};

export default function PlansPage() {
  const { user } = useAuthStore();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>({
    resolver: zodResolver(planSchema),
  });

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribePlans(user.uid, (data) => {
      setPlans(data);
      setIsLoading(false);
    }, (err) => {
      console.error(err);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const openCreateModal = () => {
    setEditingPlan(null);
    reset({ name: '', durationDays: 30, price: 0 });
    setIsModalOpen(true);
  };

  const openEditModal = (plan: Plan) => {
    setEditingPlan(plan);
    reset({ name: plan.name, durationDays: plan.durationDays, price: plan.price });
    setIsModalOpen(true);
  };

  const onSubmit = async (data: PlanFormData) => {
    if (!user) return;
    setIsSaving(true);
    try {
      if (editingPlan?.id) {
        await updatePlan(user.uid, editingPlan.id, data);
        toast('Plan updated successfully', 'success');
      } else {
        await createPlan(user.uid, data);
        toast('Plan created successfully', 'success');
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      toast('Failed to save plan', 'error');
    } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!user || !deletingPlan?.id) return;
    setIsDeleting(true);
    try {
      await deletePlan(user.uid, deletingPlan.id);
      toast('Plan deleted permanently', 'success');
      setDeletingPlan(null);
    } catch (err) {
      console.error(err);
      toast('Failed to delete plan', 'error');
    } finally { setIsDeleting(false); }
  };

  const labelStyle = { 
    display: 'block', fontSize: '11px', fontWeight: '800', color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '8px' 
  };
  const inputStyle = { 
    width: '100%', height: '46px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '0 14px', fontSize: '14px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' as const, fontFamily: "'Inter', sans-serif", transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)' 
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '28px',
      }}>
        <div>
          <h1 style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: '28px', fontWeight: '800',
            color: 'var(--pf-text)', margin: '0 0 4px', letterSpacing: '-0.02em',
          }}>Service Packages</h1>
          <p style={{
            fontSize: '13px', color: 'var(--pf-text-muted)', margin: 0, fontWeight: '500'
          }}>{isLoading ? '...' : plans.length} packages configured</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="btn-press"
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'linear-gradient(135deg, #E11D48, #BE123C)',
            border: 'none', borderRadius: '12px',
            padding: '12px 24px', cursor: 'pointer',
            fontSize: '14px', fontWeight: '800',
            color: '#FFFFFF',
            boxShadow: '0 4px 14px rgba(225,29,72,0.3)',
            transition: 'all 200ms ease',
          }}>
          {Icons.plus}
          New Package
        </button>
      </div>

      {/* Plans Container */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '300px', borderRadius: '14px' }} />)}
        </div>
      ) : plans.length === 0 ? (
        <div style={{ padding: '80px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '56px', marginBottom: '20px' }}>🏷️</div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: '24px', fontWeight: '800', color: '#0F172A', margin: '0 0 8px' }}>No Packages Yet</h2>
          <p style={{ fontSize: '15px', color: '#64748B', maxWidth: '380px', margin: '0 auto 24px' }}>Create your first service package to start adding clients and tracking memberships.</p>
          <button onClick={openCreateModal} style={{ background: '#E11D48', color: '#FFFFFF', border: 'none', padding: '12px 28px', borderRadius: '12px', fontWeight: '800', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(225,29,72,0.2)' }}>Create First Package</button>
        </div>
      ) : (
        <div className="stagger" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}>
          {plans.map((plan, idx) => (
            <div key={plan.id} className="card-hover" style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: '20px',
              padding: '24px',
              transition: 'all 250ms cubic-bezier(0.16, 1, 0.3, 1)',
              opacity: plan.isActive ? 1 : 0.6,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              animationDelay: `${idx * 60}ms`,
              position: 'relative', overflow: 'hidden'
            }}>
              {/* Top Accent */}
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: 'linear-gradient(90deg, #E11D48, #BE123C)' }} />

              <div style={{
                width: '48px', height: '48px',
                borderRadius: '14px',
                backgroundColor: '#FFF1F2',
                color: '#E11D48',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px', marginBottom: '20px',
                boxShadow: '0 4px 12px rgba(225,29,72,0.1)',
              }}>
                {Icons.plan}
              </div>

              <h3 style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '20px', fontWeight: '800',
                color: '#0F172A', margin: '0 0 8px', letterSpacing: '-0.01em'
              }}>{plan.name}</h3>

              <div style={{
                display: 'flex', alignItems: 'baseline',
                gap: '8px', marginBottom: '20px',
              }}>
                <span style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: '32px', fontWeight: '800',
                  color: '#0F172A', letterSpacing: '-0.02em'
                }}>₹{plan.price}</span>
                <span style={{
                  fontSize: '13px', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>per {plan.durationDays} days</span>
              </div>

              {/* Stats / Proof point */}
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: '8px', 
                backgroundColor: '#F8FAFC', padding: '10px 14px', borderRadius: '12px',
                marginBottom: '24px', border: '1px solid #F1F5F9'
              }}>
                 <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} className="glow-dot" />
                 <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Active Service Package</span>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => openEditModal(plan)}
                  className="btn-press"
                  style={{ flex: 1, height: '40px', borderRadius: '10px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#334155', cursor: 'pointer', fontSize: '13px', fontWeight: '700', fontFamily: "'Inter', sans-serif", transition: 'all 200ms', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                >
                  {Icons.edit}
                  Edit
                </button>
                <button 
                  onClick={() => setDeletingPlan(plan)}
                  className="btn-press"
                  style={{ width: '40px', height: '40px', borderRadius: '10px', border: '1px solid #FECDD3', backgroundColor: '#FFF1F2', color: '#E11D48', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#FFE4E6'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFF1F2'; }}
                >
                  {Icons.trash}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PLAN FORM MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPlan ? 'Edit Package' : 'New Service Package'}
        subtitle="Define the name, duration and price for this salon service package."
        footer={
          <>
            <GhostButton onClick={() => setIsModalOpen(false)}>Discard</GhostButton>
            <PrimaryButton onClick={() => handleSubmit(onSubmit)()} loading={isSaving}>
              {editingPlan ? 'Update Plan Info' : 'Publish Plan'}
            </PrimaryButton>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} style={{ padding: '4px 0' }}>
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>PACKAGE NAME</label>
            <input {...register('name')} style={inputStyle} onFocus={e=>{e.target.style.borderColor='#E11D48';e.target.style.boxShadow='0 0 0 3px rgba(225,29,72,0.1)'}} onBlur={e=>{e.target.style.borderColor='#E2E8F0';e.target.style.boxShadow='none'}} placeholder="e.g. Monthly Glow / Annual Luxury" />
            {errors.name && <p style={{ color: '#E11D48', fontSize: '11px', marginTop: '6px', fontWeight: '600' }}>{errors.name.message as string}</p>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '8px' }}>
            <div>
              <label style={labelStyle}>TENURE (DAYS)</label>
              <input type="number" min="1" {...register('durationDays')} style={inputStyle} onFocus={e=>{e.target.style.borderColor='#E11D48';e.target.style.boxShadow='0 0 0 3px rgba(225,29,72,0.1)'}} onBlur={e=>{e.target.style.borderColor='#E2E8F0';e.target.style.boxShadow='none'}} placeholder="30" />
            </div>
            <div>
              <label style={labelStyle}>INVESTMENT (₹)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#94A3B8', fontWeight: '700' }}>₹</span>
                <input type="number" min="0" {...register('price')} style={{...inputStyle, paddingLeft: '32px'}} onFocus={e=>{e.target.style.borderColor='#E11D48';e.target.style.boxShadow='0 0 0 3px rgba(225,29,72,0.1)'}} onBlur={e=>{e.target.style.borderColor='#E2E8F0';e.target.style.boxShadow='none'}} placeholder="0.00" />
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <ConfirmDialog
        isOpen={!!deletingPlan}
        onClose={() => setDeletingPlan(null)}
        onConfirm={handleDelete}
        title="Retire Plan"
        message={`Are you sure you want to delete "${deletingPlan?.name}"? Existing clients won't be affected, but this package will be removed from new registrations.`}
        confirmLabel="Confirm Retirement"
        isLoading={isDeleting}
        variant="danger"
      />
    </div>
  );
}
