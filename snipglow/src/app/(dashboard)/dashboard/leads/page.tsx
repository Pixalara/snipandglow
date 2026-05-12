import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LeadsClient } from './leads-client';
import { Target } from 'lucide-react';
import type { UserRole, Lead, LeadSource, LeadStatus } from '@/types';

// =============================================================================
// Leads Page — Server Component
// =============================================================================

export default async function LeadsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // Only owners and managers can access leads
  if (role !== 'owner' && role !== 'manager') {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-destructive">Access denied. Only owners and managers can view leads.</p>
      </div>
    );
  }

  // Fetch leads (using type assertion since table isn't in generated types)
  const { data: leads, error } = await (supabase as any)
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-transparent border border-indigo-200/50 dark:border-indigo-800/30 p-6">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
              <Target className="size-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Leads</h1>
              <p className="text-sm text-destructive">Failed to load leads</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const rows: Lead[] = (leads ?? []).map((lead: any) => ({
    id: lead.id,
    tenant_id: lead.tenant_id,
    branch_id: lead.branch_id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email ?? null,
    source: (lead.source ?? 'walk_in') as LeadSource,
    status: (lead.status ?? 'new') as LeadStatus,
    notes: lead.notes ?? null,
    interested_services: lead.interested_services ?? [],
    follow_up_date: lead.follow_up_date ?? null,
    assigned_to: lead.assigned_to ?? null,
    converted_customer_id: lead.converted_customer_id ?? null,
    created_at: lead.created_at ?? '',
    updated_at: lead.updated_at ?? '',
  }));

  return <LeadsClient leads={rows} role={role} />;
}
