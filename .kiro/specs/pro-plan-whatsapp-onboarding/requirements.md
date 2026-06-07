# Requirements Document

## Introduction

SnipandGlow is a multi-tenant salon management SaaS built on Next.js and Supabase. Today every tenant (salon) sends and receives WhatsApp messages through a single shared, platform-owned WhatsApp Business number (phone_number_id `1165461446644735`), with per-message tenant resolution handled by the WhatsApp Router. The Pro plan (₹999/mo, billed yearly, single branch) promises each salon its OWN WhatsApp Business API number instead of the shared one.

This feature defines how a salon owner opts into the Pro plan and gets a dedicated WhatsApp Business API number connected — in a way that generates revenue immediately and is secure, WITHOUT requiring SnipandGlow to be an approved Meta Business Solution Provider (BSP) yet. The interim approach is **assisted (manual) onboarding**: the salon owner expresses intent and pays for Pro, the SnipandGlow platform team performs the Meta WhatsApp Business API setup on the salon's behalf, then securely stores the salon's dedicated `phone_number_id`, `waba_id`, and access token (encrypted at rest) in the existing `tenant_whatsapp_settings` table with `mode='dedicated'`. Once a salon is connected, all of that salon's outbound WhatsApp messages and inbound webhook handling route through the salon's own number and credentials instead of the shared number, with strict multi-tenant isolation.

Full self-serve Meta Embedded Signup (which requires approved BSP / Tech Provider status) is explicitly a future phase and is out of scope for this feature (see Requirement 9).

## Glossary

- **Salon_Owner**: An authenticated dashboard user who owns or administers a single tenant (salon).
- **Platform_Admin**: A SnipandGlow staff user whose email is listed in the `PLATFORM_ADMIN_EMAILS` environment variable; the only role permitted to view or modify dedicated WhatsApp credentials. Authorization is enforced by `requireAdmin`.
- **Tenant**: A salon account, represented by a row in the `tenants` table and identified by `tenant_id`.
- **Pro_Plan**: The subscription tier priced at ₹999 per month billed yearly, covering a single branch and a dedicated WhatsApp Business API number. Represented by `tenants.plan_tier = 'pro'`.
- **Plan_Tier**: The `tenants.plan_tier` column, constrained to one of `'starter'`, `'pro'`, or `'enterprise'`.
- **Subscription_Status**: The `tenants.subscription_status` column, constrained to one of `'trial'`, `'active'`, `'past_due'`, `'expired'`, or `'cancelled'`.
- **Pro_Upgrade_Request**: A persisted record capturing a Salon_Owner's intent to upgrade to the Pro_Plan, used by the SnipandGlow team as a work ticket for assisted onboarding.
- **WhatsApp_Settings**: A row in the `tenant_whatsapp_settings` table for a given Tenant, containing `mode`, `phone_number_id`, `waba_id`, `access_token_encrypted`, `display_phone_number`, `booking_slug`, `display_name_status`, and `webhook_status`.
- **Connection_Mode**: The `tenant_whatsapp_settings.mode` value, one of `'shared'` or `'dedicated'`.
- **WhatsApp_Connection_Status**: A derived status describing a Tenant's dedicated WhatsApp setup, one of `not_connected`, `pending`, or `connected`.
- **Dedicated_Credentials**: The set of values `phone_number_id`, `waba_id`, and access token that authorize WhatsApp Cloud API calls for a single Tenant's own number.
- **Access_Token**: A Meta WhatsApp Cloud API token authorizing message sends on behalf of a WABA.
- **Encrypted_Token**: An Access_Token encrypted at rest with AES-256-GCM and stored in `tenant_whatsapp_settings.access_token_encrypted`.
- **Token_Encryption_Key**: A 32-byte key supplied via the `TOKEN_ENCRYPTION_KEY` environment variable, used to encrypt and decrypt the Access_Token.
- **WhatsApp_Router**: The server module (`src/lib/whatsapp/tenant-router.ts`) that resolves a Tenant and returns the credentials to use for a WhatsApp interaction.
- **Webhook_Endpoint**: The inbound WhatsApp webhook handler (`src/app/api/whatsapp/webhook/route.ts`) that receives Meta message and status callbacks.
- **Shared_Number**: The platform-owned WhatsApp number (phone_number_id `1165461446644735`) used in `'shared'` Connection_Mode.
- **Platform_Credentials**: The Shared_Number credentials returned by `getPlatformCredentials()`.
- **Outbound_Message**: Any WhatsApp message SnipandGlow sends on behalf of a Tenant, including booking confirmation, appointment reminder, bill receipt, feedback request, owner alert, and OTP.
- **Admin_Audit_Log**: A record written via `logAdminAction` to the `admin_audit_logs` table capturing a Platform_Admin action.
- **WhatsApp_Onboarding_Panel**: The Platform_Admin-only interface, on the admin tenant detail page, for viewing WhatsApp_Connection_Status and setting or rotating Dedicated_Credentials.

