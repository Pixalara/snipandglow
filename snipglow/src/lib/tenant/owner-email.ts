// =============================================================================
// Resolve a tenant's real, mailable owner email + salon name.
//
// The `tenants` table has no email column, and phone/WhatsApp signups get a
// synthetic auth login email (…@phone.snipandglow.com), so the real address
// lives on the owner's `employees` record (set at signup / via the admin "Edit
// owner email" action) or on the salon's `settings.email`.
//
// This is intentionally cheap and webhook-safe: two direct indexed queries, no
// auth.users pagination. Best-effort — never throws.
// =============================================================================

import 'server-only';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A real, mailable address (skips synthetic phone/staff login emails). */
export function isRealEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (!EMAIL_RE.test(e)) return false;
  if (e.endsWith('@phone.snipandglow.com')) return false;
  if (e.endsWith('@staff.snipandglow.com')) return false;
  return true;
}

export interface TenantContactInfo {
  /** Real owner email, or null when none is on file. */
  email: string | null;
  /** Salon display name, or null. */
  salonName: string | null;
}

/**
 * Resolve the tenant's owner email + salon name. Resolution order:
 *   1. owner `employees` record (role='owner', oldest) with a real email
 *   2. salon `settings.email`
 * Returns `{ email: null }` when no real email is on file.
 */
export async function getTenantOwnerEmail(admin: any, tenantId: string): Promise<TenantContactInfo> {
  if (!tenantId) return { email: null, salonName: null };

  let salonName: string | null = null;
  let settingsEmail: string | undefined;
  try {
    const { data: t } = await (admin
      .from('tenants')
      .select('name, settings')
      .eq('id', tenantId)
      .single() as any);
    salonName = ((t?.name as string | undefined) ?? '').trim() || null;
    settingsEmail = (t?.settings as Record<string, unknown> | null)?.email as string | undefined;
  } catch {
    // best-effort
  }

  // 1) Owner employee email (oldest owner) — the real address for phone signups.
  try {
    const { data: owners } = await (admin
      .from('employees')
      .select('email, created_at')
      .eq('tenant_id', tenantId)
      .eq('role', 'owner')
      .order('created_at', { ascending: true })
      .limit(5) as any);
    for (const o of ((owners ?? []) as { email: string | null }[])) {
      if (isRealEmail(o.email)) {
        return { email: (o.email as string).toLowerCase().trim(), salonName };
      }
    }
  } catch {
    // best-effort
  }

  // 2) Salon settings contact email.
  if (isRealEmail(settingsEmail)) {
    return { email: settingsEmail!.toLowerCase().trim(), salonName };
  }

  return { email: null, salonName };
}
