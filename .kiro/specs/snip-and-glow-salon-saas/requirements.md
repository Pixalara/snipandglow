# Requirements Document

## Introduction

Snip & Glow is a WhatsApp-native salon management SaaS platform adapted from the existing PingFlow gym CRM codebase. The system enables multi-tenant salon businesses in India to manage appointments, billing, customers, staff, and memberships through a web dashboard and WhatsApp-based interactions. The platform migrates from Firebase/Firestore to Supabase (PostgreSQL) with Next.js 14 App Router, retaining WhatsApp integration via Meta Cloud API and adding WhatsApp Flows for native in-chat booking.

## Glossary

- **Tenant**: A salon business entity that subscribes to the Snip & Glow platform; the top-level isolation boundary for all data
- **Branch**: A physical salon location belonging to a Tenant; data is scoped per branch
- **Employee**: A staff member (stylist, receptionist, manager) working at a Branch
- **Customer**: A person who visits a Branch for services; tracked with visit history
- **Service**: A salon offering (haircut, facial, etc.) with a name, category, duration, and price
- **Appointment**: A scheduled booking linking a Customer to a Service and Employee at a specific date/time slot
- **Invoice**: A billing document generated for services rendered, with line items and payment status
- **Membership**: A subscription plan offered by a Tenant (e.g., monthly unlimited blowdry) with auto-discount benefits
- **WhatsApp_Flow**: A multi-screen interactive UI rendered natively inside WhatsApp chat for appointment booking
- **RLS**: Row-Level Security; PostgreSQL policies enforcing tenant and role-based data isolation
- **Edge_Function**: A Supabase Edge Function (Deno runtime) handling background jobs and webhooks
- **POS**: Point of Sale; the billing interface for walk-in and appointment-based transactions
- **Audit_Log**: A timestamped record of user actions for compliance and traceability
- **Analytics_Snapshot**: A pre-aggregated daily summary of revenue, appointments, and customer metrics
- **Razorpay**: Indian payment gateway used for SaaS subscription billing
- **Meta_Cloud_API**: The official WhatsApp Business API provided by Meta for programmatic messaging
- **IST**: Indian Standard Time (UTC+5:30)
- **INR**: Indian Rupee (₹)
- **GST**: Goods and Services Tax (India); optionally displayed on invoices
- **UPI**: Unified Payments Interface; Indian real-time payment system

## Requirements

### Requirement 1: Multi-Tenant Data Architecture

**User Story:** As a platform operator, I want each salon tenant's data to be completely isolated, so that no tenant can access another tenant's information.

#### Acceptance Criteria

1. THE RLS SHALL enforce that all database queries return only rows belonging to the authenticated user's tenant_id
2. WHEN a new Tenant is created, THE System SHALL provision a tenant record, a default Branch, and an owner Employee record in a single transaction
3. THE System SHALL scope all Customer, Appointment, Invoice, Service, and Employee records to both tenant_id and branch_id
4. IF a user attempts to access data belonging to a different tenant, THEN THE RLS SHALL return an empty result set without raising an error
5. WHEN a Tenant has multiple Branches, THE System SHALL allow the owner to switch between Branches and view branch-scoped data

### Requirement 2: Authentication and Authorization

**User Story:** As a salon owner or staff member, I want to log in securely using Google or WhatsApp OTP, so that I can access the dashboard with appropriate permissions.

#### Acceptance Criteria

1. THE Auth_System SHALL support Google OAuth login via Supabase Auth
2. THE Auth_System SHALL support WhatsApp OTP login by sending a 6-digit code via Meta_Cloud_API and verifying it within 5 minutes
3. WHEN a user authenticates successfully, THE Auth_System SHALL issue a Supabase session token with tenant_id and role claims in the JWT
4. THE System SHALL enforce three roles: owner, manager, and staff
5. WHILE a user has the role "staff", THE System SHALL restrict access to read-only on Customers and Appointments, and deny access to Billing, Analytics, Staff Management, and Settings
6. WHILE a user has the role "manager", THE System SHALL grant full CRUD on Customers, Appointments, Services, and Billing, but deny access to Staff Management, Branch Management, and subscription Settings
7. WHILE a user has the role "owner", THE System SHALL grant unrestricted access to all resources within the Tenant
8. THE Middleware SHALL validate the JWT on every protected route and redirect unauthenticated users to the login page