## Requirements

### Requirement 1: Pro Plan Opt-In from the Dashboard

**User Story:** As a Salon_Owner, I want to request an upgrade to the Pro plan from my dashboard, so that the SnipandGlow team can begin connecting my own WhatsApp Business number.

#### Acceptance Criteria

1. WHERE a Salon_Owner's Plan_Tier is not `'pro'`, THE Dashboard SHALL display a Pro_Plan upgrade option that states the price as ₹999 per month billed yearly and lists "own WhatsApp Business API number" and "single branch" as included.
2. WHEN a Salon_Owner submits a Pro_Plan upgrade request, THE System SHALL create a Pro_Upgrade_Request record associated with the Salon_Owner's `tenant_id` and a status of `requested`.
3. WHEN a Pro_Upgrade_Request record is created, THE System SHALL record the requesting `tenant_id`, the request timestamp, and the Salon_Owner's contact phone number.
4. WHEN the System successfully creates a Pro_Upgrade_Request, THE System SHALL display a confirmation message stating that the SnipandGlow team will contact the Salon_Owner to complete WhatsApp setup.
5. IF the System fails to create a Pro_Upgrade_Request, THEN THE System SHALL display an error message and SHALL NOT display the confirmation message.
6. IF a Salon_Owner submits a Pro_Plan upgrade request while a Pro_Upgrade_Request with status `requested` or `in_progress` already exists for that `tenant_id`, THEN THE System SHALL retain the existing Pro_Upgrade_Request and display its current status instead of creating a duplicate record.
7. WHERE a Salon_Owner's Plan_Tier is `'pro'`, THE Dashboard SHALL display the current Pro_Plan status instead of the upgrade option.

### Requirement 2: Pro Upgrade Request Visibility for the Platform Team

**User Story:** As a Platform_Admin, I want to see incoming Pro plan requests, so that I can perform the assisted WhatsApp onboarding for each salon.

#### Acceptance Criteria

1. WHEN a Platform_Admin opens the Pro_Upgrade_Request list, THE System SHALL display every Pro_Upgrade_Request with its `tenant_id`, salon name, contact phone number, request timestamp, and current status.
2. WHEN a Platform_Admin changes the status of a Pro_Upgrade_Request, THE System SHALL persist the new status as one of `requested`, `in_progress`, `completed`, or `cancelled`.
3. WHEN a Platform_Admin changes the status of a Pro_Upgrade_Request, THE System SHALL write an Admin_Audit_Log entry recording the Platform_Admin email, the `tenant_id`, and the new status.
4. IF a non-admin user requests the Pro_Upgrade_Request list, THEN THE System SHALL deny access and redirect the user away from the admin area.

### Requirement 3: Pro Plan Activation

**User Story:** As a Platform_Admin, I want to activate the Pro plan for a salon after payment, so that the salon's plan reflects its paid Pro subscription.

#### Acceptance Criteria

1. WHEN a Platform_Admin activates the Pro_Plan for a Tenant, THE System SHALL set that Tenant's Plan_Tier to `'pro'`.
2. WHEN a Platform_Admin activates the Pro_Plan for a Tenant, THE System SHALL set that Tenant's Subscription_Status to `'active'`.
3. WHEN a Platform_Admin activates the Pro_Plan for a Tenant, THE System SHALL record the subscription start date and a subscription end date set to one year after the start date.
4. WHEN a Platform_Admin activates the Pro_Plan for a Tenant, THE System SHALL write an Admin_Audit_Log entry recording the Platform_Admin email, the `tenant_id`, and the action `activate_pro_plan`.
5. IF a user who is not a Platform_Admin attempts to activate the Pro_Plan for a Tenant, THEN THE System SHALL deny the request.
6. THE System SHALL store Pro_Plan activation data using the existing `tenants` columns (`plan_tier`, `subscription_status`, `subscription_start`, `subscription_end`, `razorpay_subscription_id`, `razorpay_customer_id`) so that a future automated payment integration can set the same fields without schema change.

