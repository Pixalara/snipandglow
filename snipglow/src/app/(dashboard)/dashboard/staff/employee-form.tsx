'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createEmployee, updateEmployee } from './actions';
import type { Employee, Branch, UserRole } from '@/types';

// =============================================================================
// EmployeeForm — Client component for create/edit modal
// =============================================================================

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
];

interface EmployeeFormProps {
  /** If provided, the form is in edit mode */
  employee?: Employee;
  /** Available branches for assignment */
  branches: Branch[];
  /** Called when the form is submitted successfully or cancelled */
  onClose: () => void;
}

export function EmployeeForm({ employee, branches, onClose }: EmployeeFormProps) {
  const isEditing = !!employee;

  const [name, setName] = useState(employee?.name ?? '');
  const [phone, setPhone] = useState(employee?.phone ?? '');
  const [email, setEmail] = useState(employee?.email ?? '');
  const [role, setRole] = useState<UserRole>(employee?.role ?? 'staff');
  const [branchId, setBranchId] = useState(employee?.branch_id ?? (branches[0]?.id ?? ''));
  const [specializations, setSpecializations] = useState(
    employee?.specializations?.join(', ') ?? ''
  );
  // Login provisioning (create mode only). When enabled, owner sets a password
  // and the staff member can log in with email + password.
  const [enableLogin, setEnableLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!name.trim()) {
      setError('Employee name is required.');
      setIsSubmitting(false);
      return;
    }
    if (!phone.trim()) {
      setError('Phone number is required.');
      setIsSubmitting(false);
      return;
    }
    if (!branchId) {
      setError('Branch assignment is required.');
      setIsSubmitting(false);
      return;
    }

    if (!isEditing && enableLogin) {
      const phoneDigits = phone.replace(/\D/g, '');
      const ten = phoneDigits.length === 12 && phoneDigits.startsWith('91') ? phoneDigits.slice(2) : phoneDigits;
      if (ten.length !== 10) {
        setError('A valid 10-digit mobile number is required — it is the staff login ID.');
        setIsSubmitting(false);
        return;
      }
      // Policy: >=6 chars, at least one letter, one number, one special char.
      const okLen = password.length >= 6;
      const hasLetter = /[A-Za-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecial = /[^A-Za-z0-9]/.test(password);
      if (!okLen || !hasLetter || !hasNumber || !hasSpecial) {
        setError('Password must be at least 6 characters and include a letter, a number, and a special character.');
        setIsSubmitting(false);
        return;
      }
    }

    const specs = specializations
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const input = {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      role,
      branch_id: branchId,
      specializations: specs,
      ...(!isEditing && enableLogin ? { password } : {}),
    };

    const result = isEditing
      ? await updateEmployee(employee.id, input)
      : await createEmployee(input);

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">
        {isEditing ? 'Edit Employee' : 'Add Employee'}
      </h2>

      {/* Name */}
      <div className="space-y-1.5">
        <label htmlFor="employee-name" className="text-sm font-medium text-foreground">
          Name
        </label>
        <Input
          id="employee-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Priya Sharma"
          required
        />
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <label htmlFor="employee-phone" className="text-sm font-medium text-foreground">
          Phone
        </label>
        <Input
          id="employee-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g., 9876543210"
          required
        />
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <label htmlFor="employee-email" className="text-sm font-medium text-foreground">
          Email (optional)
        </label>
        <Input
          id="employee-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g., priya@salon.com"
        />
      </div>

      {/* Role */}
      <div className="space-y-1.5">
        <label htmlFor="employee-role" className="text-sm font-medium text-foreground">
          Role
        </label>
        <select
          id="employee-role"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          required
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {/* Branch */}
      <div className="space-y-1.5">
        <label htmlFor="employee-branch" className="text-sm font-medium text-foreground">
          Branch
        </label>
        <select
          id="employee-branch"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          required
        >
          <option value="" disabled>
            Select branch
          </option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Specializations */}
      <div className="space-y-1.5">
        <label htmlFor="employee-specializations" className="text-sm font-medium text-foreground">
          Specializations (comma-separated)
        </label>
        <Input
          id="employee-specializations"
          value={specializations}
          onChange={(e) => setSpecializations(e.target.value)}
          placeholder="e.g., Hair Color, Bridal Makeup, Facials"
        />
      </div>

      {/* Login provisioning — create mode only */}
      {!isEditing && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={enableLogin}
              onChange={(e) => setEnableLogin(e.target.checked)}
              className="size-4 rounded border-input"
            />
            <span className="text-sm font-medium text-foreground">Give this staff member login access</span>
          </label>

          {enableLogin && (
            <div className="space-y-3 pt-1">
              <p className="text-xs text-muted-foreground">
                The staff member logs in with their <strong>mobile number</strong> (entered above) as
                the user ID and the password you set here. Share these with them. Before their first
                login, verify their WhatsApp number from the staff list (Send code - they tell you the
                code - you confirm it).
              </p>
              <div className="space-y-1.5">
                <label htmlFor="employee-password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <Input
                  id="employee-password"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="e.g., Salon@1"
                />
                <p className="text-xs text-muted-foreground">
                  At least 6 characters with a letter, a number, and a special character.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <span className="flex items-center gap-1.5">
              <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </span>
          ) : isEditing ? (
            'Update Employee'
          ) : (
            'Add Employee'
          )}
        </Button>
      </div>
    </form>
  );
}
