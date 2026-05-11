# Implementation Plan: Snip & Glow — WhatsApp-Native Salon Management SaaS

## Overview

This plan converts the existing PingFlow gym CRM (Firebase/Vite/React) into a multi-tenant salon management platform on Supabase/Next.js 14. Tasks follow the specified build order: schema → auth → shell → features → integrations → polish. Each task builds incrementally on previous steps, with property-based tests integrated close to their relevant implementations.

## Tasks

- [x] 1. Project scaffolding and TypeScript type foundations
  - [x] 1.1 Initialize Next.js 14 App Router project with Tailwind CSS, shadcn/ui, and Supabase client libraries
    - Create the Next.js project with `app/` directory structure
    - Install dependencies: `@supabase/supabase-js`, `@supabase/auth-helpers-nextjs`, `@supabase/ssr`, `tailwindcss`, `recharts`, `@react-pdf/renderer`, `fast-check`
    - Configure `tsconfig.json` path aliases (`@/` → `src/`)
    - Set up Tailwind with custom tokens in `globals.css`
    - Initialize shadcn/ui with default theme
    - _Requirements: 19.4, 19.5_

  - [x] 1.2 Define TypeScript interfaces and types for all 14 database tables
    - Create `src/types/database.ts` with interfaces: Tenant, Branch, Employee, Customer, Service, Appointment, Invoice, InvoiceItem, Membership, CustomerMembership, WhatsAppSession, AuditLog, AnalyticsSnapshot
    - Define enums/union types: AppointmentStatus, InvoiceStatus, DeliveryStatus, MembershipStatus, SubscriptionStatus, PaymentMethod, UserRole, PlanTier
    - Define `ActionResult<T>` type for Server Action responses
    - Define API request/response payload types for Edge Functions
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

  - [x] 1.3 Create shared utility functions (formatters and validators)
    - Implement `formatINR(amount: number): string` using Indian numbering system
    - Implement `formatDateIN(date: Date): string` → "DD MMM YYYY" format
    - Implement `formatTimeIST(date: Date): string` → 12-hour AM/PM in IST
    - Implement `isValidIndianPhone(phone: string): boolean` (10 digits, starts with 6-9)
    - Implement `formatPhoneE164(phone: string): string` → "+91XXXXXXXXXX"
    - Implement `calculateInvoiceTotal(input: BillingCalculation): InvoiceTotals`
    - _Requirements: 15.1, 15.2, 15.3, 6.2_

  - [ ]* 1.4 Write property test for INR currency formatting
    - **Property 2: INR Currency Formatting**
    - **Validates: Requirements 3.5, 15.1**

  - [ ]* 1.5 Write property test for Indian phone number validation and formatting
    - **Property 3: Indian Phone Number Validation and Formatting**
    - **Validates: Requirements 7.5, 15.3**

  - [ ]* 1.6 Write property test for date and time formatting (IST)
    - **Property 4: Date and Time Formatting (IST)**
    - **Validates: Requirements 4.7, 15.2**

  - [ ]* 1.7 Write property test for billing calculation correctness
    - **Property 5: Billing Calculation Correctness**
    - **Validates: Requirements 6.2, 8.3, 15.5**