### Requirement 4: Secure Dedicated WhatsApp Credential Onboarding

**User Story:** As a Platform_Admin, I want to securely enter a salon's dedicated WhatsApp credentials, so that the salon's own number is connected without exposing the access token.

#### Acceptance Criteria

1. WHEN a Platform_Admin submits Dedicated_Credentials for a Tenant, THE System SHALL persist the `phone_number_id` and `waba_id` to that Tenant's WhatsApp_Settings and set Connection_Mode to `'dedicated'`.
2. WHEN a Platform_Admin submits an Access_Token for a Tenant, THE System SHALL encrypt the Access_Token with AES-256-GCM using the Token_Encryption_Key before writing it, and SHALL store only the resulting Encrypted_Token in `access_token_encrypted`.
3. THE System SHALL store the Access_Token only as an Encrypted_Token and SHALL NOT persist the Access_Token in plaintext in the database, logs, or Admin_Audit_Log metadata.
4. WHEN the System decrypts an Encrypted_Token, THE System SHALL use AES-256-GCM with the Token_Encryption_Key and the initialization vector stored with the Encrypted_Token.
5. IF decryption of an Encrypted_Token fails, THEN THE System SHALL treat the Tenant as not having usable Dedicated_Credentials and SHALL NOT send the Tenant's messages through the Shared_Number as a silent substitute for the dedicated number.
6. WHEN a Platform_Admin submits new Dedicated_Credentials for a Tenant that already has an Encrypted_Token, THE System SHALL replace the stored Encrypted_Token with the newly encrypted Access_Token.
7. IF a user who is not a Platform_Admin attempts to view, create, or rotate any Tenant's Dedicated_Credentials, THEN THE System SHALL deny the request.
8. WHEN a Platform_Admin displays a Tenant's WhatsApp_Settings, THE System SHALL present the Access_Token only as a masked indicator of whether a token is stored, and SHALL NOT display the decrypted Access_Token value.
9. IF a Token_Encryption_Key is not configured when a Platform_Admin submits an Access_Token, THEN THE System SHALL reject the submission with an error identifying the missing Token_Encryption_Key and SHALL NOT store the Access_Token.

### Requirement 5: Credential Change Auditing

**User Story:** As a Platform_Admin, I want every credential change recorded, so that there is an auditable history of who connected or rotated a salon's WhatsApp credentials.

#### Acceptance Criteria

1. WHEN a Platform_Admin creates Dedicated_Credentials for a Tenant, THE System SHALL write an Admin_Audit_Log entry recording the Platform_Admin email, the `tenant_id`, the `phone_number_id`, and the action `set_whatsapp_credentials`.
2. WHEN a Platform_Admin rotates a Tenant's Access_Token, THE System SHALL write an Admin_Audit_Log entry recording the Platform_Admin email, the `tenant_id`, and the action `rotate_whatsapp_token`.
3. WHEN a Platform_Admin changes a Tenant's Connection_Mode, THE System SHALL write an Admin_Audit_Log entry recording the Platform_Admin email, the `tenant_id`, and the resulting Connection_Mode.
4. THE Admin_Audit_Log entries for credential changes SHALL exclude the plaintext Access_Token and the Encrypted_Token from their metadata.

### Requirement 6: Dedicated Routing for Outbound Messages

**User Story:** As a Salon_Owner on the Pro plan, I want all of my salon's WhatsApp messages sent from my own number, so that my customers see my salon's branded WhatsApp number.

#### Acceptance Criteria

