'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { getPlatformCredentials, WA_BASE_URL } from '@/lib/whatsapp/config';
import { toTitleCase } from '@/lib/utils';
import type { ActionResult, Employee, CreateEmployeeInput, UserRole } from '@/types';

// =============================================================================
// Staff login model (phone = user ID, owner-set password)
// -----------------------------------------------------------------------------
// • The staff member's USER ID is their phone number. Internally we map this to
//   a synthetic Supabase auth email (`<digits>@staff.snipandglow.com`) because
//   Supabase password auth requires an email — the staff never sees or types it.
// • The OWNER sets the password and shares it with the staff member.
// • Before first login, the OWNER verifies the staff WhatsApp number by sending
//   a one-time code (from the owner dashboard) and entering what the staff
//   member received. This proves the number is reachable/correct.
// • Owner can reset the password any time. Staff cannot self-reset.
// =============================================================================

/** Normalize an Indian phone to bare 10 digits (the canonical staff user ID). */
function normalizeStaffPhone(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  // Strip 91 country code if present (12-digit 91XXXXXXXXXX).
  const ten = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  if (ten.length !== 10 || !/^[6-9]/.test(ten)) return null;
  return ten;
}

/** Synthetic auth email for a staff phone (never shown to the user). */
function staffAuthEmail(phone10: string): string {
  return `${phone10}@staff.snipandglow.com`;
}

/**
 * Password policy for staff logins: at least 6 chars, including at least one
 * letter, one number, and one special character.
 */
function isValidStaffPassword(pw: string): boolean {
  if (!pw || pw.length < 6) return false;
  if (!/[A-Za-z]/.test(pw)) return false;
  if (!/[0-9]/.test(pw)) return false;
  if (!/[^A-Za-z0-9]/.test(pw)) return false;
  return true;
}

const STAFF_PASSWORD_RULE =
  'Password must be at least 6 characters and include a letter, a number, and a special character.';

// =============================================================================
// Plan-based staff login limits
//   • Essentials (starter): 5 staff logins total
//   • Pro:                  10 staff logins total
//   • Growth (enterprise):  10 staff logins PER BRANCH
// A "staff login" = an employee row with login_method = 'password'.
// =============================================================================
const STAFF_LOGIN_LIMITS = {
  starter: { perTenant: 5 },
  pro: { perTenant: 10 },
  enterprise: { perBranch: 10 },
} as const;

const PLAN_LABEL: Record<string, string> = {
  starter: 'Essentials',
  pro: 'Pro',
  enterprise: 'Growth',
};

async function checkStaffLoginLimit(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  planTier: string,
  branchId: string
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  const plan = (planTier in STAFF_LOGIN_LIMITS ? planTier : 'starter') as keyof typeof STAFF_LOGIN_LIMITS;
  const label = PLAN_LABEL[plan] ?? 'your';

  if (plan === 'enterprise') {
    // 10 per branch.
    const limit = STAFF_LOGIN_LIMITS.enterprise.perBranch;
    const { count } = await ((admin as any)
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('branch_id', branchId)
      .eq('login_method', 'password')
      .eq('is_active', true) as any);
    if ((count ?? 0) >= limit) {
      return {
        allowed: false,
        message: `${label} plan allows up to ${limit} staff logins per branch. This branch has reached its limit.`,
      };
    }
    return { allowed: true };
  }

  // starter / pro — per tenant total.
  const limit = STAFF_LOGIN_LIMITS[plan].perTenant;
  const { count } = await ((admin as any)
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('login_method', 'password')
    .eq('is_active', true) as any);
  if ((count ?? 0) >= limit) {
    return {
      allowed: false,
      message: `${label} plan allows up to ${limit} staff logins. Upgrade your plan to add more team members.`,
    };
  }
  return { allowed: true };
}

/**
 * Create a new employee.
 * Requires owner role (enforced by RLS + UI guard).
 */