- [x] 2. Database migrations — schema, triggers, RLS, and cron
  - [x] 2.1 Create Supabase migration for core tables (tenants, branches, employees, customers, services)
    - Write SQL migration creating `tenants`, `branches`, `employees`, `customers`, `services` tables with all columns, constraints, and foreign keys as specified in the design
    - Include CHECK constraints for status fields and enum values
    - Add indexes on `tenant_id`, `branch_id`, and frequently queried columns
    - _Requirements: 17.1, 17.2, 1.3_

  - [x] 2.2 Create Supabase migration for transactional tables (appointments, invoices, invoice_items, memberships, customer_memberships)
    - Write SQL migration for `appointments` with the EXCLUDE constraint for overlap prevention
    - Write SQL migration for `invoices` and `invoice_items` with UNIQUE constraint on (branch_id, invoice_number)
    - Write SQL migration for `memberships` and `customer_memberships`
    - _Requirements: 17.1, 17.2, 4.3_

  - [x] 2.3 Create Supabase migration for operational tables (whatsapp_sessions, audit_logs, analytics_snapshots)
    - Write SQL migration for `whatsapp_sessions`, `audit_logs`, `analytics_snapshots`
    - Add appropriate indexes for time-range queries on `created_at` and `snapshot_date`
    - _Requirements: 17.1, 9.6, 12.5_

  - [x] 2.4 Create database triggers (invoice numbering, customer stats, audit logging)
    - Implement `generate_invoice_number()` trigger function for auto-incrementing per-branch invoice numbers
    - Implement `update_customer_stats()` trigger function for total_visits and total_spent
    - Implement `audit_log_trigger()` function and attach to INSERT/UPDATE/DELETE on core tables (customers, appointments, invoices, services, memberships, employees)
    - _Requirements: 17.3, 17.4, 17.5_

  - [x] 2.5 Create RLS policies for tenant isolation and role-based access
    - Enable RLS on all 14 tables
    - Create tenant isolation policies (`tenant_id = jwt.tenant_id`) on all tables
    - Create role-based policies: staff read-only on customers/appointments, owner/manager write access
    - Create branch-scoped policies for non-owner roles
    - Create owner-only policies for employees and branches tables
    - _Requirements: 1.1, 1.3, 1.4, 2.5, 2.6, 2.7_

  - [x] 2.6 Create `get_available_slots` PostgreSQL function
    - Implement the slot availability function that checks employee schedule, branch operating hours, and existing appointments
    - Return available 30-minute slot starts that don't overlap with booked appointments
    - _Requirements: 4.3, 5.5_

  - [x] 2.7 Set up pg_cron schedules for automated jobs
    - Schedule `appointment-reminders` daily at 8:00 AM IST
    - Schedule `follow-up-trigger` daily at 10:00 AM IST
    - Schedule `aggregate-analytics` daily at 2:00 AM IST
    - Schedule membership expiry check daily
    - _Requirements: 9.1, 9.2, 10.5, 15.6_

  - [ ]* 2.8 Write property test for invoice number sequential increment
    - **Property 6: Invoice Number Sequential Increment Per Branch**
    - **Validates: Requirements 6.4, 17.3**

  - [ ]* 2.9 Write property test for appointment slot availability (no overlaps)
    - **Property 7: Appointment Slot Availability (No Overlaps)**
    - **Validates: Requirements 4.3, 5.5**

  - [ ]* 2.10 Write property test for customer stats invariant
    - **Property 10: Customer Stats Invariant**
    - **Validates: Requirements 7.4, 17.4**

  - [ ]* 2.11 Write property test for audit log completeness
    - **Property 13: Audit Log Completeness**
    - **Validates: Requirements 12.1, 12.2, 17.5**

  - [ ]* 2.12 Write property test for database round-trip preservation
    - **Property 11: Database Round-Trip Preservation**
    - **Validates: Requirements 17.7**

- [x] 3. Checkpoint — Ensure schema migrations apply cleanly and all property tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Authentication (Google OAuth + WhatsApp OTP)
  - [x] 4.1 Configure Supabase Auth with Google OAuth provider
    - Set up Google OAuth in Supabase dashboard configuration
    - Create `app/api/auth/callback/route.ts` to handle OAuth callback and exchange code for session
    - After successful auth, query `employees` table to resolve tenant_id, branch_id, and role
    - Set JWT custom claims (tenant_id, branch_id, role) via `auth.updateUser` metadata
    - _Requirements: 2.1, 2.3_

  - [x] 4.2 Implement WhatsApp OTP Edge Functions (send-whatsapp-otp, verify-whatsapp-otp)
    - Create `supabase/functions/send-whatsapp-otp/index.ts`: generate 6-digit OTP, store with 5-min TTL, send via Meta Cloud API
    - Create `supabase/functions/verify-whatsapp-otp/index.ts`: validate OTP, issue Supabase auth token on success
    - Create `otp_codes` table (or use existing mechanism) with phone, code, expires_at columns
    - _Requirements: 2.2, 18.3, 18.4_

  - [x] 4.3 Create Next.js middleware for JWT validation and route protection
    - Implement `middleware.ts` with session validation using `createMiddlewareClient`
    - Redirect unauthenticated users to `/login` for dashboard routes
    - Redirect authenticated users without tenant_id to `/onboarding`
    - Inject `x-tenant-id`, `x-branch-id`, `x-user-role` headers for Server Components
    - _Requirements: 2.8, 1.1_

  - [x] 4.4 Build login page with Google OAuth and WhatsApp OTP UI
    - Create `app/(auth)/login/page.tsx` with Google sign-in button and phone number input
    - Create `app/(auth)/verify-otp/page.tsx` with 6-digit OTP input and countdown timer
    - Create `app/(auth)/layout.tsx` (no sidebar, centered card layout)
    - _Requirements: 2.1, 2.2_

  - [x] 4.5 Implement role-based permission system
    - Create `src/lib/permissions.ts` with permission map: role × resource × action matrix
    - Implement `can(role, action, resource): boolean` resolver function
    - Create `RoleGuard` component for conditional rendering based on role
    - _Requirements: 2.4, 2.5, 2.6, 2.7_

  - [ ]* 4.6 Write property test for role permission enforcement
    - **Property 1: Role Permission Enforcement**
    - **Validates: Requirements 2.5, 2.6, 2.7, 10.7, 12.6**