### Requirement 3: Service Catalog Management

**User Story:** As a salon owner, I want to manage my service catalog with categories, so that staff and customers can browse available services.

#### Acceptance Criteria

1. THE System SHALL allow owners and managers to create a Service with name, category, duration (in minutes), and price (in INR)
2. THE System SHALL allow owners and managers to update and delete existing Services
3. THE System SHALL group Services by category (e.g., Hair, Skin, Nails, Spa) for display
4. WHEN a Service is deleted, THE System SHALL soft-delete the record by setting an is_active flag to false
5. THE System SHALL display Service prices formatted in INR using the Indian numbering system (e.g., ₹1,50,000)
6. WHEN a Service is referenced by existing Appointments or Invoices, THE System SHALL prevent hard deletion and display an informational message

### Requirement 4: Appointment Booking via Dashboard

**User Story:** As a salon receptionist or manager, I want to book appointments through the dashboard, so that I can schedule customers for services.

#### Acceptance Criteria

1. THE System SHALL display appointments in both calendar view (day/week) and list view
2. WHEN a user creates an Appointment, THE System SHALL require selection of Customer, Service, Employee (stylist), date, and time slot
3. THE System SHALL validate that the selected Employee is available at the chosen date and time (no overlapping appointments based on service duration)
4. WHEN an Appointment is created, THE System SHALL set its status to "booked"
5. THE System SHALL support Appointment status transitions: booked → confirmed → completed → cancelled (cancelled allowed from booked or confirmed)
6. WHEN an Appointment is marked as completed, THE System SHALL prompt the user to generate an Invoice
7. THE System SHALL display the appointment time in IST and format dates as DD MMM YYYY

### Requirement 5: Appointment Booking via WhatsApp Flow

**User Story:** As a customer, I want to book an appointment through WhatsApp without downloading an app, so that I can schedule visits conveniently.

#### Acceptance Criteria

1. WHEN a customer sends a booking keyword (e.g., "book", "appointment") to the salon's WhatsApp number, THE WhatsApp_Webhook SHALL trigger the booking WhatsApp_Flow
2. THE WhatsApp_Flow SHALL present a multi-screen sequence: SELECT_SERVICE → SELECT_STYLIST → SELECT_DATE → SELECT_TIME → CONFIRM
3. THE WhatsApp_Flow_Endpoint SHALL return only active Services for the SELECT_SERVICE screen
4. THE WhatsApp_Flow_Endpoint SHALL return only available Employees for the selected Service on the SELECT_STYLIST screen
5. THE WhatsApp_Flow_Endpoint SHALL return only available time slots (excluding already-booked slots) for the SELECT_TIME screen
6. WHEN the customer confirms the booking, THE System SHALL create an Appointment record with status "booked" and send a confirmation message via WhatsApp
7. IF the WhatsApp_Flow_Endpoint encounters an error, THEN THE System SHALL send a fallback text message asking the customer to try again or call the salon

### Requirement 6: POS Billing and Invoice Generation

**User Story:** As a salon manager, I want to create bills for services rendered and send invoices via WhatsApp, so that customers receive professional receipts.

#### Acceptance Criteria

1. THE POS SHALL allow selection of a Customer, one or more Services (as line items), and a payment method (cash, UPI, card)
2. THE POS SHALL calculate the subtotal, apply membership discounts automatically, add optional GST, and display the total in INR
3. WHEN a membership discount applies, THE POS SHALL display the original price, discount percentage, and discounted total
4. WHEN the user confirms the bill, THE System SHALL create an Invoice record with a unique auto-incrementing invoice number per Branch (format: INV-BRANCH-NNNN)
5. THE Send_Invoice_Function SHALL generate a PDF invoice using @react-pdf/renderer, upload it to Supabase Storage, and send it to the Customer via WhatsApp
6. THE Invoice PDF SHALL include: salon name, branch address, invoice number, date, customer name, itemized services with prices, discounts, GST (if applicable), total, and payment method
7. IF the WhatsApp delivery fails, THEN THE System SHALL mark the invoice as "delivery_failed" and allow manual retry

