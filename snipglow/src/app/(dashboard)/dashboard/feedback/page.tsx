import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FeedbackClient, type FeedbackRow } from './feedback-client';
import type { UserRole } from '@/types';

export default async function FeedbackPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const role = (user.user_metadata?.role as UserRole) ?? 'staff';
  const tenantId = user.user_metadata?.tenant_id;
  const branchId = user.user_metadata?.branch_id;

  if (!tenantId || !branchId) redirect('/onboarding');

  const admin = createAdminClient();

  // Fetch feedback records (only needed columns)
  const { data: feedbackRecords } = await (admin
    .from('feedback' as any)
    .select('id, customer_name, customer_phone, rating, comment, source, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100) as any);

  const rows: FeedbackRow[] = (feedbackRecords ?? []).map((rec: any) => ({
    id: rec.id,
    customer_name: rec.customer_name || 'Anonymous',
    customer_phone: rec.customer_phone || '',
    rating: rec.rating,
    comment: rec.comment || '',
    source: rec.source || 'whatsapp',
    created_at: rec.created_at,
  }));

  return <FeedbackClient feedbackRecords={rows} role={role} />;
}
