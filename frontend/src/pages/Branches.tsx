// PingFlow — Branch Management Page (Admin Only)
// Add, edit, and manage gym branches

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import { useRole } from '@/hooks/useRole';
import { usePlan } from '@/hooks/usePlan';
import UpgradeModal from '@/components/ui/UpgradeModal';
import { subscribeBranches, createBranch, updateBranch } from '@/services/branch.service';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import Modal from '@/components/ui/Modal';
import { PrimaryButton, GhostButton } from '@/components/ui/ModalButtons';
import { toast } from '@/components/ui/Toast';
import type { Branch } from '@/types';

export default function BranchesPage() {
  const { user, gym, setGym, setBranches: setStoreBranches } = useAuthStore();
  const { isMobile } = useResponsive();
  const { isAdmin } = useRole();
  const { isAtLimit } = usePlan();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');

  const gymId = user?.uid;

  useEffect(() => {
    if (!gymId) return;
    const unsub = subscribeBranches(gymId, (data) => {
      setBranches(data);
      setStoreBranches(data);
      setIsLoading(false);
    }, () => setIsLoading(false));
    return unsub;
  }, [gymId, setStoreBranches]);

  const handleCreate = async () => {
    if (!gymId) return;
    if (!formName.trim()) { toast('Branch name is required', 'error'); return; }
    setIsSaving(true);
    try {
      const isFirst = branches.length === 0;
      await createBranch(gymId, {
        name: formName.trim(),
        address: formAddress.trim(),
        phone: formPhone.trim(),
        isDefault: isFirst,
      });
      // Auto-enable multi-branch when first branch is added
      if (!gym?.isMultiBranch) {
        await updateDoc(doc(db, 'gyms', gymId), { isMultiBranch: true });
        if (gym) setGym({ ...gym, isMultiBranch: true });
      }
      toast('Branch created!', 'success');
      setIsCreateOpen(false);
      setFormName(''); setFormAddress(''); setFormPhone('');
    } catch (err: any) {
      toast(err.message || 'Failed to create branch', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (b: Branch) => {
    setEditingBranch(b);
    setFormName(b.name);
    setFormAddress(b.address || '');
    setFormPhone(b.phone || '');
    setIsEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!gymId || !editingBranch?.id) return;
    if (!formName.trim()) { toast('Branch name is required', 'error'); return; }
    setIsSaving(true);
    try {
      await updateBranch(gymId, editingBranch.id, {
        name: formName.trim(),
        address: formAddress.trim(),
        phone: formPhone.trim(),
      });
      toast('Branch updated!', 'success');
      setIsEditOpen(false);
    } catch {
      toast('Failed to update branch', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin) {
    return <div style={{ padding: '80px 20px', textAlign: 'center' }}><p style={{ fontSize: '18px', fontWeight: '700', color: '#EF4444' }}>Access Denied</p></div>;
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: '46px', padding: '0 16px', borderRadius: '12px',
    border: '1px solid #E2E8F0', backgroundColor: '#FFF', color: '#0F172A',
    fontSize: '14px', fontFamily: "'Inter', sans-serif", outline: 'none',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: '800', color: '#94A3B8',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px',
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: '#0F172A', margin: '0 0 4px' }}>Branches</h1>
          <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>Manage your gym locations</p>
        </div>
        <button onClick={() => { setFormName(''); setFormAddress(''); setFormPhone(''); if (isAtLimit('branches', branches.length)) { setShowUpgradeModal(true); return; } setIsCreateOpen(true); }} className="btn-press" style={{
          padding: '10px 20px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #E11D48, #BE123C)',
          color: '#FFF', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(225,29,72,0.3)', display: 'flex', alignItems: 'center', gap: '8px',
        }}>+ Add Branch</button>
      </div>

      {/* Info banner */}
      {branches.length === 0 && (
        <div style={{ padding: '16px 20px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '14px', marginBottom: '20px' }}>
          <p style={{ fontSize: '13px', color: '#1E40AF', fontWeight: '600', margin: 0 }}>
            💡 Adding your first branch will enable multi-branch mode. Members, plans, and payments will be scoped per branch.
          </p>
        </div>
      )}

      {/* Branch list */}
      <div style={{ backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '16px' }}>{[1,2].map(i => <div key={i} className="skeleton" style={{ height: '56px', marginBottom: '8px', borderRadius: '8px' }} />)}</div>
        ) : branches.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏢</div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '700', color: '#0F172A', margin: '0 0 4px' }}>Single location mode</p>
            <p style={{ fontSize: '14px', color: '#64748B' }}>Add branches to manage multiple gym locations from one dashboard.</p>
          </div>
        ) : (
          branches.map((b, i) => (
            <div key={b.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: i < branches.length - 1 ? '1px solid #F1F5F9' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
                  color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px',
                }}>🏢</div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', margin: 0 }}>{b.name}</p>
                    {b.isDefault && <span style={{ fontSize: '9px', fontWeight: '700', color: '#3B82F6', backgroundColor: '#EFF6FF', padding: '2px 6px', borderRadius: '4px' }}>DEFAULT</span>}
                  </div>
                  {b.address && <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>{b.address}</p>}
                </div>
              </div>
              <button onClick={() => openEdit(b)} style={{
                padding: '6px 14px', borderRadius: '8px', border: '1px solid #E2E8F0',
                backgroundColor: '#FFF', fontSize: '12px', fontWeight: '600', color: '#3B82F6', cursor: 'pointer',
              }}>Edit</button>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add Branch" subtitle="Create a new gym location" footer={
        <><GhostButton onClick={() => setIsCreateOpen(false)}>Cancel</GhostButton><PrimaryButton onClick={handleCreate} loading={isSaving}>Create Branch</PrimaryButton></>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div><label style={labelStyle}>Branch Name *</label><input style={inputStyle} value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Downtown Branch" /></div>
          <div><label style={labelStyle}>Address</label><input style={inputStyle} value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="123 Main Street" /></div>
          <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="9876543210" /></div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Branch" subtitle={editingBranch?.name || ''} footer={
        <><GhostButton onClick={() => setIsEditOpen(false)}>Cancel</GhostButton><PrimaryButton onClick={handleEditSave} loading={isSaving}>Save Changes</PrimaryButton></>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div><label style={labelStyle}>Branch Name *</label><input style={inputStyle} value={formName} onChange={e => setFormName(e.target.value)} /></div>
          <div><label style={labelStyle}>Address</label><input style={inputStyle} value={formAddress} onChange={e => setFormAddress(e.target.value)} /></div>
          <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={formPhone} onChange={e => setFormPhone(e.target.value)} /></div>
        </div>
      </Modal>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason="Branch limit reached"
      />
    </div>
  );
}
