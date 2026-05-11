import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StaffClient } from './staff-client';
import type { Employee, Branch, UserRole } from '@/types';

// =============================================================================
// Staff Management Page — Server Component (Owner Only)
// =============================================================================

export default async function StaffPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // Only owners can access staff management
  if (role !== 'owner') {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-destructive">Access denied. Only owners can manage staff.</p>
      </div>
    );
  }

  // Fetch all employees (RLS enforces tenant scoping)
  const { data: employees, error: employeesError } = await supabase
    .from('employees')
    .select('*')
    .order('name', { ascending: true });

  if (employeesError) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-destructive">Failed to load employees. Please try again.</p>
      </div>
    );
  }

  // Fetch branches for the branch selector in the form
  const { data: branches, error: branchesError } = await supabase
    .from('branches')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (branchesError) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-destructive">Failed to load branches. Please try again.</p>
      </div>
    );
  }

  return (
    <StaffClient
      employees={(employees ?? []) as Employee[]}
      branches={(branches ?? []) as Branch[]}
      role={role}
    />
  );
}