export async function createEmployee(input: CreateEmployeeInput): Promise<ActionResult<Employee>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  const role = user.user_metadata?.role;
  if (!tenantId) {
    return { success: false, error: 'No tenant context found.' };
  }
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can manage staff.' };
  }

  // Validate required fields
  if (!input.name?.trim()) {
    return { success: false, error: 'Employee name is required.' };
  }
  if (!input.phone?.trim()) {
    return { success: false, error: 'Phone number is required.' };
  }
  if (!input.role) {
    return { success: false, error: 'Role is required.' };
  }
  if (!input.branch_id) {
    return { success: false, error: 'Branch assignment is required.' };
  }

  const admin = createAdminClient();

  // ── Staff login provisioning ──────────────────────────────────────────────
  // When the owner provides a password, we create a Supabase auth account whose
  // login id maps to the staff phone (via a synthetic email). The staff member
  // logs in with their PHONE NUMBER + this password. The account is gated: the
  // owner must verify the WhatsApp number before the staff member can sign in.
  const wantsLogin = !!input.password;
  let authUserId: string | null = null;
  const phone10 = normalizeStaffPhone(input.phone);

  if (wantsLogin) {
    if (!phone10) {
      return { success: false, error: 'Enter a valid 10-digit mobile number — it is the staff login ID.' };
    }
    if (!isValidStaffPassword(input.password!)) {
      return { success: false, error: STAFF_PASSWORD_RULE };
    }

    // ── Plan-based staff login limit ─────────────────────────────────────────
    // Essentials (starter): 5 total · Pro: 10 total · Growth (enterprise): 10 per branch.
    const { data: tenantRow } = await (admin
      .from('tenants')
      .select('plan_tier')
      .eq('id', tenantId)
      .single() as any);
    const planTier = (tenantRow?.plan_tier as string) || 'starter';

    const limitResult = await checkStaffLoginLimit(admin, tenantId, planTier, input.branch_id);
    if (!limitResult.allowed) {
      return { success: false, error: limitResult.message };
    }

    const loginEmail = staffAuthEmail(phone10);

    // Reject if this phone already has a staff login account.
    const { data: existingList } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const clash = existingList?.users?.find((u: any) => (u.email || '').toLowerCase() === loginEmail);
    if (clash) {
      return { success: false, error: 'A staff login already exists for this phone number.' };
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: loginEmail,
      password: input.password,
      email_confirm: true, // synthetic email; login gated via verification flag
      user_metadata: {
        name: toTitleCase(input.name),
        phone: phone10,
        tenant_id: tenantId,
        branch_id: input.branch_id,
        role: input.role,
        signup_method: 'staff_password',
      },
    });

    if (createErr || !created?.user) {
      console.error('Staff auth account creation error:', createErr);
      return { success: false, error: 'Failed to create staff login. Please try again.' };
    }
    authUserId = created.user.id;
  }

  const { data, error } = await admin
    .from('employees')
    .insert({
      tenant_id: tenantId,
      branch_id: input.branch_id,
      auth_user_id: authUserId,
      name: toTitleCase(input.name),
      phone: phone10 ?? input.phone.trim(),
      email: input.email?.trim().toLowerCase() || null,
      role: input.role,
      specializations: input.specializations ?? [],
      is_active: true,
      login_method: wantsLogin ? 'password' : 'otp',
      // Password staff start UNVERIFIED — owner verifies WhatsApp before login.
      // Email verification is no longer used; force it true so it never gates.
      email_verified_by_owner: true,
      phone_verified_by_owner: !wantsLogin,
    } as any)
    .select()
    .single();

  if (error) {
    console.error('Employee creation error:', error);
    if (authUserId) {
      await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    }
    return { success: false, error: 'Failed to create employee. Please try again.' };
  }

  revalidatePath('/dashboard/staff');
  return { success: true, data: data as Employee };
}

/**
 * Owner sends a one-time WhatsApp verification code to a staff member's number.
 * The owner then enters what the staff received (confirmStaffWhatsApp) to verify.
 * Requires owner role.
 */
