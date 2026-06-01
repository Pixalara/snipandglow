'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export interface Notification {
  id: string;
  type: 'new_booking' | 'reschedule' | 'cancel' | 'feedback';
  title: string;
  body: string;
  customer_name: string | null;
  customer_phone: string | null;
  appointment_id: string | null;
  is_read: boolean;
  created_at: string;
}

/**
 * Create a notification for a tenant (called from webhook/flow).
 */
export async function createNotification(
  tenantId: string,
  type: Notification['type'],
  title: string,
  body: string,
  extra?: { customer_name?: string; customer_phone?: string; appointment_id?: string }
): Promise<void> {
  const admin = createAdminClient();
  await (admin.from('notifications' as any).insert({
    tenant_id: tenantId,
    type,
    title,
    body,
    customer_name: extra?.customer_name || null,
    customer_phone: extra?.customer_phone || null,
    appointment_id: extra?.appointment_id || null,
  }) as any);
}

/**
 * Fetch recent notifications for the current tenant.
 */
export async function getNotifications(): Promise<Notification[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) return [];

  const admin = createAdminClient();
  const { data } = await (admin
    .from('notifications' as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(30) as any);

  return (data ?? []) as Notification[];
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(id: string): Promise<void> {
  const admin = createAdminClient();
  await (admin.from('notifications' as any).update({ is_read: true }).eq('id', id) as any);
}

/**
 * Mark all notifications as read for the current tenant.
 */
export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId) return;

  const admin = createAdminClient();
  await (admin
    .from('notifications' as any)
    .update({ is_read: true })
    .eq('tenant_id', tenantId)
    .eq('is_read', false) as any);
}