- [x] 5. Dashboard shell (sidebar, layout, role-based navigation)
  - [x] 5.1 Create AppShell layout with sidebar, topbar, and branch switcher
    - Create `app/(dashboard)/layout.tsx` as the main dashboard layout
    - Implement `Sidebar` component with permission-filtered navigation links
    - Implement `BranchSwitcher` dropdown for owners to switch active branch
    - Implement topbar with user avatar, role badge, and logout
    - _Requirements: 1.5, 2.4, 11.6_

  - [x] 5.2 Implement responsive layout and loading states
    - Make sidebar collapsible on mobile (hamburger menu)
    - Create `LoadingSkeleton` component with variants (table, card, chart)
    - Create `ErrorBoundary` component with "Try Again" button
    - Create `Toast` notification system for success/error messages
    - _Requirements: 16.1, 16.2, 16.3, 16.5_

  - [x] 5.3 Implement branch switching Server Action
    - Create `switchBranch` Server Action that validates branch ownership and updates user metadata
    - Revalidate all dashboard paths on branch switch
    - _Requirements: 1.5_

- [x] 6. Customer management (list, profile, search)
  - [x] 6.1 Build customer list page with search
    - Create `app/(dashboard)/customers/page.tsx` with DataTable component
    - Implement server-side search by name or phone with <300ms response
    - Display columns: name, phone, total visits, total spent, last visit, membership badge
    - Add "New Customer" button (owner/manager only via RoleGuard)
    - _Requirements: 7.1, 7.6, 7.7_

  - [x] 6.2 Build customer profile page with visit and billing history
    - Create `app/(dashboard)/customers/[id]/page.tsx`
    - Display customer details: name, phone (+91 format), email, gender, notes
    - Show visit history tab: chronological list of completed appointments
    - Show billing history tab: list of invoices with amounts and payment status
    - Show active membership badge and expiry date if applicable
    - _Requirements: 7.2, 7.3, 7.4, 7.7_

  - [x] 6.3 Implement customer CRUD Server Actions
    - Create `createCustomer` action with phone validation (+91 format)
    - Create `updateCustomer` action
    - Create `searchCustomers` action with debounced query
    - _Requirements: 7.1, 7.5_

- [x] 7. Service catalog management (CRUD, categories)
  - [x] 7.1 Build services management page
    - Create `app/(dashboard)/services/page.tsx` with services grouped by category
    - Display ServiceCard components with name, category badge, duration, price (INR formatted)
    - Add create/edit modal for services (name, category, duration_minutes, price)
    - Implement soft-delete with confirmation dialog and informational message when referenced
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 7.2 Implement service CRUD Server Actions
    - Create `createService`, `updateService`, `softDeleteService` actions
    - Check for existing appointment/invoice references before allowing delete
    - Validate category is one of predefined set (Hair, Skin, Nails, Spa, or custom)
    - _Requirements: 3.1, 3.2, 3.4, 3.6_

  - [ ]* 7.3 Write property test for soft-delete exclusion from active queries
    - **Property 9: Soft-Delete Exclusion from Active Queries**
    - **Validates: Requirements 3.4, 5.3**

