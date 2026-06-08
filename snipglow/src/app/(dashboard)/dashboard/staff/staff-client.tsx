'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/data-table';
import { RoleGuard } from '@/components/role-guard';
import { EmployeeForm } from './employee-form';
import { deactivateEmployee, changeEmployeeRole, sendStaffWhatsAppCode, confirmStaffWhatsApp, resetEmployeePassword } from './actions';
import {
  Users,
  Plus,
  UserCog,
  Shield,
  ShieldCheck,
  MapPin,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  BadgeCheck,
  KeyRound,
  MoreVertical,
  Pencil,
  UserPlus,
  Ban,
} from 'lucide-react';
import type { Employee, Branch, UserRole } from '@/types';

// =============================================================================
// StaffClient — Interactive client wrapper for staff management page
// =============================================================================

/** Role badge config */
const ROLE_CONFIG: Record<UserRole, { color: string; icon: typeof Shield }> = {
  owner: {
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    icon: ShieldCheck,
  },
  manager: {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    icon: Shield,
  },
  staff: {
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
    icon: UserCog,
  },
};

interface StaffClientProps {
  employees: Employee[];
  branches: Branch[];
  role: UserRole;
}

export function StaffClient({ employees, branches, role }: StaffClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | undefined>(undefined);
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null);
  const [deactivateError, setDeactivateError] = useState('');
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [roleChangeTarget, setRoleChangeTarget] = useState<Employee | null>(null);
  const [roleChangeError, setRoleChangeError] = useState('');
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  // Staff WhatsApp verification (owner-driven).
  const [verifyTarget, setVerifyTarget] = useState<Employee | null>(null);
  const [verifyStep, setVerifyStep] = useState<'idle' | 'sent'>('idle');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');
  const [verifyErr, setVerifyErr] = useState('');
  // Password reset.
  const [resetTarget, setResetTarget] = useState<Employee | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const [resetErr, setResetErr] = useState('');
  // Row actions dropdown (Edit / Role / Deactivate).
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  async function handleSendCode() {
    if (!verifyTarget) return;
    setVerifyBusy(true); setVerifyErr(''); setVerifyMsg('');
    const res = await sendStaffWhatsAppCode(verifyTarget.id);
    setVerifyBusy(false);
    if (!res.success) { setVerifyErr(res.error); return; }
    setVerifyStep('sent');
    setVerifyMsg('Code sent to the staff WhatsApp. Ask them for it and enter below.');
  }

  async function handleConfirmCode() {
    if (!verifyTarget) return;
    setVerifyBusy(true); setVerifyErr(''); setVerifyMsg('');
    const res = await confirmStaffWhatsApp(verifyTarget.id, verifyCode);
    setVerifyBusy(false);
    if (!res.success) { setVerifyErr(res.error); return; }
    setVerifyTarget(null); setVerifyStep('idle'); setVerifyCode('');
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    setResetBusy(true); setResetErr(''); setResetMsg('');
    const res = await resetEmployeePassword(resetTarget.id, resetPw);
    setResetBusy(false);
    if (!res.success) { setResetErr(res.error); return; }
    setResetMsg('Password updated. Share the new password with your staff member.');
    setResetPw('');
  }

  function handleEdit(employee: Employee) {
    setEditingEmployee(employee);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingEmployee(undefined);
  }

  async function handleConfirmDeactivate() {
    if (!deactivateTarget) return;
    setIsDeactivating(true);
    setDeactivateError('');

    const result = await deactivateEmployee(deactivateTarget.id);

    setIsDeactivating(false);

    if (!result.success) {
      setDeactivateError(result.error);
      return;
    }

    setDeactivateTarget(null);
  }

  async function handleRoleChange(newRole: UserRole) {
    if (!roleChangeTarget) return;
    setIsChangingRole(true);
    setRoleChangeError('');

    const result = await changeEmployeeRole(roleChangeTarget.id, newRole);

    setIsChangingRole(false);

    if (!result.success) {
      setRoleChangeError(result.error);
      return;
    }

    setRoleChangeTarget(null);
  }

  /** Get branch name by ID */
  function getBranchName(branchId: string): string {
    const branch = branches.find((b) => b.id === branchId);
    return branch?.name ?? 'Unknown';
  }

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Employee',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-salon-rose/20 to-salon-gold/20 text-xs font-bold text-salon-rose">
            {row.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="font-medium text-foreground">{row.name}</span>
            <p className="text-xs text-muted-foreground">{row.phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => {
        const config = ROLE_CONFIG[row.role];
        const Icon = config.icon;
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${config.color}`}>
            <Icon className="size-3" />
            {row.role}
          </span>
        );
      },
    },
    {
      key: 'branch',
      header: 'Branch',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <MapPin className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">{getBranchName(row.branch_id)}</span>
        </div>
      ),
    },
    {
      key: 'specializations',
      header: 'Specializations',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.specializations?.length > 0 ? (
            row.specializations.slice(0, 3).map((spec) => (
              <span key={spec} className="inline-flex items-center rounded-md bg-salon-gold/10 px-1.5 py-0.5 text-xs text-salon-gold dark:text-amber-400">
                {spec}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
          {row.specializations?.length > 3 && (
            <span className="text-xs text-muted-foreground">+{row.specializations.length - 3}</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            row.is_active
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
          }`}
        >
          <span className={`size-1.5 rounded-full ${row.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {row.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'login_access',
      header: 'Login Access',
      render: (row) => {
        if (row.login_method !== 'password') {
          return <span className="text-xs text-muted-foreground">No login</span>;
        }
        const verified = !!row.phone_verified_by_owner;
        return (
          <div className="flex flex-col items-start gap-1.5">
            <span
              className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                verified
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
              }`}
            >
              <span className={`size-1.5 rounded-full ${verified ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {verified ? 'Verified' : 'Pending'}
            </span>
            <div className="flex items-center gap-2">
              {!verified && (
                <button
                  type="button"
                  onClick={() => { setVerifyTarget(row); setVerifyStep('idle'); setVerifyCode(''); setVerifyMsg(''); setVerifyErr(''); }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 transition-colors"
                >
                  <BadgeCheck className="size-3.5" />
                  Verify
                </button>
              )}
              <button
                type="button"
                onClick={() => { setResetTarget(row); setResetPw(''); setResetMsg(''); setResetErr(''); }}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <KeyRound className="size-3.5" />
                Password
              </button>
            </div>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="relative flex justify-end">
          <button
            type="button"
            onClick={() => setMenuOpenId(menuOpenId === row.id ? null : row.id)}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Row actions"
          >
            <MoreVertical className="size-4" />
          </button>

          {menuOpenId === row.id && (
            <>
              {/* Click-away backdrop */}
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
              <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                <RoleGuard role={role} action="update" resource="staff">
                  <button
                    type="button"
                    onClick={() => { setMenuOpenId(null); handleEdit(row); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <Pencil className="size-3.5 text-muted-foreground" />
                    Edit
                  </button>
                </RoleGuard>
                <RoleGuard role={role} action="update" resource="staff">
                  <button
                    type="button"
                    onClick={() => { setMenuOpenId(null); setRoleChangeTarget(row); setRoleChangeError(''); }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <UserPlus className="size-3.5 text-muted-foreground" />
                    Change role
                  </button>
                </RoleGuard>
                <RoleGuard role={role} action="delete" resource="staff">
                  {row.is_active && (
                    <button
                      type="button"
                      onClick={() => { setMenuOpenId(null); setDeactivateTarget(row); setDeactivateError(''); }}
                      className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Ban className="size-3.5" />
                      Deactivate
                    </button>
                  )}
                </RoleGuard>
              </div>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent border border-violet-200/50 dark:border-violet-800/30 p-6">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/30">
              <Users className="size-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Staff Management</h1>
              <p className="text-sm text-muted-foreground">
                {employees.filter(e => e.is_active).length} active · {employees.length} total team member{employees.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <RoleGuard role={role} action="create" resource="staff">
            <Button onClick={() => setShowForm(true)} className="rounded-xl gap-1.5">
              <Plus className="size-4" />
              Add Employee
            </Button>
          </RoleGuard>
        </div>
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-violet-500/5" />
        <div className="absolute -right-2 top-10 h-20 w-20 rounded-full bg-violet-400/5" />
      </div>

      {/* Employee DataTable */}
      {employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-900/20 mb-4">
            <Sparkles className="size-6 text-violet-500" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No team members yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Add your first employee to start managing your salon team and assigning appointments.
          </p>
          <RoleGuard role={role} action="create" resource="staff">
            <Button onClick={() => setShowForm(true)} className="mt-4 rounded-xl gap-1.5" variant="outline">
              <Plus className="size-4" />
              Add First Employee
            </Button>
          </RoleGuard>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <DataTable
            columns={columns}
            data={employees}
            getRowKey={(row) => row.id}
            emptyMessage="No employees found. Add your first team member to get started."
          />
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <Modal onClose={handleCloseForm}>
          <EmployeeForm
            employee={editingEmployee}
            branches={branches}
            onClose={handleCloseForm}
          />
        </Modal>
      )}

      {/* Staff WhatsApp verification (owner-driven) */}
      {verifyTarget && (
        <Modal onClose={() => setVerifyTarget(null)}>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Verify {verifyTarget.name}&apos;s WhatsApp</h2>
            <p className="text-sm text-muted-foreground">
              Send a one-time code to <strong>{verifyTarget.phone}</strong> on WhatsApp. Ask your staff
              member to read it back to you, then enter it here to allow their login.
            </p>

            {verifyStep === 'idle' ? (
              <Button className="w-full rounded-xl" onClick={handleSendCode} disabled={verifyBusy}>
                {verifyBusy ? 'Sending...' : 'Send code to WhatsApp'}
              </Button>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter the 6-digit code"
                  className="w-full h-11 rounded-xl border border-input bg-transparent px-4 text-sm tracking-widest outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={handleSendCode} disabled={verifyBusy}>
                    Resend
                  </Button>
                  <Button className="flex-1 rounded-xl" onClick={handleConfirmCode} disabled={verifyBusy || verifyCode.length < 6}>
                    {verifyBusy ? 'Verifying...' : 'Confirm & verify'}
                  </Button>
                </div>
              </div>
            )}

            {verifyMsg && <p className="text-sm text-emerald-600">{verifyMsg}</p>}
            {verifyErr && <p className="text-sm text-destructive">{verifyErr}</p>}
          </div>
        </Modal>
      )}

      {/* Reset staff password (owner-only) */}
      {resetTarget && (
        <Modal onClose={() => setResetTarget(null)}>
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Reset {resetTarget.name}&apos;s password</h2>
            <p className="text-sm text-muted-foreground">
              Set a new password and share it with your staff member. Their login ID stays their
              mobile number (<strong>{resetTarget.phone}</strong>).
            </p>
            <input
              type="text"
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              placeholder="e.g., Salon@1"
              className="w-full h-11 rounded-xl border border-input bg-transparent px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <p className="text-xs text-muted-foreground">
              At least 6 characters with a letter, a number, and a special character.
            </p>
            <Button className="w-full rounded-xl" onClick={handleResetPassword} disabled={resetBusy || !resetPw}>
              {resetBusy ? 'Updating...' : 'Update password'}
            </Button>
            {resetMsg && <p className="text-sm text-emerald-600">{resetMsg}</p>}
            {resetErr && <p className="text-sm text-destructive">{resetErr}</p>}
          </div>
        </Modal>
      )}

      {/* Deactivate Confirmation Dialog */}
      {deactivateTarget && (
        <Modal onClose={() => setDeactivateTarget(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/20">
                <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Deactivate Employee</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to deactivate{' '}
              <span className="font-medium text-foreground">{deactivateTarget.name}</span>?
              This will revoke their login access. The record will not be deleted.
            </p>
            {deactivateError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-900/20">
                <p className="text-sm text-amber-800 dark:text-amber-200">{deactivateError}</p>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setDeactivateTarget(null)}
                disabled={isDeactivating}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={handleConfirmDeactivate}
                disabled={isDeactivating}
              >
                {isDeactivating ? 'Deactivating...' : 'Deactivate'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Role Change Modal */}
      {roleChangeTarget && (
        <Modal onClose={() => setRoleChangeTarget(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                <Shield className="size-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Change Role</h2>
                <p className="text-sm text-muted-foreground">{roleChangeTarget.name}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Current role:{' '}
              <span className="font-medium text-foreground capitalize">{roleChangeTarget.role}</span>
            </p>

            {roleChangeError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-900/20">
                <p className="text-sm text-red-800 dark:text-red-200">{roleChangeError}</p>
              </div>
            )}

            <div className="space-y-2">
              {(['owner', 'manager', 'staff'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRoleChange(r)}
                  disabled={isChangingRole || r === roleChangeTarget.role}
                  className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    r === roleChangeTarget.role
                      ? 'border-primary bg-primary/5 cursor-default'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  } disabled:opacity-50`}
                >
                  <div className={`flex size-8 items-center justify-center rounded-lg ${ROLE_CONFIG[r].color}`}>
                    {r === 'owner' ? <ShieldCheck className="size-4" /> : r === 'manager' ? <Shield className="size-4" /> : <UserCog className="size-4" />}
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-foreground capitalize">{r}</span>
                    <p className="text-xs text-muted-foreground">
                      {r === 'owner' && 'Full access to all features and settings'}
                      {r === 'manager' && 'Manage appointments, customers, billing, and expenses'}
                      {r === 'staff' && 'View-only access to appointments and customers'}
                    </p>
                  </div>
                  {r === roleChangeTarget.role && (
                    <span className="text-xs font-medium text-primary">Current</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end pt-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setRoleChangeTarget(null)} disabled={isChangingRole}>
                {isChangingRole ? 'Changing...' : 'Close'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Permission Matrix */}
      <RoleGuard role={role} action="read" resource="staff">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <button
            onClick={() => setShowPermissions(!showPermissions)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Shield className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Role Permissions Matrix</span>
            </div>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${showPermissions ? 'rotate-180' : ''}`} />
          </button>
          {showPermissions && (
            <div className="border-t border-border p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Feature</th>
                      <th className="text-center py-2 px-3 font-medium text-purple-600">Owner</th>
                      <th className="text-center py-2 px-3 font-medium text-blue-600">Manager</th>
                      <th className="text-center py-2 px-3 font-medium text-gray-600">Staff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      { feature: 'Dashboard', owner: 'Full', manager: 'View', staff: 'View' },
                      { feature: 'Appointments', owner: 'Full CRUD', manager: 'Create/Edit', staff: 'View' },
                      { feature: 'Customers', owner: 'Full CRUD', manager: 'Create/Edit', staff: 'View' },
                      { feature: 'Services', owner: 'Full CRUD', manager: 'Create/Edit', staff: 'View' },
                      { feature: 'Billing', owner: 'Full CRUD', manager: 'Create', staff: '—' },
                      { feature: 'Expenses', owner: 'Full CRUD', manager: 'Create', staff: '—' },
                      { feature: 'Memberships', owner: 'Full CRUD', manager: 'View', staff: '—' },
                      { feature: 'Staff', owner: 'Full CRUD', manager: '—', staff: '—' },
                      { feature: 'Payroll', owner: 'Full CRUD', manager: '—', staff: '—' },
                      { feature: 'Branches', owner: 'Full CRUD', manager: '—', staff: '—' },
                      { feature: 'Analytics', owner: 'Full', manager: 'View', staff: '—' },
                      { feature: 'Settings', owner: 'Full', manager: '—', staff: '—' },
                    ].map((row) => (
                      <tr key={row.feature}>
                        <td className="py-2 pr-4 font-medium text-foreground">{row.feature}</td>
                        <td className="py-2 px-3 text-center text-purple-600">{row.owner}</td>
                        <td className="py-2 px-3 text-center text-blue-600">{row.manager}</td>
                        <td className="py-2 px-3 text-center text-gray-500">{row.staff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </RoleGuard>
    </div>
  );
}

// =============================================================================
// Modal — Simple overlay modal component
// =============================================================================

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
}

function Modal({ children, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Content */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