### Requirement 7: Customer Management

**User Story:** As a salon staff member, I want to view and manage customer profiles with visit history, so that I can provide personalized service.

#### Acceptance Criteria

1. THE System SHALL store Customer records with: name, phone (+91 format), email (optional), gender, notes, and created_at timestamp
2. THE System SHALL display a Customer's visit history as a chronological list of completed Appointments with services rendered
3. THE System SHALL display a Customer's billing history as a list of Invoices with amounts and payment status
4. THE System SHALL track total_visits and total_spent as auto-updated fields on the Customer record
5. WHEN a Customer's phone number is provided, THE System SHALL validate it as a 10-digit Indian mobile number and store it in +91XXXXXXXXXX format
6. THE System SHALL allow searching Customers by name or phone number with results appearing within 300ms of input
7. WHEN a Customer has an active membership, THE System SHALL display the membership badge and expiry date on the profile

### Requirement 8: Membership Plans

**User Story:** As a salon owner, I want to offer membership plans with automatic discounts, so that I can encourage repeat visits and customer loyalty.

#### Acceptance Criteria

1. THE System SHALL allow owners to create Membership plans with: name, description, price, validity period (in days), and discount percentage
2. WHEN a Customer is assigned a Membership, THE System SHALL create a customer_membership record with start_date, end_date, and status "active"
3. WHILE a Customer has an active Membership, THE POS SHALL automatically apply the membership discount percentage to all applicable services
4. WHEN a Membership expires (end_date passes current date), THE System SHALL update the customer_membership status to "expired"
5. THE System SHALL display active membership count and revenue on the Memberships management page
6. WHEN a Customer's membership is within 7 days of expiry, THE System SHALL include the Customer in the follow-up reminder list

### Requirement 9: WhatsApp Automated Messaging

**User Story:** As a salon owner, I want automated WhatsApp messages for reminders and follow-ups, so that I can reduce no-shows and encourage repeat visits.

#### Acceptance Criteria

1. THE Appointment_Reminders_Function SHALL run daily via pg_cron and send a WhatsApp reminder to all Customers with appointments scheduled for the next day
2. THE Follow_Up_Trigger_Function SHALL run daily via pg_cron and send a WhatsApp follow-up message to all Customers who have not visited in 30 or more days
3. WHEN an Appointment is created via WhatsApp_Flow, THE System SHALL send an immediate confirmation message with appointment details (service, stylist, date, time)
4. WHEN an Invoice is generated, THE Send_Invoice_Function SHALL send the PDF invoice to the Customer's WhatsApp number
5. IF a WhatsApp message fails to send (API error or invalid number), THEN THE System SHALL log the failure in the whatsapp_sessions table with error details
6. THE System SHALL track all WhatsApp message sessions with status (sent, delivered, read, failed) in the whatsapp_sessions table

### Requirement 10: Analytics Dashboard

**User Story:** As a salon owner, I want to view business analytics with charts, so that I can make data-driven decisions about my salon.

#### Acceptance Criteria

1. THE Analytics_Dashboard SHALL display revenue trends (daily/weekly/monthly) as a line chart using Recharts
2. THE Analytics_Dashboard SHALL display appointment volume by day-of-week as a bar chart
3. THE Analytics_Dashboard SHALL display customer retention rate (customers with 2+ visits in last 30 days / total active customers) as a percentage metric
4. THE Analytics_Dashboard SHALL display top-performing services by revenue as a horizontal bar chart
5. THE Aggregate_Analytics_Function SHALL run nightly via pg_cron and compute daily snapshots of revenue, appointment count, new customers, and retention rate
6. THE Analytics_Dashboard SHALL allow filtering by date range and Branch
7. WHILE the user's role is "staff", THE System SHALL deny access to the Analytics page

### Requirement 11: Staff and Branch Management