export async function sendStaffWhatsAppCode(employeeId: string): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  if (user.user_metadata?.role !== 'owner') {
    return { success: false, error: 'Only owners can verify staff.' };
  }

  const admin = createAdminClient();
  const { data: emp } = await (admin
    .from('employees')
    .select('id, phone, login_method')
    .eq('id', employeeId)
    .eq('tenant_id', tenantId)
    .single() as any);

  if (!emp) return { success: false, error: 'Staff member not found.' };
  const phone10 = normalizeStaffPhone(emp.phone);
  if (!phone10) return { success: false, error: 'Staff has an invalid phone number.' };

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Reuse the otp_codes table (keyed by phone) for the staff verification code.
  await (admin.from('otp_codes').delete().eq('phone', `staff:${phone10}`) as any);
  const { error: insErr } = await (admin.from('otp_codes').insert({
    phone: `staff:${phone10}`,
    code,
    expires_at: expiresAt,
  } as any) as any);
  if (insErr) {
    console.error('[StaffVerify] code insert failed:', insErr.message);
    return { success: false, error: 'Could not generate code. Please try again.' };
  }

  // Send the code to the staff member's WhatsApp via the approved OTP template.
  const credentials = getPlatformCredentials();
  if (credentials) {
    try {
      await fetch(`${WA_BASE_URL}/${credentials.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: `91${phone10}`,
          type: 'template',
          template: {
            name: 'otp_verification',
            language: { code: 'en_US' },
            components: [
              { type: 'body', parameters: [{ type: 'text', text: code }, { type: 'text', text: 'Verification' }] },
              { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
            ],
          },
        }),
      });
    } catch (waErr) {
      console.error('[StaffVerify] WhatsApp send error:', waErr);
      return { success: false, error: 'Could not send WhatsApp code. Please try again.' };
    }
  } else {
    console.log(`[StaffVerify] WhatsApp not configured. Code for ${phone10}: ${code}`);
  }

  return { success: true, data: undefined };
}

/**
 * Owner confirms the WhatsApp code the staff member received. On success the
 * staff member's phone is verified and they may log in. Requires owner role.
 */
export async function confirmStaffWhatsApp(
  employeeId: string,
  code: string
): Promise<ActionResult<void>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  if (user.user_metadata?.role !== 'owner') {
    return { success: false, error: 'Only owners can verify staff.' };
  }

  const admin = createAdminClient();
  const { data: emp } = await (admin
    .from('employees')
    .select('id, name, phone, role')
    .eq('id', employeeId)
    .eq('tenant_id', tenantId)
    .single() as any);
  if (!emp) return { success: false, error: 'Staff member not found.' };

  const phone10 = normalizeStaffPhone(emp.phone);
  if (!phone10) return { success: false, error: 'Staff has an invalid phone number.' };

  const { data: codeRow } = await (admin
    .from('otp_codes')
    .select('id, code, expires_at')
    .eq('phone', `staff:${phone10}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle() as any);

  if (!codeRow) return { success: false, error: 'No code found. Send a new code first.' };
  if (new Date(codeRow.expires_at) < new Date()) {
    await (admin.from('otp_codes').delete().eq('id', codeRow.id) as any);
    return { success: false, error: 'Code expired. Send a new code.' };
  }
  if (String(codeRow.code) !== String(code).trim()) {
    return { success: false, error: 'Incorrect code. Please re-check with your staff.' };
  }

  await (admin.from('otp_codes').delete().eq('id', codeRow.id) as any);
  await (admin
    .from('employees')
    .update({ phone_verified_by_owner: true } as any)
    .eq('id', employeeId)
    .eq('tenant_id', tenantId) as any);

  // ── Send login instructions to the staff member's WhatsApp ────────────────
  // Best-effort; never blocks verification. Includes their role + salon name.
  try {
    const { data: tenant } = await (admin
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single() as any);
    const salonName = ((tenant?.name as string) || 'the salon').trim();
    const roleLabel = String(emp.role || 'staff');
    await sendStaffWelcomeMessage(phone10, emp.name || 'there', salonName, roleLabel);
  } catch (welcomeErr) {
    console.error('[StaffVerify] welcome message failed (non-fatal):', welcomeErr);
  }

  revalidatePath('/dashboard/staff');
  return { success: true, data: undefined };
}

/**
 * Send the staff member their login instructions over WhatsApp once verified.
 * Tries the approved `staff_welcome_v2` template first (works outside the
 * 24-hour window); falls back to a free-form text message. Best-effort.
 *
 * Template `staff_welcome_v2` body params (in order):
 *   {{1}} staff name   {{2}} salon name   {{3}} role   {{4}} login number (phone)
 * The template also has a static "Open Dashboard" URL button (no param).
 */
async function sendStaffWelcomeMessage(
  phone10: string,
  staffName: string,
  salonName: string,
  roleLabel: string
): Promise<void> {
  const credentials = getPlatformCredentials();
  if (!credentials) return;
  const to = `91${phone10}`;

  const templateRes = await fetch(`${WA_BASE_URL}/${credentials.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: 'staff_welcome_v2',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: staffName },
              { type: 'text', text: salonName },
              { type: 'text', text: roleLabel },
              { type: 'text', text: phone10 },
            ],
          },
        ],
      },
    }),
  });

  if (templateRes.ok) return;

  // Fallback: free-form text (delivers only if a 24-hour session is open).
  // Wording mirrors the approved utility template (no "login/password" terms).
  const body =
    `Hi ${staffName}, your team account at *${salonName}* is ready. ` +
    `You've been added as *${roleLabel}* on SnipandGlow.\n\n` +
    `Open the dashboard: https://www.snipandglow.com/login\n` +
    `Use your mobile number *${phone10}* to access it. ` +
    `Your salon owner will share your access details with you.`;

  await fetch(`${WA_BASE_URL}/${credentials.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body, preview_url: false },
    }),
  });
}

/**
 * Owner resets a staff member's login password. Owner-only; staff cannot
 * self-reset. Enforces the staff password policy.
 */
export async function resetEmployeePassword(
  employeeId: string,
  newPassword: string
): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const tenantId = user.user_metadata?.tenant_id;
  if (user.user_metadata?.role !== 'owner') {
    return { success: false, error: 'Only owners can reset staff passwords.' };
  }
  if (!isValidStaffPassword(newPassword)) {
    return { success: false, error: STAFF_PASSWORD_RULE };
  }

  const admin = createAdminClient();
  const { data: emp } = await (admin
    .from('employees')
    .select('auth_user_id, login_method')
    .eq('id', employeeId)
    .eq('tenant_id', tenantId)
    .single() as any);

  if (!emp?.auth_user_id || emp.login_method !== 'password') {
    return { success: false, error: 'This staff member does not have a password login.' };
  }

  const { error } = await admin.auth.admin.updateUserById(emp.auth_user_id, {
    password: newPassword,
  });

  if (error) {
    return { success: false, error: 'Failed to reset password. Please try again.' };
  }

  revalidatePath('/dashboard/staff');
  return { success: true, data: undefined };
}

/**
 * Update an existing employee.
 * Requires owner role (enforced by RLS + UI guard).
 */
export async function updateEmployee(
  id: string,
  input: Partial<CreateEmployeeInput>
): Promise<ActionResult<Employee>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const role = user.user_metadata?.role;
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can manage staff.' };
  }

  // Validate fields if provided
  if (input.name !== undefined && !input.name.trim()) {
    return { success: false, error: 'Employee name cannot be empty.' };
  }
  if (input.phone !== undefined && !input.phone.trim()) {
    return { success: false, error: 'Phone number cannot be empty.' };
  }

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = toTitleCase(input.name);
  if (input.phone !== undefined) updateData.phone = input.phone.trim();
  if (input.email !== undefined) updateData.email = input.email?.trim() || null;
  if (input.role !== undefined) updateData.role = input.role;
  if (input.branch_id !== undefined) updateData.branch_id = input.branch_id;
  if (input.specializations !== undefined) updateData.specializations = input.specializations;

  const { data, error } = await supabase
    .from('employees')
    .update(updateData as any)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return { success: false, error: 'Failed to update employee. Please try again.' };
  }

  revalidatePath('/staff');
  return { success: true, data: data as Employee };
}

/**
 * Deactivate an employee by setting is_active = false.
 * This revokes their login access without deleting the record.
 */
export async function deactivateEmployee(id: string): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const role = user.user_metadata?.role;
  if (role !== 'owner') {
    return { success: false, error: 'Only owners can deactivate staff.' };
  }

  const { error } = await supabase
    .from('employees')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    return { success: false, error: 'Failed to deactivate employee. Please try again.' };
  }

  revalidatePath('/staff');
  return { success: true, data: undefined };
}

/**
 * Change an employee's role.
 * Requires owner role. Cannot change own role.
 */
export async function changeEmployeeRole(
  employeeId: string,
  newRole: UserRole
): Promise<ActionResult<void>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const currentRole = user.user_metadata?.role;
  if (currentRole !== 'owner') {
    return { success: false, error: 'Only owners can change employee roles.' };
  }

  // Validate role
  const validRoles: UserRole[] = ['owner', 'manager', 'staff'];
  if (!validRoles.includes(newRole)) {
    return { success: false, error: 'Invalid role specified.' };
  }

  // Prevent changing own role
  const { data: employee } = await supabase
    .from('employees')
    .select('auth_user_id')
    .eq('id', employeeId)
    .single();

  if (employee?.auth_user_id === user.id) {
    return { success: false, error: 'You cannot change your own role.' };
  }

  const { error } = await supabase
    .from('employees')
    .update({ role: newRole })
    .eq('id', employeeId);

  if (error) {
    return { success: false, error: 'Failed to change role. Please try again.' };
  }

  revalidatePath('/dashboard/staff');
  return { success: true, data: undefined };
}

// =============================================================================
// Staff Performance Metrics
// =============================================================================

export interface StaffPerformance {
  employeeId: string;
  name: string;
  role: UserRole;
  customersServed: number;   // distinct customers billed
  servicesCount: number;     // total billed line items / appointments
  revenue: number;           // total billed amount attributed to this staff
  avgTicket: number;         // revenue / servicesCount
}

export interface StaffPerformanceResult {
  staff: StaffPerformance[];
  totals: { revenue: number; customers: number; services: number };
  unattributed: { revenue: number; services: number };
  rangeDays: number;
}

/**
 * Compute per-staff performance for the current tenant over the last `days`.
 * Attributes each completed invoice to the staff member on its linked
 * appointment (employee_id). Owner-only.
 */
export async function getStaffPerformance(days: number = 30): Promise<StaffPerformanceResult> {
  const empty: StaffPerformanceResult = { staff: [], totals: { revenue: 0, customers: 0, services: 0 }, unattributed: { revenue: 0, services: 0 }, rangeDays: days };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty;

  const tenantId = user.user_metadata?.tenant_id;
  if (!tenantId || user.user_metadata?.role !== 'owner') return empty;

  const admin = createAdminClient();

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  // Active employees (the people we attribute to).
  const { data: emps } = await (admin
    .from('employees')
    .select('id, name, role, is_active')
    .eq('tenant_id', tenantId) as any);

  const empMap = new Map<string, { name: string; role: UserRole }>();
  for (const e of emps ?? []) empMap.set(e.id, { name: e.name, role: e.role });

  // Invoices in range, joined to their appointment's employee_id.
  // Exclude wallet top-ups — they are prepaid deposits, not service revenue.
  const { data: invoices } = await (admin as any)
    .from('invoices')
    .select('id, total, customer_id, created_at, appointment_id')
    .eq('tenant_id', tenantId)
    .neq('invoice_type', 'wallet_recharge')
    .gte('created_at', sinceIso);

  const apptIds = [...new Set((invoices ?? []).map((i: any) => i.appointment_id).filter(Boolean))] as string[];
  const apptEmpMap = new Map<string, string>();
  if (apptIds.length > 0) {
    const { data: appts } = await (admin
      .from('appointments')
      .select('id, employee_id')
      .in('id', apptIds) as any);
    for (const a of appts ?? []) if (a.employee_id) apptEmpMap.set(a.id, a.employee_id);
  }

  // Aggregate per employee.
  const agg = new Map<string, { revenue: number; services: number; customers: Set<string> }>();
  let totalRevenue = 0;
  const totalCustomers = new Set<string>();
  let totalServices = 0;
  // Invoices with no resolvable staff (no appointment link, or appointment has
  // no employee_id, or that employee no longer exists) so totals reconcile.
  let unattributedRevenue = 0;
  let unattributedServices = 0;

  for (const inv of invoices ?? []) {
    const amount = Number(inv.total) || 0;
    totalRevenue += amount;
    totalServices += 1;
    if (inv.customer_id) totalCustomers.add(inv.customer_id);

    const empId = inv.appointment_id ? apptEmpMap.get(inv.appointment_id) : null;
    if (!empId || !empMap.has(empId)) {
      unattributedRevenue += amount;
      unattributedServices += 1;
      continue;
    }
    const bucket = agg.get(empId) ?? { revenue: 0, services: 0, customers: new Set<string>() };
    bucket.revenue += amount;
    bucket.services += 1;
    if (inv.customer_id) bucket.customers.add(inv.customer_id);
    agg.set(empId, bucket);
  }

  const staff: StaffPerformance[] = [...agg.entries()].map(([empId, b]) => {
    const meta = empMap.get(empId)!;
    return {
      employeeId: empId,
      name: meta.name,
      role: meta.role,
      customersServed: b.customers.size,
      servicesCount: b.services,
      revenue: b.revenue,
      avgTicket: b.services > 0 ? Math.round(b.revenue / b.services) : 0,
    };
  });

  // Highest revenue first.
  staff.sort((a, b) => b.revenue - a.revenue);

  return {
    staff,
    totals: { revenue: totalRevenue, customers: totalCustomers.size, services: totalServices },
    unattributed: { revenue: unattributedRevenue, services: unattributedServices },
    rangeDays: days,
  };
}
