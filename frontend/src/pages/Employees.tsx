// PingFlow — Employee Management Page (Admin Only)
// Create, manage, and deactivate employee accounts

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useResponsive } from '@/hooks/useResponsive';
import { useRole } from '@/hooks/useRole';
import { usePlan } from '@/hooks/usePlan';
import UpgradeModal from '@/components/ui/UpgradeModal';
import { useBranch } from '@/hooks/useBranch';
import {
  collection, onSnapshot, updateDoc, doc, query, orderBy,
} from 'firebase/firestore';
import { db } from '@/services/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '@/services/firebase';
import Modal from '@/components/ui/Modal';
import { PrimaryButton, GhostButton } from '@/components/ui/ModalButtons';
import { toast } from '@/components/ui/Toast';
import OtpProtectedConfirm from '@/components/ui/OtpProtectedConfirm';
import type { Employee, UserRole } from '@/types';

type EmployeeRole = Exclude<UserRole, 'admin'>;

const ROLE_OPTIONS: { value: EmployeeRole; label: string; description: string }[] = [
  { value: 'branch_manager', label: 'Branch Manager', description: 'Full access to assigned branch — clients, packages, billing, automations, broadcast' },
  { value: 'stylist', label: 'Stylist', description: 'View clients and check them in — no billing or package management' },
  { value: 'sales_executive', label: 'Sales Executive', description: 'Add clients and record payments — no automations or broadcast' },
  { value: 'receptionist', label: 'Receptionist', description: 'View clients, check in, and view packages — read-only access' },
];

const ROLE_BADGE_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  branch_manager: { bg: '#EFF6FF', color: '#3B82F6', label: 'BRANCH MANAGER' },
  stylist: { bg: '#ECFDF5', color: '#10B981', label: 'STYLIST' },
  sales_executive: { bg: '#FFFBEB', color: '#F59E0B', label: 'SALES EXEC' },
  receptionist: { bg: '#F5F3FF', color: '#8B5CF6', label: 'RECEPTIONIST' },
  // Legacy fallbacks
  manager: { bg: '#EFF6FF', color: '#3B82F6', label: 'BRANCH MANAGER' },
  employee: { bg: '#F5F3FF', color: '#8B5CF6', label: 'RECEPTIONIST' },
};