**User Story:** As a salon owner, I want to manage my staff and branches, so that I can organize my business operations across locations.

#### Acceptance Criteria

1. THE System SHALL allow owners to create Employee records with: name, phone, email, role (owner/manager/staff), assigned branch, and specializations
2. THE System SHALL allow owners to create Branch records with: name, address, phone, and operating hours
3. WHEN an Employee is assigned to a Branch, THE System SHALL scope that Employee's data access to only that Branch's records
4. THE System SHALL allow owners to deactivate (not delete) Employees, which revokes their login access
5. WHEN a new Branch is created, THE System SHALL generate a unique branch identifier and apply RLS policies automatically
6. THE System SHALL display a branch comparison view showing key metrics (revenue, appointments, customers) side by side

### Requirement 12: Audit Trail

**User Story:** As a salon owner, I want a complete audit trail of all actions, so that I can track who did what and when for accountability.

#### Acceptance Criteria

1. THE System SHALL automatically log all create, update, and delete operations on Customers, Appointments, Invoices, Services, Memberships, and Employees to the audit_logs table
2. THE Audit_Log record SHALL include: timestamp (IST), actor (employee name and ID), action type, resource type, resource ID, and a human-readable description
3. THE System SHALL display audit logs in a searchable, filterable list with date range and action type filters
4. THE System SHALL allow owners to export audit logs as a CSV file for a selected date range
5. THE System SHALL retain audit logs for a minimum of 365 days
6. WHILE the user's role is "staff", THE System SHALL deny access to the Audit Trail page

### Requirement 13: SaaS Subscription Billing

**User Story:** As a salon owner, I want to subscribe to a plan and manage my billing, so that I can access platform features appropriate to my business size.

#### Acceptance Criteria

1. THE System SHALL offer three subscription tiers: Starter, Pro, and Enterprise
2. THE System SHALL integrate with Razorpay for subscription creation, payment processing, and webhook-based status updates
3. WHEN a Razorpay webhook indicates a successful payment, THE Razorpay_Webhook_Function SHALL update the Tenant's subscription status and period
4. WHEN a Razorpay webhook indicates a payment failure, THE Razorpay_Webhook_Function SHALL update the Tenant's subscription status to "past_due" and notify the owner via WhatsApp
5. IF a Tenant's subscription is expired for more than 7 days, THEN THE System SHALL restrict access to read-only mode with a banner prompting renewal
6. THE System SHALL display current plan, billing history, and next payment date on the Settings page
7. WHEN a Tenant upgrades or downgrades their plan, THE System SHALL prorate the billing amount via Razorpay

### Requirement 14: Onboarding Flow

**User Story:** As a new salon owner, I want a guided onboarding experience, so that I can set up my salon quickly after signing up.

#### Acceptance Criteria

1. WHEN a new user signs up and has no Tenant record, THE System SHALL redirect to the onboarding flow
2. THE Onboarding_Flow SHALL collect: salon name, owner name, phone number, primary branch address, and at least one Service
3. WHEN the onboarding form is submitted, THE System SHALL create the Tenant, default Branch, owner Employee, and initial Services in a single transaction
4. THE Onboarding_Flow SHALL display a progress indicator showing completed and remaining steps
5. WHEN onboarding is complete, THE System SHALL redirect to the Dashboard with a welcome message
6. THE System SHALL allow the owner to skip optional steps (adding services) and complete them later from Settings

### Requirement 15: India-Specific Localization

**User Story:** As an Indian salon owner, I want the platform to use Indian formats and conventions, so that the system feels natural for my business context.

#### Acceptance Criteria

1. THE System SHALL display all monetary values in INR using the Indian numbering system (e.g., ₹1,50,000 not ₹150,000)
2. THE System SHALL format all dates in DD MMM YYYY format (e.g., 29 Apr 2026) and display times in 12-hour IST format
3. THE System SHALL validate phone numbers as 10-digit Indian mobile numbers (starting with 6-9) and store them with +91 prefix
4. THE System SHALL support UPI as a payment method option in the POS
5. WHERE GST is enabled for a Tenant, THE System SHALL calculate and display GST (at the configured rate) on invoices
6. THE System SHALL default the timezone to IST (Asia/Kolkata) for all date/time operations including cron schedules

