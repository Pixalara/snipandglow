// =============================================================================
// Union Types / Enums
// =============================================================================

/** Appointment lifecycle states */
export type AppointmentStatus = 'booked' | 'confirmed' | 'completed' | 'cancelled';

/** Payment method options (Indian market) */
export type PaymentMethod = 'cash' | 'upi' | 'card';

/** Invoice payment status */
export type PaymentStatus = 'paid' | 'partial' | 'pending';

/** WhatsApp message delivery status */
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/** Customer membership lifecycle */
export type MembershipStatus = 'active' | 'expired';

/** Tenant subscription lifecycle */
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'expired' | 'cancelled';

/** Employee roles within a tenant */
export type UserRole = 'owner' | 'manager' | 'staff';

/** SaaS subscription tiers */
export type PlanTier = 'starter' | 'pro' | 'enterprise';

/** Source of appointment creation */
export type AppointmentSource = 'dashboard' | 'whatsapp_flow';

/** WhatsApp message direction */
export type WhatsAppDirection = 'inbound' | 'outbound';

// =============================================================================
// Database Table Interfaces
// =============================================================================

/** Tenant settings stored as JSONB */
export interface TenantSettings {
  gst_enabled?: boolean;
  gst_rate?: number;
  logo_url?: string;
  [key: string]: unknown;
}

/** Top-level isolation boundary — a salon business entity */
export interface Tenant {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  subscription_status: SubscriptionStatus;
  razorpay_subscription_id: string | null;
  razorpay_customer_id: string | null;
  subscription_start: string;
  subscription_end: string;
  plan_tier: PlanTier;
  settings: TenantSettings;
  created_at: string;
}

/** Branch operating hours stored as JSONB */
export interface OperatingHours {
  [day: string]: { open: string; close: string } | undefined;
}

/** A physical salon location belonging to a Tenant */
export interface Branch {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  operating_hours: OperatingHours;
  is_default: boolean;
  is_active: boolean;
  invoice_counter: number;
  created_at: string;
}

/** A staff member working at a Branch */
export interface Employee {
  id: string;
  tenant_id: string;
  branch_id: string;
  auth_user_id: string;
  name: string;
  phone: string;
  email: string | null;
  role: UserRole;
  specializations: string[];
  is_active: boolean;
  created_at: string;
}

/** A person who visits a Branch for services */
export interface Customer {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  phone: string;
  email: string | null;
  gender: string | null;
  notes: string | null;
  total_visits: number;
  total_spent: number;
  last_visit_at: string | null;
  created_at: string;
}

/** A salon offering with category, duration, and price */
export interface Service {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  category: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  created_at: string;
}

/** A scheduled booking linking Customer, Service, and Employee */
export interface Appointment {
  id: string;
  tenant_id: string;
  branch_id: string;
  customer_id: string;
  service_id: string;
  employee_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  whatsapp_flow_ref: string | null;
  created_at: string;
}

/** A billing document for services rendered */
export interface Invoice {
  id: string;
  tenant_id: string;
  branch_id: string;
  customer_id: string;
  appointment_id: string | null;
  invoice_number: string;
  subtotal: number;
  discount_amount: number;
  discount_pct: number;
  gst_amount: number;
  gst_rate: number;
  total: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  delivery_status: DeliveryStatus;
  pdf_storage_path: string | null;
  created_at: string;
}