- [x] 8. Appointment booking via dashboard (booking form, calendar, list, status actions)
  - [x] 8.1 Build appointment list and calendar views
    - Create `app/(dashboard)/appointments/page.tsx` with toggle between calendar and list view
    - Implement `CalendarView` component showing day/week view with appointment blocks
    - Implement list view with DataTable: customer, service, stylist, date, time, status badge
    - Display times in IST, dates as DD MMM YYYY
    - _Requirements: 4.1, 4.7_

  - [x] 8.2 Build appointment creation form with slot availability
    - Create appointment booking modal/drawer with fields: Customer (searchable), Service, Employee, Date, Time Slot
    - Call `get_available_slots` function to populate time slot dropdown
    - Validate no overlapping appointments for selected employee
    - Set initial status to "booked" on creation
    - _Requirements: 4.2, 4.3, 4.4_

  - [x] 8.3 Implement appointment status transitions
    - Create `updateAppointmentStatus` Server Action enforcing valid transitions: booked→confirmed, booked→cancelled, confirmed→completed, confirmed→cancelled
    - When status changes to "completed", show prompt to generate invoice
    - Display status badges with appropriate colors
    - _Requirements: 4.5, 4.6_

  - [ ]* 8.4 Write property test for appointment status machine transitions
    - **Property 8: Appointment Status Machine Transitions**
    - **Validates: Requirements 4.5**

- [x] 9. Checkpoint — Ensure all tests pass and core CRUD flows work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Billing and invoicing (POS, PDF generation, invoice history)
  - [x] 10.1 Build POS billing page
    - Create `app/(dashboard)/billing/new/page.tsx` with POS interface
    - Implement customer selection (searchable dropdown)
    - Implement multi-service line item selection with quantity
    - Display subtotal, membership discount (auto-applied), GST calculation, and total in INR
    - Add payment method selector (cash, UPI, card)
    - _Requirements: 6.1, 6.2, 6.3, 15.4_

  - [x] 10.2 Implement invoice creation Server Action
    - Create `createInvoice` action that inserts invoice (triggers auto-number) and invoice_items
    - Apply membership discount automatically if customer has active membership
    - Calculate GST if enabled in tenant settings
    - Return created invoice with generated invoice_number
    - _Requirements: 6.2, 6.3, 6.4, 8.3_

  - [x] 10.3 Build invoice list and detail pages
    - Create `app/(dashboard)/billing/page.tsx` with invoice history DataTable
    - Display: invoice number, customer, date, total (INR), payment method, delivery status
    - Add "Send via WhatsApp" and "Retry" buttons for delivery management
    - _Requirements: 6.4, 6.7_

  - [x] 10.4 Implement PDF invoice generation with @react-pdf/renderer
    - Create `src/lib/invoice-pdf.tsx` with React PDF document component
    - Include: salon name, branch address, invoice number, date, customer name, itemized services, discounts, GST, total, payment method
    - Format all amounts in INR with Indian numbering
    - _Requirements: 6.5, 6.6_

  - [x] 10.5 Create send-invoice Edge Function
    - Create `supabase/functions/send-invoice/index.ts`
    - Fetch invoice + items + customer + branch data
    - Generate PDF using @react-pdf/renderer
    - Upload to Supabase Storage at `invoices/{tenant_id}/{branch_id}/{invoice_number}.pdf`
    - Send document message via Meta Cloud API with signed URL
    - Update delivery_status and create whatsapp_sessions record
    - Handle failures: set delivery_status = 'failed', log error details
    - _Requirements: 6.5, 6.7, 9.4, 18.7_

