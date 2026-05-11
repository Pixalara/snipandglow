import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatINR } from '@/lib/utils';
import { RoleGuard } from '@/components/role-guard';
import { ServicesClient } from './services-client';
import type { Service, UserRole } from '@/types';

// =============================================================================
// Services Management Page — Server Component
// =============================================================================

/** Group services by category for display */
function groupByCategory(services: Service[]): Record<string, Service[]> {
  return services.reduce<Record<string, Service[]>>((groups, service) => {
    const cat = service.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(service);
    return groups;
  }, {});
}

export default async function ServicesPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';

  // Fetch active services (RLS enforces tenant/branch scoping)
  const { data: services, error } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12">
        <p className="text-sm text-destructive">Failed to load services. Please try again.</p>
      </div>
    );
  }

  const grouped = groupByCategory((services ?? []) as Service[]);

  return (
    <ServicesClient
      grouped={grouped}
      role={role}
    />
  );
}