1. WHILE a Tenant's Connection_Mode is `'dedicated'` and a usable Encrypted_Token is stored, THE System SHALL send that Tenant's Outbound_Messages using the Tenant's `phone_number_id`, `waba_id`, and decrypted Access_Token.
2. WHILE a Tenant's Connection_Mode is `'shared'`, THE System SHALL send that Tenant's Outbound_Messages using the Platform_Credentials.
3. THE System SHALL resolve credentials per Tenant for every Outbound_Message type, including booking confirmation, appointment reminder, bill receipt, feedback request, owner alert, and OTP.
4. WHEN the System sends an Outbound_Message for a Tenant whose Connection_Mode is `'dedicated'`, THE System SHALL use only that Tenant's Dedicated_Credentials and SHALL NOT use another Tenant's Dedicated_Credentials or the Platform_Credentials.
5. IF a Tenant's Connection_Mode is `'dedicated'` but no usable Encrypted_Token can be decrypted, THEN THE System SHALL withhold the Outbound_Message and record a delivery failure for that Tenant rather than sending from the Shared_Number.

### Requirement 7: Per-Tenant Inbound Webhook Routing

**User Story:** As a Salon_Owner on the Pro plan, I want messages my customers send to my dedicated number to reach only my salon, so that customer conversations stay isolated to my salon.

#### Acceptance Criteria

1. WHEN the Webhook_Endpoint receives an inbound message whose `phone_number_id` matches a Tenant's dedicated `phone_number_id`, THE WhatsApp_Router SHALL resolve the interaction to exactly that Tenant.
2. WHEN the Webhook_Endpoint receives an inbound message on a dedicated `phone_number_id`, THE System SHALL reply using the same Tenant's Dedicated_Credentials.
3. IF an inbound message arrives on a `phone_number_id` that matches no Tenant's WhatsApp_Settings and is not the Shared_Number, THEN THE System SHALL NOT attribute the message to any Tenant.
4. WHEN the Webhook_Endpoint receives an inbound message on the Shared_Number, THE WhatsApp_Router SHALL resolve the Tenant using the existing shared-mode resolution and SHALL NOT route the message to a Tenant solely because that Tenant has dedicated `phone_number_id`.
5. WHEN the Webhook_Endpoint logs an inbound message that has been resolved to a Tenant, THE System SHALL associate the log entry with that Tenant's `tenant_id`.

### Requirement 8: WhatsApp Connection Status Visibility

**User Story:** As a Platform_Admin, I want to see each salon's Pro and WhatsApp connection status, so that I can track which salons are fully onboarded.

#### Acceptance Criteria

1. WHEN a Platform_Admin views a Tenant's WhatsApp_Onboarding_Panel, THE System SHALL display the WhatsApp_Connection_Status as `not_connected`, `pending`, or `connected`.
2. WHERE a Tenant has no WhatsApp_Settings or Connection_Mode is `'shared'`, THE System SHALL display the WhatsApp_Connection_Status as `not_connected`.
3. WHERE a Tenant has Connection_Mode `'dedicated'` and a `phone_number_id` but no stored Encrypted_Token, THE System SHALL display the WhatsApp_Connection_Status as `pending`.
4. WHERE a Tenant has Connection_Mode `'dedicated'`, a `phone_number_id`, and a stored Encrypted_Token, THE System SHALL display the WhatsApp_Connection_Status as `connected`.
5. WHEN a Platform_Admin views a Tenant's WhatsApp_Onboarding_Panel, THE System SHALL display the Tenant's Plan_Tier and Subscription_Status.
6. WHEN a Platform_Admin views a Tenant's WhatsApp_Onboarding_Panel for a connected Tenant, THE System SHALL display the `display_phone_number`, `phone_number_id`, and `waba_id` and SHALL display the Access_Token only as a masked indicator.

### Requirement 9: Scope Boundary — Assisted Onboarding Only

**User Story:** As the platform owner, I want this phase limited to secure assisted onboarding, so that we earn Pro revenue now without waiting for Meta BSP approval.

#### Acceptance Criteria

1. THE System SHALL connect a Tenant's dedicated WhatsApp number only through Platform_Admin entry of Dedicated_Credentials.
2. THE System SHALL NOT require SnipandGlow to hold approved Meta BSP or Tech Provider status to connect a Tenant's dedicated WhatsApp number in this phase.
3. WHERE a Salon_Owner is not a Platform_Admin, THE System SHALL NOT expose a self-serve Meta Embedded Signup flow for connecting Dedicated_Credentials in this phase.
4. THE System SHALL preserve the existing `tenant_whatsapp_settings` schema fields (`mode`, `phone_number_id`, `waba_id`, `access_token_encrypted`, `display_phone_number`, `display_name_status`, `webhook_status`, `booking_slug`) so that a future self-serve Embedded Signup phase can populate the same fields without schema change.