- [x] 11. WhatsApp integration (webhook, Flow endpoint, reminders, follow-ups)
  - [x] 11.1 Create whatsapp-webhook Edge Function
    - Create `supabase/functions/whatsapp-webhook/index.ts`
    - Validate X-Hub-Signature-256 using HMAC-SHA256
    - Parse incoming message types: text, interactive/flow response, status update
    - Route booking keywords ("book", "appointment", "slot") to trigger WhatsApp Flow
    - Update whatsapp_sessions on status updates (sent, delivered, read, failed)
    - Always return 200 to prevent Meta retries
    - _Requirements: 18.1, 5.1, 9.5, 9.6_

  - [ ]* 11.2 Write property test for webhook HMAC signature validation
    - **Property 12: Webhook HMAC Signature Validation**
    - **Validates: Requirements 18.1, 18.9**

  - [x] 11.3 Create whatsapp-flow-endpoint Edge Function
    - Create `supabase/functions/whatsapp-flow-endpoint/index.ts`
    - Implement AES-GCM decryption of incoming flow requests and encryption of responses
    - Handle 5 screens: SELECT_SERVICE, SELECT_STYLIST, SELECT_DATE, SELECT_TIME, CONFIRM
    - Return only active services, available employees, available dates (next 14 days), available time slots
    - On CONFIRM: create appointment record and send confirmation message
    - On error: send fallback text message
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 18.2_

  - [x] 11.4 Create appointment-reminders Edge Function
    - Create `supabase/functions/appointment-reminders/index.ts`
    - Query appointments for next day (using IST timezone)
    - Send WhatsApp reminder to each customer with appointment details
    - Log all sends/failures to whatsapp_sessions
    - _Requirements: 9.1, 18.5_

  - [x] 11.5 Create follow-up-trigger Edge Function
    - Create `supabase/functions/follow-up-trigger/index.ts`
    - Query customers with `last_visit_at` older than 30 days
    - Send WhatsApp follow-up message
    - Log all sends/failures to whatsapp_sessions
    - _Requirements: 9.2, 18.6_

- [x] 12. Memberships (plans, assignment, auto-discount, expiry)
  - [x] 12.1 Build memberships management page
    - Create `app/(dashboard)/memberships/page.tsx`
    - Display membership plans with: name, price (INR), validity days, discount percentage
    - Show active membership count and total membership revenue
    - Add create/edit modal for membership plans
    - _Requirements: 8.1, 8.5_

  - [x] 12.2 Implement membership assignment and auto-discount logic
    - Create `assignMembership` Server Action: create customer_membership with start_date, calculated end_date, status "active"
    - Integrate auto-discount into POS billing: detect active membership, apply discount_pct
    - Display original price, discount %, and discounted total on POS
    - _Requirements: 8.2, 8.3, 6.3_

  - [x] 12.3 Implement membership expiry check and reminder list
    - Create logic to mark expired memberships (end_date < current_date) as "expired"
    - Generate 7-day-before-expiry reminder list for follow-up
    - Integrate with follow-up-trigger Edge Function
    - _Requirements: 8.4, 8.6_

  - [ ]* 12.4 Write property test for membership expiry and reminder list
    - **Property 15: Membership Expiry and Reminder List**
    - **Validates: Requirements 8.4, 8.6**

- [x] 13. Analytics dashboard (charts, aggregation)
  - [x] 13.1 Create aggregate-analytics Edge Function
    - Create `supabase/functions/aggregate-analytics/index.ts`
    - Compute daily snapshots per branch: revenue, appointment_count, new_customers, retention_rate, top_services
    - UPSERT into analytics_snapshots table
    - _Requirements: 10.5, 18.8_

  - [ ]* 13.2 Write property test for analytics snapshot aggregation
    - **Property 14: Analytics Snapshot Aggregation**
    - **Validates: Requirements 18.8, 10.3**

  - [x] 13.3 Build analytics dashboard page with Recharts
    - Create `app/(dashboard)/analytics/page.tsx` (owner/manager only, deny staff)
    - Implement revenue trends line chart (daily/weekly/monthly toggle)
    - Implement appointment volume by day-of-week bar chart
    - Implement customer retention rate percentage metric card
    - Implement top services by revenue horizontal bar chart
    - Add date range filter and branch filter
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6, 10.7_

