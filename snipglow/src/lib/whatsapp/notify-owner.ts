// =============================================================================
// Owner Notification Utility
// Resolves the salon owner's phone from tenants table (primary)
// or employees table (fallback), then sends a WhatsApp text message.
// =============================================================================

import { sendMessage } from './templates';
import type { WhatsAppCredentials } from './config';

/**
 * Normalize a phone number to E.164 digits (no +, no spaces).
 * Handles: 10-digit, 91XXXXXXXXXX, +91XXXXXXXXXX, 0XXXXXXXXXX
 */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.length === 10 && /^[6-9]/.test(digits)) return '91' + digits;
  if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1);
  return digits;
}

/**
 * Get the owner's phone for a tenant.
 * Tries tenants.phone first, then owner employee record.
 */
export async function getOwnerPhone(admin: any, tenantId: string): Promise<string | null> {
  // 1. Try tenants table
  const { data: tenant } = await admin
    .from('tenants')
    .select('phone')
    .eq('id', tenantId)
    .single();

  if (tenant?.phone) {
    const normalized = normalizePhone(tenant.phone);
    if (normalized.length === 12) {
      console.log('[NotifyOwner] Phone from tenants table:', normalized);
      return normalized;
    }
  }

  // 2. Fallback: owner employee record
  const { data: ownerEmp } = await (admin
    .from('employees')
    .select('phone')
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')
    .eq('is_active', true)
    .limit(1)
    .single() as any);

  if (ownerEmp?.phone) {
    const normalized = normalizePhone(ownerEmp.phone);
    if (normalized.length === 12) {
      console.log('[NotifyOwner] Phone from employees table:', normalized);
      return normalized;
    }
  }

  console.warn('[NotifyOwner] No valid owner phone found for tenant:', tenantId);
  return null;
}

/**
 * Send a WhatsApp text notification to the salon owner.
 */
export async function notifyOwner(
  admin: any,
  credentials: WhatsAppCredentials,
  tenantId: string,
  message: string
): Promise<void> {
  const ownerPhone = await getOwnerPhone(admin, tenantId);
  if (!ownerPhone) {
    console.error('[NotifyOwner] FAILED - no phone resolved for tenant:', tenantId);
    return;
  }

  console.log('[NotifyOwner] Attempting to send to:', ownerPhone, 'tenant:', tenantId);

  try {
    const result = await sendMessage(credentials, ownerPhone, {
      type: 'text',
      text: { body: message },
    });

    if (result.success) {
      console.log('[NotifyOwner] SUCCESS - sent to:', ownerPhone);
    } else {
      console.error('[NotifyOwner] FAILED - Meta API error:', result.error, 'phone:', ownerPhone);
    }
  } catch (err) {
    console.error('[NotifyOwner] EXCEPTION:', err, 'phone:', ownerPhone);
  }
}
