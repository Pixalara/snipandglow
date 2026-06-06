# Requirements Document

## Introduction

This feature delivers a guided onboarding flow that lets a Pro plan salon (tenant) connect its own
dedicated WhatsApp Business number to Snip and Glow, replacing the shared platform number. Today the
platform supports two WhatsApp delivery modes — `shared` (the Snip and Glow platform number, routed by
booking slug or customer session) and `dedicated` (the tenant's own number via Meta Embedded Signup) —
but the dedicated path is an unfinished stub: the Embedded Signup dialog only logs the returned
authorization code and never persists credentials, the tenant router has a `TODO` to decrypt the
access token and falls back to platform credentials, and there is no plan-tier gating or onboarding
status tracking.

The Pro Plan WhatsApp Onboarding feature closes these gaps. It restricts dedicated-number onboarding to
Pro plan tenants, runs Meta's Embedded Signup, exchanges the returned authorization code for a long-lived
access token, securely stores the encrypted credentials and WhatsApp Business Account (WABA) details,
subscribes the tenant's number to the platform webhook, tracks onboarding progress through clear states,
and switches outbound message delivery to the tenant's dedicated number once verified. The feature also
provides the salon owner with a step-by-step UI showing current status, errors, and the ability to retry
or disconnect, and gives platform admins visibility into each tenant's dedicated WhatsApp configuration.

This document defines the behavior the system SHALL exhibit. Implementation choices (encryption library,
UI framework specifics) are deferred to the design phase.

## Glossary

- **Tenant**: A salon account in the multi-tenant Snip and Glow platform, identified by `tenant_id`.
- **Owner**: The authenticated user with the `owner` role for a Tenant who performs onboarding.
- **Admin**: A platform staff user authenticated through the admin auth guard, with cross-tenant visibility.
- **Plan_Tier**: The Tenant subscription level, one of `trial`, `starter`, or `pro`, stored as `tenants.plan_tier`.
- **Pro_Tenant**: A Tenant whose `plan_tier` equals `pro`.
- **Onboarding_System**: The server-side and client-side components that implement this feature's onboarding flow.
- **Embedded_Signup**: Meta's WhatsApp Embedded Signup browser flow that returns an authorization `code` after the Owner authorizes the platform's Meta app.
- **Token_Exchange_Service**: The server-side component that exchanges an Embedded Signup authorization code for a long-lived WhatsApp access token via the Meta Graph API.
- **WABA**: WhatsApp Business Account, identified by `waba_id`, owned by the Tenant under Meta.
- **Phone_Number_Id**: The Meta-assigned identifier for a WhatsApp business phone number, stored as `phone_number_id`.
- **Dedicated_Mode**: The delivery mode in which a Tenant's outbound WhatsApp messages are sent from the Tenant's own connected number using the Tenant's credentials.
- **Shared_Mode**: The delivery mode in which a Tenant's WhatsApp messages are sent from the platform's shared number.
- **WhatsApp_Settings**: A row in the `tenant_whatsapp_settings` table holding a Tenant's WhatsApp configuration (mode, slug, WABA fields, encrypted token, status fields).
- **Credential_Store**: The persistence mechanism that stores the encrypted dedicated access token (`access_token_encrypted`) and associated WABA fields.
- **Onboarding_Status**: The state of a Tenant's dedicated WhatsApp onboarding, one of `not_started`, `in_progress`, `connected`, `failed`, or `disconnected`.
- **Webhook_Subscription**: The registration of the Tenant's WABA to the platform's Meta webhook so inbound messages route to the platform.
- **Tenant_Router**: The existing component (`src/lib/whatsapp/tenant-router.ts`) that resolves which Tenant an inbound message belongs to and selects credentials for outbound messages.
- **Encryption_Service**: The server-side component that encrypts and decrypts the dedicated access token at rest.

## Requirements

### Requirement 1: Restrict Dedicated Onboarding to Pro Plan

**User Story:** As a platform operator, I want dedicated WhatsApp onboarding to be available only to Pro plan salons, so that the paid "Free WhatsApp API Setup" benefit is correctly entitled.

#### Acceptance Criteria

1. WHEN an Owner opens the dedicated WhatsApp onboarding entry point, THE Onboarding_System SHALL read the Tenant's Plan_Tier before rendering the connect action.
2. WHILE the Tenant Plan_Tier equals `pro`, THE Onboarding_System SHALL display the dedicated number connect action as enabled.
3. IF the Tenant Plan_Tier is `starter` or `trial`, THEN THE Onboarding_System SHALL display an upgrade prompt instead of the connect action.
4. WHILE the Tenant Plan_Tier equals `pro`, THE Onboarding_System SHALL display the connect action rather than an upgrade prompt.
5. IF a non-Pro Tenant submits a dedicated onboarding request to the server, THEN THE Onboarding_System SHALL reject the request with an authorization error and SHALL NOT initiate Embedded_Signup token exchange.
6. IF the requesting Tenant Plan_Tier is not `pro`, THEN THE Token_Exchange_Service SHALL NOT perform a token exchange regardless of other validation outcomes.
7. WHEN the server processes any dedicated onboarding server action, THE Onboarding_System SHALL verify that the requesting user holds the `owner` role for the target Tenant before performing the action.

### Requirement 2: Initiate Meta Embedded Signup

**User Story:** As a Pro salon Owner, I want to start connecting my own WhatsApp Business number through a guided dialog, so that my salon's messages come from my own number.

#### Acceptance Criteria

1. WHEN a Pro_Tenant Owner activates the connect action, THE Onboarding_System SHALL launch the Meta Embedded_Signup flow configured with the platform Meta app identifier and configuration identifier.
2. WHEN Embedded_Signup completes successfully in the browser, THE Onboarding_System SHALL receive an authorization code and SHALL transmit the authorization code to the server over an authenticated request.
3. IF the Owner cancels or closes Embedded_Signup before completion, THEN THE Onboarding_System SHALL leave the Onboarding_Status unchanged and SHALL display a cancellation message.
4. WHEN the authorization code is received by the server, THE Onboarding_System SHALL set the Tenant Onboarding_Status to `in_progress`.
5. IF the Meta SDK required for Embedded_Signup has not finished loading when the Owner activates the connect action, THEN THE Onboarding_System SHALL display a message indicating the connect flow is not yet ready and SHALL NOT submit an empty authorization code.

### Requirement 3: Exchange Authorization Code for Access Token

**User Story:** As a Pro salon Owner, I want the system to securely obtain a long-lived access token after I authorize, so that my number can send messages without me re-authorizing.

#### Acceptance Criteria

1. WHEN the server receives a valid authorization code for a Pro_Tenant, THE Token_Exchange_Service SHALL call the Meta Graph API to exchange the authorization code for a long-lived WhatsApp access token.
2. WHEN the Token_Exchange_Service obtains an access token, THE Onboarding_System SHALL retrieve the associated WABA identifier, Phone_Number_Id, and display phone number from the Meta Graph API.
3. IF the Token_Exchange_Service receives an error response from the Meta Graph API, THEN THE Onboarding_System SHALL set the Tenant Onboarding_Status to `failed` and SHALL record a descriptive error reason.
4. IF the authorization code is missing, empty, or malformed, THEN THE Onboarding_System SHALL return a validation error and SHALL NOT call the Meta Graph API.
5. WHEN the authorization code is present and well-formed for a Pro_Tenant, THE Onboarding_System SHALL proceed with validation and the Meta Graph API token exchange.
6. WHEN the Token_Exchange_Service completes within the request, THE Onboarding_System SHALL respond within 30 seconds or return a timeout error reason.

### Requirement 4: Encrypt and Store Dedicated Credentials

**User Story:** As a platform operator, I want each salon's WhatsApp access token stored encrypted at rest, so that a database exposure does not leak usable credentials.

#### Acceptance Criteria

1. WHEN a long-lived access token is obtained, THE Encryption_Service SHALL encrypt the access token before persistence.
2. WHEN credentials are persisted, THE Credential_Store SHALL store the encrypted access token in `tenant_whatsapp_settings.access_token_encrypted`, the WABA identifier in `waba_id`, the Phone_Number_Id in `phone_number_id`, and the display phone number in `display_phone_number` for the target Tenant.
3. THE Credential_Store SHALL store at most one WhatsApp_Settings row per Tenant.
4. THE Credential_Store SHALL enforce the one-row-per-Tenant constraint with a database-level uniqueness constraint on `tenant_id`.
5. WHEN credentials are persisted for a Tenant that already has a WhatsApp_Settings row, THE Credential_Store SHALL update the existing row rather than create a duplicate.
6. WHEN the Encryption_Service encrypts then decrypts a stored access token, THE Encryption_Service SHALL return a plaintext token equal to the original access token (round-trip property).
7. WHEN persisting the encrypted token, THE Onboarding_System SHALL store the value such that the plaintext access token is excluded from application logs and server action responses.

### Requirement 5: Subscribe Webhook and Activate Dedicated Mode

**User Story:** As a Pro salon Owner, I want my connected number to start receiving and sending messages through the platform, so that customer conversations flow into my dashboard.

#### Acceptance Criteria

1. WHEN credentials for a Tenant are stored successfully, THE Onboarding_System SHALL register the Tenant WABA to the platform Webhook_Subscription.
2. WHEN the Webhook_Subscription succeeds, THE Onboarding_System SHALL set the WhatsApp_Settings `webhook_status` to `active`.
3. WHEN the Webhook_Subscription and credential storage both succeed, THE Onboarding_System SHALL set the WhatsApp_Settings `mode` to `dedicated` and the Onboarding_Status to `connected`.
4. IF the Webhook_Subscription fails, THEN THE Onboarding_System SHALL set the WhatsApp_Settings `webhook_status` to `inactive`, set the Onboarding_Status to `failed`, and SHALL keep the Tenant in Shared_Mode.
5. WHILE a Tenant Onboarding_Status is not `connected`, THE Tenant_Router SHALL resolve that Tenant's outbound messages using Shared_Mode credentials.

### Requirement 6: Route Outbound Messages Through the Dedicated Number

**User Story:** As a salon customer, I want messages from a connected salon to come from that salon's own WhatsApp number, so that the conversation is clearly branded and consistent.

#### Acceptance Criteria

1. WHILE a Tenant WhatsApp_Settings `mode` equals `dedicated` and Onboarding_Status equals `connected`, THE Tenant_Router SHALL select the Tenant's decrypted dedicated credentials for outbound messages.
2. WHEN the Tenant_Router selects dedicated credentials, THE Encryption_Service SHALL decrypt the stored access token for use in the outbound request.
3. WHEN an inbound webhook message arrives with a Phone_Number_Id that matches a Tenant's stored dedicated Phone_Number_Id, THE Tenant_Router SHALL resolve the message to that Tenant.
4. IF decryption of a Tenant's stored access token fails, THEN THE Tenant_Router SHALL fall back to Shared_Mode credentials and SHALL record an error reason for the Tenant, including when the Shared_Mode fallback also fails.
5. WHERE platform credentials are required for Shared_Mode fallback, THE Tenant_Router SHALL use the platform credentials returned by the existing platform credential provider.

### Requirement 7: Display Onboarding Status and Controls to the Owner

**User Story:** As a Pro salon Owner, I want to see the current connection status and clear next steps, so that I know whether my number is connected and what to do if something fails.

#### Acceptance Criteria

1. WHEN an Owner opens the WhatsApp onboarding page, THE Onboarding_System SHALL display the current Onboarding_Status for the Tenant.
2. WHILE the Onboarding_Status equals `connected`, THE Onboarding_System SHALL display the connected display phone number and a confirmation that messages are sent from the Tenant's own number.
3. WHILE the Onboarding_Status equals `failed`, THE Onboarding_System SHALL display the recorded error reason and a retry action.
4. WHILE the Onboarding_Status is any value other than `failed`, THE Onboarding_System SHALL NOT display a retry action.
5. WHEN an Owner activates the retry action after a `failed` status, THE Onboarding_System SHALL restart the onboarding flow from the failed step and SHALL preserve valid progress from the previous attempt.
6. WHILE the Onboarding_Status equals `in_progress`, THE Onboarding_System SHALL display a progress indicator and SHALL NOT present a duplicate connect action that starts a second concurrent Embedded_Signup.

### Requirement 8: Disconnect the Dedicated Number

**User Story:** As a Pro salon Owner, I want to disconnect my dedicated number, so that I can revert to the shared number or re-onboard a different number.

#### Acceptance Criteria

1. WHILE the Onboarding_Status equals `connected`, THE Onboarding_System SHALL display a disconnect action to the Owner.
2. WHEN an Owner confirms the disconnect action, THE Onboarding_System SHALL set the WhatsApp_Settings `mode` to `shared`, set the Onboarding_Status to `disconnected`, and set `webhook_status` to `inactive` as a single atomic update.
3. IF any field update within the disconnect operation fails, THEN THE Onboarding_System SHALL roll back the operation so that none of the three fields change.
4. WHEN a Tenant is disconnected, THE Credential_Store SHALL clear the stored encrypted access token, `phone_number_id`, and `display_phone_number` for that Tenant.
5. WHEN a Tenant is disconnected, THE Tenant_Router SHALL resolve that Tenant's subsequent outbound messages using Shared_Mode credentials.
6. WHEN an Owner re-initiates onboarding after a `disconnected` status, THE Onboarding_System SHALL allow a new Embedded_Signup flow to proceed.

### Requirement 9: Admin Visibility of Dedicated WhatsApp Configuration

**User Story:** As a platform Admin, I want to view each Tenant's dedicated WhatsApp onboarding status, so that I can support salons and audit connected numbers.

#### Acceptance Criteria

1. WHEN an Admin views a Tenant detail page, THE Onboarding_System SHALL display the Tenant's WhatsApp_Settings mode, Onboarding_Status, display phone number, and webhook status.
2. THE Onboarding_System SHALL exclude the plaintext and encrypted access token values from the Admin-facing display.
3. WHEN a Tenant has no WhatsApp_Settings row, THE Onboarding_System SHALL display an indication that dedicated WhatsApp is not configured.
4. WHEN an Admin views the Tenant detail page, THE Onboarding_System SHALL record an admin audit log entry for the view action consistent with existing admin audit behavior.
5. IF recording the admin audit log entry fails, THEN THE Onboarding_System SHALL still render the Tenant detail page successfully.

### Requirement 10: Audit and Error Logging of Onboarding Events

**User Story:** As a platform operator, I want onboarding lifecycle events recorded, so that I can diagnose failures and verify successful connections.

#### Acceptance Criteria

1. WHEN the Onboarding_Status transitions between states, THE Onboarding_System SHALL record a log entry containing the Tenant identifier, the new Onboarding_Status, and a timestamp.
2. IF recording a status-transition log entry fails, THEN THE Onboarding_System SHALL continue the onboarding operation without aborting it.
3. IF a Meta Graph API call fails during onboarding, THEN THE Onboarding_System SHALL record a log entry containing the failure reason without including the plaintext access token.
4. WHEN a dedicated onboarding attempt completes with status `connected` or `failed`, THE Onboarding_System SHALL persist the outcome so it is retrievable on the next page load.
5. WHEN an Owner opens the onboarding page before any attempt has completed, THE Onboarding_System SHALL return a retrievable Onboarding_Status, defaulting to `not_started` when no prior outcome exists.