- [x] 14. Staff and branch management
  - [x] 14.1 Build staff management page
    - Create `app/(dashboard)/staff/page.tsx` (owner only)
    - Display employee list with: name, phone, role, branch, specializations, active status
    - Add create/edit modal for employees (name, phone, email, role, branch, specializations)
    - Implement deactivate employee action (revokes login, does not delete)
    - _Requirements: 11.1, 11.3, 11.4_

  - [x] 14.2 Build branch management page
    - Create `app/(dashboard)/branches/page.tsx` (owner only)
    - Display branch list with: name, address, phone, operating hours
    - Add create/edit modal for branches
    - Implement branch comparison view showing key metrics side by side
    - _Requirements: 11.2, 11.5, 11.6_

- [x] 15. Audit trail (log page, CSV export)
  - [x] 15.1 Build audit log page
    - Create `app/(dashboard)/audit-log/page.tsx` (owner only, deny staff)
    - Display audit logs in searchable, filterable DataTable
    - Show columns: timestamp (IST), actor name, action type, resource type, description
    - Add filters: date range picker, action type dropdown
    - Implement CSV export for selected date range
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 16. Checkpoint — Ensure all tests pass and all features are integrated
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Settings, onboarding, and SaaS subscription
  - [x] 17.1 Build onboarding flow (setup wizard)
    - Create `app/(dashboard)/onboarding/page.tsx` with multi-step wizard
    - Step 1: Salon name, owner name, phone number
    - Step 2: Primary branch address and operating hours
    - Step 3: Add initial services (skippable)
    - Display progress indicator for completed/remaining steps
    - On submit: create Tenant, Branch, Employee (owner) in single transaction
    - Redirect to dashboard with welcome message on completion
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 17.2 Create razorpay-webhook Edge Function
    - Create `supabase/functions/razorpay-webhook/index.ts`
    - Validate Razorpay webhook signature
    - On successful payment: update tenant subscription_status to "active", set subscription_start/end
    - On payment failure: set subscription_status to "past_due", notify owner via WhatsApp
    - Handle subscription upgrades/downgrades with proration
    - _Requirements: 13.2, 13.3, 13.4, 13.7, 18.9_

  - [x] 17.3 Build settings page with subscription management
    - Create `app/(dashboard)/settings/page.tsx`
    - Display current plan tier, subscription status, next payment date
    - Show billing history from Razorpay
    - Add plan upgrade/downgrade options (Starter, Pro, Enterprise)
    - Implement subscription expiry enforcement: read-only mode after 7 days expired with renewal banner
    - _Requirements: 13.1, 13.5, 13.6_

  - [x] 17.4 Implement PlanGuard component for feature gating
    - Create `PlanGuard` component that checks tenant's plan_tier against feature requirements
    - Gate features by tier (e.g., analytics for Pro+, multi-branch for Enterprise)
    - Show upgrade modal when accessing gated features
    - _Requirements: 13.1, 13.5_

- [x] 18. Polish — responsive design, loading states, error handling
  - [x] 18.1 Ensure responsive design across all pages
    - Verify all pages render correctly at 375px viewport width without horizontal scrolling
    - Make DataTable components horizontally scrollable on mobile
    - Ensure modals and drawers are mobile-friendly
    - Test sidebar collapse behavior on mobile
    - _Requirements: 16.1_

  - [x] 18.2 Implement comprehensive error handling
    - Add ErrorBoundary wrappers to all route segments
    - Ensure all Server Actions return `ActionResult<T>` with user-friendly error messages
    - Verify no console warnings or errors during normal operation
    - Confirm no hardcoded tenant_id or branch_id values anywhere in codebase
    - _Requirements: 16.3, 16.4, 16.5, 16.6_

  - [x] 18.3 Add loading states and async UX polish
    - Add loading skeletons to all data-fetching pages
    - Add optimistic updates for status transitions
    - Ensure toast notifications appear for all mutation results
    - _Requirements: 16.2, 16.3_

- [x] 19. Final checkpoint — Ensure all tests pass and full integration is verified
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate the 15 universal correctness properties defined in the design
- The tech stack is TypeScript throughout: Next.js 14 (App Router), Supabase (PostgreSQL + Edge Functions in Deno), fast-check for property tests, Vitest as test runner
- India-specific formatting (INR, IST, +91, UPI, GST) is centralized in shared utilities and tested via properties 2–5
- All Edge Functions use Deno runtime and follow the error handling patterns from the design document
