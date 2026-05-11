// Snip & Glow — TypeScript Interfaces
// All shared types for the application

import type { Timestamp } from 'firebase/firestore';

// ─── Branch ─────────────────────────────────────────────────────────────────

export interface Branch {
  id?: string;
  name: string;
  address?: string;
  phone?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Timestamp;
}

// ─── Salon (was Gym) ─────────────────────────────────────────────────────────

export interface Gym {
  id?: string;
  name: string;
  ownerName: string;
  phone: string;
  watiApiKey: string;
  watiApiEndpoint: string;
  createdAt: Timestamp;
  isActive: boolean;
  walletBalance?: number;
  role?: UserRole;
  adminGymId?: string;
  isMultiBranch?: boolean;
  activeBranchId?: string;
  isWhatsAppVerified?: boolean;
  logoUrl?: string;
  plan?: 'trial' | 'starter' | 'pro';
  planStartDate?: Timestamp;
  planEndDate?: Timestamp;
}

// ─── RBAC ───────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'branch_manager' | 'stylist' | 'sales_executive' | 'receptionist';

export interface Employee {
  id?: string;
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  assignedBranches?: string[];
  isActive: boolean;
  createdAt: Timestamp;
}

// ─── Wallet ─────────────────────────────────────────────────────────────────

export interface WalletTransaction {
  id?: string;
  type: 'topup' | 'debit';
  amount: number;
  description: string;
  balanceAfter: number;
  createdAt: Timestamp;
}

// ─── Broadcast ──────────────────────────────────────────────────────────────

export type BroadcastTargetGroup = 'all' | 'active' | 'inactive';
export type BroadcastStatus = 'draft' | 'sending' | 'completed' | 'failed';

export interface Broadcast {
  id?: string;
  message: string;
  targetGroup: BroadcastTargetGroup;
  totalTargeted: number;
  totalSent: number;
  totalFailed: number;
  totalCost: number;
  status: BroadcastStatus;
  createdAt: Timestamp;
}

// ─── Client (was Member) ─────────────────────────────────────────────────────

export type MemberStatus = 'active' | 'expired' | 'expiring_soon' | 'inactive';

export interface Member {
  id?: string;
  name: string;
  phone: string;
  planId: string;
  planName: string;
  startDate: Timestamp;
  endDate: Timestamp;
  lastVisitDate: Timestamp | null;
  status: MemberStatus;
  endDateUnix: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Service Package (was Plan) ──────────────────────────────────────────────

export interface Plan {
  id?: string;
  name: string;
  durationDays: number;
  price: number;
  isActive: boolean;
  createdAt: Timestamp;
}

// ─── Automation Log ─────────────────────────────────────────────────────────

export type AutomationEventType =
  | 'expiry_reminder_d3'
  | 'expiry_alert_d0'
  | 'expiry_followup_d2'
  | 'inactivity_d5'
  | 'inactivity_d10';

export type MessageStatus = 'sent' | 'failed' | 'skipped';

export interface AutomationLog {
  id?: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  eventType: AutomationEventType;
  messageStatus: MessageStatus;
  errorMessage?: string;
  templateName: string;
  timestamp: Timestamp;
}

// ─── Campaign ───────────────────────────────────────────────────────────────

export type CampaignTargetGroup = 'all' | 'active' | 'expired' | 'expiring_soon';
export type CampaignStatus = 'draft' | 'running' | 'completed' | 'failed';

export interface Campaign {
  id?: string;
  name: string;
  templateName: string;
  targetGroup: CampaignTargetGroup;
  status: CampaignStatus;
  totalTargeted: number;
  totalSent: number;
  totalFailed: number;
  scheduledAt: Timestamp | null;
  completedAt: Timestamp | null;
  createdAt: Timestamp;
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  uid: string;
  phoneNumber: string | null;
  email: string | null;
  photoURL: string | null;
  displayName: string | null;
}

// ─── Onboarding Form ────────────────────────────────────────────────────────

export interface GymRegistrationForm {
  salonName: string;
  ownerName: string;
}

// ─── Billing ────────────────────────────────────────────────────────────────

export type PaymentStatus = 'paid' | 'partial' | 'pending' | 'overdue';

export type PaymentMode = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other';

export interface Payment {
  id: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  planId: string;
  planName: string;
  planDurationDays: number;
  invoiceNumber: string;
  invoiceDate: Timestamp;
  dueDate: Timestamp;
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  paymentMode: PaymentMode;
  upiTransactionId?: string;
  status: PaymentStatus;
  membershipStartDate: Timestamp;
  membershipEndDate: Timestamp;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BillingSettings {
  gymName: string;
  gymAddress: string;
  gymPhone: string;
  gstin?: string;
  hsnCode: string;
  gstRate: number;
  invoicePrefix: string;
  invoiceCounter: number;
  sendInvoiceOnWhatsApp: boolean;
}

export interface BillingStats {
  totalCollectedThisMonth: number;
  totalCollectedThisYear: number;
  pendingDues: number;
  overdueCount: number;
  paidCountThisMonth: number;
}

export interface CreatePaymentInput {
  memberId: string;
  planId: string;
  subtotal: number;
  paidAmount: number;
  paymentMode: PaymentMode;
  upiTransactionId?: string;
  membershipStartDate: Date;
  membershipEndDate: Date;
  notes?: string;
}

// ─── Expenses ───────────────────────────────────────────────────────────────

export type ExpenseCategory = 'Rent' | 'Salary' | 'Utilities' | 'Products & Supplies' | 'Equipment' | 'Repair & Maintenance' | 'Other';

export interface ExpenseEntry {
  id?: string;
  category: ExpenseCategory;
  amount: number;
  date: Timestamp;
  description?: string;
  createdAt: Timestamp;
}

// ─── WhatsApp Connection ────────────────────────────────────────────────────

export type WhatsAppConnectionStatus = 'not_connected' | 'pending' | 'live';

export interface WhatsAppStatus {
  status: WhatsAppConnectionStatus;
  phoneNumber: string | null;
  displayName: string | null;
}

// ─── Lead ───────────────────────────────────────────────────────────────────

export type LeadStatus = 'New' | 'Contacted' | 'Trial Scheduled' | 'Trial Done' | 'Negotiation' | 'Converted' | 'Lost';

export type LeadSource = 'Social Media' | 'Walk-in' | 'Referral' | 'Google' | 'Instagram';

export interface LeadNote {
  text: string;
  createdBy: string;
  createdAt: Timestamp;
}

export interface Lead {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  source: LeadSource;
  status: LeadStatus;
  assignedTo: string | null;
  trialDate: Timestamp | null;
  notes: LeadNote[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