export default function EmployeesPage() {
  const { user } = useAuthStore();
  const { isMobile } = useResponsive();
  const { isAdmin } = useRole();
  const { branches, isMultiBranch } = useBranch();
  const { isAtLimit } = usePlan();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formBranch, setFormBranch] = useState('');
  const [formRole, setFormRole] = useState<EmployeeRole | ''>('');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<EmployeeRole>('receptionist');
  const [editBranch, setEditBranch] = useState('');

  const gymId = user?.uid;

  useEffect(() => {
    if (!gymId) return;
    const q = query(collection(db, 'gyms', gymId, 'employees'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
      setIsLoading(false);
    }, () => setIsLoading(false));
    return unsub;
  }, [gymId]);

  const handleCreate = async () => {
    if (!gymId) return;
    if (!formName.trim() || !formEmail.trim() || !formPassword || formPassword.length < 6) {
      toast('Fill all fields. Password must be 6+ characters.', 'error');
      return;
    }
    if (!formRole) {
      toast('Please select a role for the employee.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const functions = getFunctions(app, 'asia-south1');
      const createEmpFn = httpsCallable(functions, 'createEmployee');
      const result = await createEmpFn({
        gymId,
        name: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        phone: formPhone.trim(),
        password: formPassword,
        role: formRole,
        assignedBranches: formBranch ? [formBranch] : [],
      });
      const data = result.data as { success: boolean; error?: string };
      if (data.success) {
        toast('Employee account created!', 'success');
        setIsCreateOpen(false);
        setFormName(''); setFormEmail(''); setFormPhone(''); setFormPassword(''); setFormBranch(''); setFormRole('');
      } else {
        toast(data.error || 'Failed to create employee', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to create employee', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (emp: Employee) => {
    if (!gymId || !emp.id) return;
    try {
      const newActive = !emp.isActive;
      await updateDoc(doc(db, 'gyms', gymId, 'employees', emp.id), { isActive: newActive });
      // Sync the lookup doc
      await updateDoc(doc(db, 'employeeLinks', emp.uid), { isActive: newActive });
      toast(emp.isActive ? 'Employee deactivated' : 'Employee activated', 'success');
    } catch {
      toast('Failed to update employee', 'error');
    }
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setEditName(emp.name);
    setEditPhone(emp.phone || '');
    // Map legacy roles to new roles
    const legacyMap: Record<string, EmployeeRole> = { manager: 'branch_manager', employee: 'receptionist' };
    const mapped = legacyMap[emp.role] || (ROLE_OPTIONS.some(r => r.value === emp.role) ? emp.role as EmployeeRole : 'receptionist');
    setEditRole(mapped);
    setEditBranch(emp.assignedBranches?.[0] || '');
    setIsEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!gymId || !editingEmployee?.id) return;
    if (!editName.trim()) { toast('Name is required', 'error'); return; }
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'gyms', gymId, 'employees', editingEmployee.id), {
        name: editName.trim(),
        phone: editPhone.trim(),
        role: editRole,
        assignedBranches: editBranch ? [editBranch] : [],
      });
      await updateDoc(doc(db, 'employeeLinks', editingEmployee.uid), {
        name: editName.trim(),
        role: editRole,
        assignedBranches: editBranch ? [editBranch] : [],
      });
      toast('Employee updated!', 'success');
      setIsEditOpen(false);
      setEditingEmployee(null);
    } catch {
      toast('Failed to update employee', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!gymId || !deletingEmployee) return;
    try {
      const functions = getFunctions(app, 'asia-south1');
      const deleteEmpFn = httpsCallable(functions, 'deleteEmployee');
      const result = await deleteEmpFn({ gymId, employeeUid: deletingEmployee.uid });
      const data = result.data as { success: boolean };
      if (data.success) {
        toast(`${deletingEmployee.name} removed permanently`, 'success');
        setDeletingEmployee(null);
      }
    } catch (err: any) {
      toast(err.message || 'Failed to remove employee', 'error');
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center' }}>
        <p style={{ fontSize: '18px', fontWeight: '700', color: '#EF4444' }}>Access Denied</p>
        <p style={{ color: '#64748B' }}>Only admins can manage employees.</p>
      </div>
    );
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
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: isMobile ? '22px' : '28px', fontWeight: '800', color: 'var(--pf-text)', margin: '0 0 4px' }}>Staff</h1>
          <p style={{ fontSize: '14px', color: 'var(--pf-text-muted)', margin: 0 }}>Manage staff access to your salon dashboard</p>
        </div>
        <button onClick={() => {
          if (isAtLimit('employees', employees.length)) {
            setShowUpgradeModal(true);
            return;
          }
          setIsCreateOpen(true);
        }} className="btn-press" style={{
          padding: '10px 20px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #E11D48, #BE123C)',
          color: '#FFF', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(225,29,72,0.3)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          + Add Employee
        </button>
        <button onClick={async () => {
          if (!gymId) return;
          try {
            const functions = getFunctions(app, 'asia-south1');
            const fn = httpsCallable(functions, 'backfillEmployeeLinks');
            const result = await fn({ gymId });
            const data = result.data as { backfilled: number; total: number };
            toast(`Backfilled ${data.backfilled} of ${data.total} employee links`, 'success');
          } catch (err: any) { toast(err.message, 'error'); }
        }} style={{
          padding: '10px 16px', borderRadius: '12px', border: '1px solid #E2E8F0',
          backgroundColor: '#FFF', color: '#334155', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
        }}>
          🔄 Fix Employee Links
        </button>
      </div>

      {/* Employee List */}
      <div style={{ backgroundColor: '#FFF', border: '1px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '16px' }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '56px', marginBottom: '8px', borderRadius: '8px' }} />)}</div>
        ) : employees.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
            <p style={{ fontFamily: "'Outfit', sans-serif", fontSize: '18px', fontWeight: '700', color: '#0F172A', margin: '0 0 4px' }}>No staff yet</p>
            <p style={{ fontSize: '14px', color: '#64748B' }}>Add staff members to give them restricted access to the salon dashboard.</p>
          </div>
        ) : (
          employees.map((emp, i) => (
            <div key={emp.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: i < employees.length - 1 ? '1px solid #F1F5F9' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: emp.isActive ? 'linear-gradient(135deg, #ECFDF5, #D1FAE5)' : '#F1F5F9',
                  color: emp.isActive ? '#059669' : '#94A3B8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', fontWeight: '700',
                }}>{emp.name.charAt(0).toUpperCase()}</div>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A', margin: 0 }}>{emp.name}</p>
                  <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>
                    {emp.email}
                    {(() => {
                      const badge = ROLE_BADGE_CONFIG[emp.role] || ROLE_BADGE_CONFIG.receptionist;
                      return (
                        <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', backgroundColor: badge.bg, color: badge.color }}>
                          {badge.label}
                        </span>
                      );
                    })()}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '3px 10px', borderRadius: '20px',
                  backgroundColor: emp.isActive ? '#ECFDF5' : '#FEF2F2',
                  color: emp.isActive ? '#059669' : '#DC2626',
                  fontSize: '11px', fontWeight: '700',
                }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: emp.isActive ? '#10B981' : '#EF4444' }} />
                  {emp.isActive ? 'Active' : 'Disabled'}
                </div>
                <button onClick={() => openEditModal(emp)} style={{
                  padding: '6px 14px', borderRadius: '8px', border: '1px solid #E2E8F0',
                  backgroundColor: '#FFF', fontSize: '12px', fontWeight: '600',
                  color: '#3B82F6', cursor: 'pointer',
                }}>
                  Edit
                </button>
                <button onClick={() => handleToggleActive(emp)} style={{
                  padding: '6px 14px', borderRadius: '8px', border: '1px solid #E2E8F0',
                  backgroundColor: '#FFF', fontSize: '12px', fontWeight: '600',
                  color: emp.isActive ? '#DC2626' : '#059669', cursor: 'pointer',
                }}>
                  {emp.isActive ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => setDeletingEmployee(emp)} style={{
                  padding: '6px 14px', borderRadius: '8px', border: '1px solid #FECDD3',
                  backgroundColor: '#FFF1F2', fontSize: '12px', fontWeight: '600',
                  color: '#E11D48', cursor: 'pointer',
                }}>
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Add Staff Member" subtitle="Create a restricted access account for your salon staff" footer={
        <><GhostButton onClick={() => setIsCreateOpen(false)}>Cancel</GhostButton><PrimaryButton onClick={handleCreate} loading={isSaving}>Create Account</PrimaryButton></>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Role *</label>
            <select style={inputStyle} value={formRole} onChange={e => setFormRole(e.target.value as EmployeeRole)}>
              <option value="">Select a role...</option>
              {ROLE_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {formRole && (
              <p style={{ fontSize: '11px', color: '#64748B', fontWeight: '500', margin: '6px 0 0', lineHeight: '1.5' }}>
                {ROLE_OPTIONS.find(r => r.value === formRole)?.description}
              </p>
            )}
          </div>
          <div><label style={labelStyle}>Full Name *</label><input style={inputStyle} value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Ravi Kumar" /></div>
          <div><label style={labelStyle}>Email Address *</label><input type="email" style={inputStyle} value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="ravi@example.com" /></div>
          <div><label style={labelStyle}>Phone (optional)</label><input style={inputStyle} value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="9876543210" /></div>
          <div><label style={labelStyle}>Password *</label><input type="password" style={inputStyle} value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="Min 6 characters" /></div>
          {isMultiBranch && branches.filter(b => b.isActive).length > 0 && (
            <div>
              <label style={labelStyle}>Assign to Branch *</label>
              <select style={inputStyle} value={formBranch} onChange={e => setFormBranch(e.target.value)}>
                <option value="">Select branch...</option>
                {branches.filter(b => b.isActive).map(b => (
                  <option key={b.id} value={b.id!}>{b.name}{b.isDefault ? ' (Default)' : ''}</option>
                ))}
              </select>
              {!formBranch && (
                <p style={{ fontSize: '11px', color: '#F59E0B', fontWeight: '600', margin: '6px 0 0' }}>⚠️ Select a branch for the employee</p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Employee" subtitle={`Update details for ${editingEmployee?.email || ''}`} footer={
        <><GhostButton onClick={() => setIsEditOpen(false)}>Cancel</GhostButton><PrimaryButton onClick={handleEditSave} loading={isSaving}>Save Changes</PrimaryButton></>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div><label style={labelStyle}>Full Name *</label><input style={inputStyle} value={editName} onChange={e => setEditName(e.target.value)} placeholder="Employee name" /></div>
          <div><label style={labelStyle}>Phone</label><input style={inputStyle} value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="9876543210" /></div>
          <div>
            <label style={labelStyle}>Role</label>
            <select style={inputStyle} value={editRole} onChange={e => setEditRole(e.target.value as EmployeeRole)}>
              {ROLE_OPTIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <p style={{ fontSize: '11px', color: '#64748B', fontWeight: '500', margin: '6px 0 0', lineHeight: '1.5' }}>
              {ROLE_OPTIONS.find(r => r.value === editRole)?.description}
            </p>
          </div>
          {/* Branch assignment — only shown when multi-branch is enabled */}
          {isMultiBranch && branches.length > 0 && (
            <div>
              <label style={labelStyle}>Assigned Branch</label>
              <select style={inputStyle} value={editBranch} onChange={e => setEditBranch(e.target.value)}>
                <option value="">Select branch...</option>
                {branches.filter(b => b.isActive).map(b => (
                  <option key={b.id} value={b.id!}>{b.name}{b.isDefault ? ' (Default)' : ''}</option>
                ))}
              </select>
              {!editBranch && (
                <p style={{ fontSize: '11px', color: '#F59E0B', fontWeight: '600', margin: '6px 0 0' }}>⚠️ No branch assigned — employee won't see any data</p>
              )}
            </div>
          )}
          <div>
            <label style={labelStyle}>Email</label>
            <input style={{ ...inputStyle, backgroundColor: '#F8FAFC', cursor: 'not-allowed', color: '#94A3B8' }} value={editingEmployee?.email || ''} readOnly />
          </div>
        </div>
      </Modal>

      <OtpProtectedConfirm
        isOpen={!!deletingEmployee}
        onClose={() => setDeletingEmployee(null)}
        onConfirm={handleDeleteEmployee}
        title="Remove Employee"
        message={`This will permanently delete ${deletingEmployee?.name}'s account (${deletingEmployee?.email}), remove their login access, and delete all associated data. This cannot be undone.`}
        confirmLabel="Send OTP & Remove"
        variant="danger"
      />

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason="Employee limit reached"
      />
    </div>
  );
}