/** A line item within an Invoice */
export interface InvoiceItem {
  id: string;
  invoice_id: string;
  service_id: string;
  service_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

/** A subscription plan offered by a Tenant */
export interface Membership {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  description: string | null;
  price: number;
  validity_days: number;
  discount_pct: number;
  is_active: boolean;
  created_at: string;
}

/** A customer's active or expired membership instance */
export interface CustomerMembership {
  id: string;
  customer_id: string;
  membership_id: string;
  tenant_id: string;
  branch_id: string;
  start_date: string;
  end_date: string;
  status: MembershipStatus;
  created_at: string;
}

/** WhatsApp message session metadata stored as JSONB */
export interface WhatsAppMetadata {
  template_params?: string[];
  media_url?: string;
  [key: string]: unknown;
}

/** A tracked WhatsApp message session */
export interface WhatsAppSession {
  id: string;
  tenant_id: string;
  branch_id: string;
  message_id: string;
  phone: string;
  template_name: string | null;
  direction: WhatsAppDirection;
  status: DeliveryStatus;
  error_details: string | null;
  metadata: WhatsAppMetadata;
  created_at: string;
}

/** A timestamped record of a user action for compliance */
export interface AuditLog {
  id: string;
  tenant_id: string;
  branch_id: string;
  actor_id: string;
  actor_name: string;
  action_type: string;
  resource_type: string;
  resource_id: string;
  description: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

/** Top services entry in analytics snapshot JSONB */
export interface TopServiceEntry {
  name: string;
  category: string;
  total_revenue: number;
  times_booked: number;
}

/** A pre-aggregated daily summary of business metrics */
export interface AnalyticsSnapshot {
  id: string;
  tenant_id: string;
  branch_id: string;
  snapshot_date: string;
  revenue: number;
  appointment_count: number;
  new_customers: number;
  retention_rate: number;
  active_memberships: number;
  top_services: TopServiceEntry[];
  created_at: string;
}

// =============================================================================
// Expense & Payroll Types
// =============================================================================

/** Expense category options */
export type ExpenseCategory = 'rent' | 'supplies' | 'utilities' | 'marketing' | 'maintenance' | 'other';

/** Expense payment method options */
export type ExpensePaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer';

/** Payroll payment status */
export type PayrollPaymentStatus = 'pending' | 'paid';

/** A tracked business expense (excluding salaries) */
export interface Expense {
  id: string;
  tenant_id: string;
  branch_id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date: string;
  payment_method: ExpensePaymentMethod;
  receipt_note: string | null;
  created_by: string | null;
  created_at: string;
}

/** A payroll record for an employee in a given month */
export interface Payroll {
  id: string;
  tenant_id: string;
  branch_id: string;
  employee_id: string;
  month: string; // '2026-05' format
  base_salary: number;
  bonus: number;
  deductions: number;
  net_salary: number;
  payment_status: PayrollPaymentStatus;
  paid_date: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

/** Input for creating an expense */
export interface CreateExpenseInput {
  category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date: string;
  payment_method: ExpensePaymentMethod;
  receipt_note?: string;
}

/** Input for updating an expense */
export interface UpdateExpenseInput {
  category?: ExpenseCategory;
  description?: string;
  amount?: number;
  expense_date?: string;
  payment_method?: ExpensePaymentMethod;
  receipt_note?: string | null;
}

/** Input for creating/updating a payroll record */
export interface UpsertPayrollInput {
  employee_id: string;
  month: string;
  base_salary: number;
  bonus?: number;
  deductions?: number;
  payment_method?: string;
  notes?: string;
}

/** Input for marking payroll as paid */
export interface MarkPayrollPaidInput {
  payroll_id: string;
  payment_method: string;
  paid_date: string;
}

// =============================================================================
// Lead Management Types
// =============================================================================

/** Lead status lifecycle */
export type LeadStatus = 'new' | 'contacted' | 'interested' | 'not_interested' | 'converted';

/** Lead acquisition source */
export type LeadSource = 'walk_in' | 'social_media' | 'referral' | 'website' | 'whatsapp' | 'other';

/** A potential customer who hasn't booked yet */
export interface Lead {
  id: string;
  tenant_id: string;
  branch_id: string;
  name: string;
  phone: string;
  email: string | null;
  source: LeadSource;
  status: LeadStatus;
  notes: string | null;
  interested_services: string[];
  follow_up_date: string | null;
  assigned_to: string | null;
  converted_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Input for creating a lead */
export interface CreateLeadInput {
  name: string;
  phone: string;
  email?: string;
  source: LeadSource;
  notes?: string;
  interested_services?: string[];
  follow_up_date?: string;
  assigned_to?: string;
}

/** Input for updating a lead */
export interface UpdateLeadInput {
  name?: string;
  phone?: string;
  email?: string | null;
  source?: LeadSource;
  status?: LeadStatus;
  notes?: string | null;
  interested_services?: string[];
  follow_up_date?: string | null;
  assigned_to?: string | null;
}

// =============================================================================
// Server Action Response Type
// =============================================================================

/** Generic result type for Server Action responses */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// =============================================================================
// API Request/Response Payload Types (Edge Functions & Server Actions)
// =============================================================================

/** Input for creating an appointment via dashboard or WhatsApp Flow */
export interface CreateAppointmentInput {
  customer_id: string;
  service_id: string;
  extra_service_ids?: string[];
  employee_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  source?: AppointmentSource;
  whatsapp_flow_ref?: string;
}

/** Input for creating an invoice from POS */
export interface CreateInvoiceInput {
  customer_id: string;
  appointment_id?: string;
  items: CreateInvoiceItemInput[];
  payment_method: PaymentMethod;
  discount_pct?: number;
  gst_rate?: number;
}

/** Input for a single invoice line item */
export interface CreateInvoiceItemInput {
  service_id: string;
  service_name: string;
  unit_price: number;
  quantity: number;
}

/** Input for creating a customer */
export interface CreateCustomerInput {
  name: string;
  phone: string;
  email?: string;
  gender?: string;
  notes?: string;
}

/** Input for updating a customer */
export interface UpdateCustomerInput {
  name?: string;
  phone?: string;
  email?: string | null;
  gender?: string | null;
  notes?: string | null;
}

/** Input for creating a service */
export interface CreateServiceInput {
  name: string;
  category: string;
  duration_minutes: number;
  price: number;
}

/** Input for updating a service */
export interface UpdateServiceInput {
  name?: string;
  category?: string;
  duration_minutes?: number;
  price?: number;
  is_active?: boolean;
}

/** Input for creating an employee */
export interface CreateEmployeeInput {
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  branch_id: string;
  specializations?: string[];
}

/** Input for creating a branch */
export interface CreateBranchInput {
  name: string;
  address?: string;
  phone?: string;
  operating_hours?: OperatingHours;
}

/** Input for creating a membership plan */
export interface CreateMembershipInput {
  name: string;
  description?: string;
  price: number;
  validity_days: number;
  discount_pct: number;
}

/** Input for assigning a membership to a customer */
export interface AssignMembershipInput {
  customer_id: string;
  membership_id: string;
}

/** Input for sending a WhatsApp OTP */
export interface SendOtpInput {
  phone: string;
}

/** Response from sending a WhatsApp OTP */
export interface SendOtpResponse {
  success: boolean;
  message: string;
}

/** Input for verifying a WhatsApp OTP */
export interface VerifyOtpInput {
  phone: string;
  code: string;
}

/** Response from verifying a WhatsApp OTP */
export interface VerifyOtpResponse {
  success: boolean;
  token?: string;
  error?: string;
}

/** Available time slot returned by slot availability query */
export interface TimeSlot {
  slot_start: string;
  slot_end: string;
}

/** Input for sending an invoice via WhatsApp */
export interface SendInvoiceInput {
  invoice_id: string;
}

/** Razorpay webhook event payload */
export interface RazorpayWebhookPayload {
  event: string;
  payload: {
    subscription: {
      entity: {
        id: string;
        customer_id: string;
        status: string;
        current_start: number;
        current_end: number;
      };
    };
  };
}
