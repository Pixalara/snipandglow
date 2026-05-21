import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';

// =============================================================================
// Admin Authorization
// Restricts access to platform owners listed in PLATFORM_ADMIN_EMAILS env.
// =============================================================================

/**
 * Get list of allowed admin emails from environment.
 */
export function getAdminEmails(): string[] {
  const raw = process.env.PLATFORM_ADMIN_EMAILS || '';
  return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

/**
 * Check if an email is a platform admin.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = getAdminEmails();
  return allowed.includes(email.toLowerCase().trim());
}

/**
 * Server-side guard: returns the authenticated admin user OR redirects.
 * Use this at the top of every admin page and action.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/admin/login');
  }

  if (!isAdminEmail(user.email)) {
    redirect('/admin/forbidden');
  }

  return user;
}

/**
 * Server-side check (returns boolean, no redirect).
 */
export async function checkAdmin(): Promise<{ ok: boolean; user: any | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, user: null };
  return { ok: isAdminEmail(user.email), user };
}

/**
 * Log an admin action to the audit log.
 */
export async function logAdminAction(params: {
  adminUserId: string;
  adminEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const admin = createAdminClient();
    await (admin.from('admin_audit_logs' as any).insert({
      admin_user_id: params.adminUserId,
      admin_email: params.adminEmail,
      action: params.action,
      target_type: params.targetType ?? null,
      target_id: params.targetId ?? null,
      metadata: params.metadata ?? {},
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
    } as any) as any);
  } catch (err) {
    console.error('[Admin Audit] Failed to log:', err);
  }
}