### Requirement 16: Responsive Design and Error Handling

**User Story:** As a salon staff member, I want the dashboard to work on my phone and handle errors gracefully, so that I can manage the salon from any device without frustration.

#### Acceptance Criteria

1. THE System SHALL render all pages responsively down to 375px viewport width without horizontal scrolling
2. THE System SHALL display loading skeletons or spinners for all asynchronous data fetches
3. WHEN an API call fails, THE System SHALL display a toast notification with a user-friendly error message (not raw error codes)
4. THE System SHALL not produce console warnings or errors during normal operation
5. IF a page component throws an unhandled error, THEN THE System SHALL render an error boundary with a "Try Again" button instead of a blank screen
6. THE System SHALL not hardcode any tenant_id or branch_id values; all scoping SHALL be derived from the authenticated session

### Requirement 17: Database Schema and Migrations

**User Story:** As a developer, I want a well-structured PostgreSQL schema with proper constraints and triggers, so that data integrity is maintained at the database level.

#### Acceptance Criteria

1. THE Database SHALL contain tables for: tenants, branches, employees, customers, services, appointments, invoices, invoice_items, memberships, customer_memberships, whatsapp_sessions, audit_logs, and analytics_snapshots
2. THE Database SHALL enforce referential integrity via foreign keys between all related tables
3. THE Database SHALL implement auto-incrementing invoice numbers per branch using a PostgreSQL trigger
4. THE Database SHALL implement automatic customer stats updates (total_visits, total_spent) via triggers on invoice creation
5. THE Database SHALL implement automatic audit logging via triggers on INSERT, UPDATE, and DELETE operations on core tables
6. THE Database SHALL apply RLS policies on all tables enforcing tenant_id isolation and role-based row access
7. FOR ALL valid data objects, inserting then reading SHALL return an equivalent object (round-trip property for database operations)

### Requirement 18: Supabase Edge Functions

**User Story:** As a developer, I want reliable Edge Functions for background processing, so that WhatsApp messaging, analytics, and webhooks operate independently of the frontend.

#### Acceptance Criteria

1. THE whatsapp-webhook Edge_Function SHALL validate incoming Meta webhook signatures and route messages to appropriate handlers
2. THE whatsapp-flow-endpoint Edge_Function SHALL return dynamic slot data (services, stylists, dates, times) for WhatsApp_Flow screens
3. THE send-whatsapp-otp Edge_Function SHALL generate a 6-digit OTP, store it with a 5-minute TTL, and send it via Meta_Cloud_API
4. THE verify-whatsapp-otp Edge_Function SHALL validate the OTP against the stored value and return a Supabase auth token on success
5. THE appointment-reminders Edge_Function SHALL query appointments for the next day and send reminder messages via Meta_Cloud_API
6. THE follow-up-trigger Edge_Function SHALL query customers with last_visit older than 30 days and send follow-up messages
7. THE send-invoice Edge_Function SHALL generate a PDF, upload to Supabase Storage, and send the download link via WhatsApp
8. THE aggregate-analytics Edge_Function SHALL compute and store daily analytics snapshots for each Branch
9. THE razorpay-webhook Edge_Function SHALL validate Razorpay webhook signatures and update Tenant subscription status

### Requirement 19: TypeScript Type Safety

**User Story:** As a developer, I want comprehensive TypeScript types for all database tables and API responses, so that the codebase is type-safe and self-documenting.

#### Acceptance Criteria

1. THE Codebase SHALL define TypeScript interfaces for all 14 database tables matching the PostgreSQL schema exactly
2. THE Codebase SHALL define TypeScript types for all API request and response payloads
3. THE Codebase SHALL define TypeScript enums or union types for all status fields (appointment_status, invoice_status, membership_status, subscription_status)
4. THE Codebase SHALL use Supabase generated types (from the database schema) as the single source of truth for table types
5. THE Codebase SHALL not use `any` type except in explicitly justified edge cases with a comment explaining why
