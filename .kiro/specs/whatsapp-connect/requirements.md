# Requirements Document

## Introduction

PingFlow currently sends all WhatsApp messages (automations, OTPs, broadcasts, lead outreach) through a shared AiSensy API key managed by Pixalara. This feature replaces the AiSensy integration with a direct Meta WhatsApp Cloud API integration, allowing each gym owner to connect their own WhatsApp Business number via Meta's Embedded Signup flow. A dashboard card guides gym owners through the connection process and displays real-time status. Gyms that have not yet connected their own number fall back to Pixalara's default WhatsApp Business number so existing functionality is preserved.

## Glossary

- **Dashboard**: The main page displayed after a gym owner or employee logs in (`frontend/src/pages/Dashboard.tsx`)
- **WhatsApp_Connect_Card**: A UI card rendered on the Dashboard that displays WhatsApp connection status and provides the Embedded Signup flow entry point
- **Embedded_Signup**: Meta's JavaScript SDK-based popup flow that lets a business authorize a WhatsApp Business Account without leaving the host application
- **Meta_Cloud_API**: The WhatsApp Cloud API provided by Meta for sending and receiving WhatsApp messages directly
- **WABA**: WhatsApp Business Account — the Meta-level account that owns one or more WhatsApp phone numbers
- **Phone_Number_ID**: The Meta-assigned identifier for a specific WhatsApp phone number registered under a WABA
- **Access_Token**: A long-lived OAuth token issued by Meta that authorizes API calls on behalf of a WABA
- **WhatsApp_Config**: The Firestore document at `gyms/{gymId}/whatsappConfig/default` that stores a gym's Meta WhatsApp credentials and connection state
- **Connection_Status**: One of three values — `not_connected`, `pending`, or `live` — representing the gym's WhatsApp integration state
- **Gym_Admin**: A user with the `admin` role for a specific gym, identified by `gymId` matching `request.auth.uid`
- **Default_Number**: Pixalara's shared WhatsApp Business number used as a fallback when a gym has not connected their own number
- **Webhook_Endpoint**: An HTTP Cloud Function that receives inbound message and status callback events from Meta's WhatsApp platform
- **Token_Encryption**: AES-256-GCM encryption applied to access tokens before they are stored in Firestore
- **Message_Service**: The backend module (`functions/src/whatsapp/metaCloud.service.ts`) that sends WhatsApp messages via the Meta Cloud API
- **X-Hub-Signature-256**: An HMAC-SHA256 signature header sent by Meta on every webhook request, used to verify request authenticity

## Requirements

### Requirement 1: WhatsApp Config Firestore Schema

**User Story:** As a platform developer, I want a well-defined Firestore schema for WhatsApp configuration, so that each gym's Meta credentials and connection state are stored consistently and securely.

#### Acceptance Criteria

1. WHEN a gym connects a WhatsApp Business number, THE Message_Service SHALL create a WhatsApp_Config document at `gyms/{gymId}/whatsappConfig/default` containing the fields: `wabaId` (string), `phoneNumberId` (string), `accessToken` (string, encrypted), `phoneNumber` (string), `displayName` (string), `status` (string), `metaBusinessId` (string), and `connectedAt` (Firestore Timestamp)
2. THE WhatsApp_Config document SHALL restrict the `status` field to one of three values: `not_connected`, `pending`, or `live`
3. WHEN no WhatsApp_Config document exists for a gym, THE system SHALL treat the gym's Connection_Status as `not_connected`
4. THE WhatsApp_Config document SHALL store the `accessToken` field using Token_Encryption with AES-256-GCM before writing to Firestore

### Requirement 2: Connect WhatsApp Cloud Function

**User Story:** As a gym owner, I want to connect my WhatsApp Business number through Meta's Embedded Signup, so that my gym sends messages from its own branded number.

#### Acceptance Criteria

1. WHEN the `connectWhatsApp` Cloud Function receives a valid Meta authorization code from a Gym_Admin, THE Cloud Function SHALL exchange the code for a long-lived Access_Token using the Meta OAuth API
2. WHEN the token exchange succeeds, THE Cloud Function SHALL fetch the WABA details (wabaId, phoneNumberId, phoneNumber, displayName, metaBusinessId) from the Meta Cloud API
3. WHEN WABA details are retrieved, THE Cloud Function SHALL encrypt the Access_Token using AES-256-GCM with the TOKEN_ENCRYPTION_KEY environment variable and save all fields to the WhatsApp_Config document with `status` set to `live`
4. IF the Meta authorization code is invalid or expired, THEN THE Cloud Function SHALL return an error with code `invalid-argument` and a descriptive message
5. IF the token exchange or WABA detail fetch fails, THEN THE Cloud Function SHALL set the WhatsApp_Config `status` to `not_connected` and return an error with code `internal`
6. WHEN the `connectWhatsApp` function is called by a non-admin user, THE Cloud Function SHALL reject the request with error code `permission-denied`
7. WHEN a connection succeeds, THE Cloud Function SHALL log an audit event with `actionType` set to `WHATSAPP_CONNECTED` in the gym's `auditLogs` subcollection

### Requirement 3: Get WhatsApp Status Cloud Function

**User Story:** As a gym owner, I want to see my current WhatsApp connection status, so that I know whether my number is connected and active.

#### Acceptance Criteria

1. WHEN the `getWhatsAppStatus` Cloud Function is called by an authenticated user with a valid `gymId`, THE Cloud Function SHALL return the current Connection_Status, phoneNumber, and displayName from the WhatsApp_Config document
2. WHEN no WhatsApp_Config document exists for the specified gym, THE Cloud Function SHALL return `status` as `not_connected` with null values for phoneNumber and displayName
3. WHEN the `getWhatsAppStatus` function is called without authentication, THE Cloud Function SHALL reject the request with error code `unauthenticated`

### Requirement 4: Disconnect WhatsApp Cloud Function

**User Story:** As a gym owner, I want to disconnect my WhatsApp Business number, so that I can switch to a different number or revert to the default.

#### Acceptance Criteria

1. WHEN the `disconnectWhatsApp` Cloud Function is called by a Gym_Admin, THE Cloud Function SHALL delete the WhatsApp_Config document for the specified gym
2. WHEN the WhatsApp_Config document is deleted, THE Cloud Function SHALL log an audit event with `actionType` set to `WHATSAPP_DISCONNECTED` in the gym's `auditLogs` subcollection
3. WHEN the `disconnectWhatsApp` function is called by a non-admin user, THE Cloud Function SHALL reject the request with error code `permission-denied`
4. WHEN a gym disconnects, THE Message_Service SHALL fall back to the Default_Number for all subsequent messages sent by that gym

### Requirement 5: Send WhatsApp Message via Meta Cloud API

**User Story:** As a platform developer, I want a unified message-sending function that uses each gym's own credentials, so that all existing messaging features (automations, OTPs, broadcasts, lead outreach) work through the Meta Cloud API.

#### Acceptance Criteria

1. WHEN the `sendWhatsAppMessage` function is called with a `gymId`, THE Message_Service SHALL look up the gym's WhatsApp_Config document and decrypt the stored Access_Token
2. WHILE a gym's Connection_Status is `live`, THE Message_Service SHALL send messages using the gym's own Phone_Number_ID and decrypted Access_Token via the Meta Cloud API `POST /{phoneNumberId}/messages` endpoint
3. WHILE a gym's Connection_Status is `not_connected` or no WhatsApp_Config document exists, THE Message_Service SHALL send messages using the DEFAULT_PHONE_NUMBER_ID and DEFAULT_WA_ACCESS_TOKEN environment variables
4. WHEN a message is sent, THE Message_Service SHALL return an object containing `success` (boolean), `messageId` (string or null), and `error` (string or null)
5. IF the Meta Cloud API returns an HTTP error, THEN THE Message_Service SHALL return `success` as `false` with the error details from the API response
6. THE Message_Service SHALL format phone numbers by stripping non-digit characters and prepending country code `91` when the number has exactly 10 digits

### Requirement 6: WhatsApp Webhook Endpoint

**User Story:** As a platform developer, I want to receive inbound message and delivery status callbacks from Meta, so that PingFlow can process incoming messages and track delivery status.

#### Acceptance Criteria

1. WHEN the `whatsappWebhook` endpoint receives an HTTP GET request with `hub.mode` set to `subscribe` and `hub.verify_token` matching the WEBHOOK_VERIFY_TOKEN environment variable, THE Webhook_Endpoint SHALL respond with HTTP 200 and the `hub.challenge` value
2. WHEN the `whatsappWebhook` endpoint receives an HTTP GET request with an incorrect `hub.verify_token`, THE Webhook_Endpoint SHALL respond with HTTP 403
3. WHEN the `whatsappWebhook` endpoint receives an HTTP POST request, THE Webhook_Endpoint SHALL verify the X-Hub-Signature-256 header against the request body using the META_APP_SECRET environment variable
4. IF the X-Hub-Signature-256 verification fails, THEN THE Webhook_Endpoint SHALL respond with HTTP 401 and discard the request
5. WHEN a valid POST request contains message status updates (sent, delivered, read, failed), THE Webhook_Endpoint SHALL update the corresponding automation log document's `currentStatus` field in Firestore
6. THE Webhook_Endpoint SHALL respond with HTTP 200 to all valid POST requests within 5 seconds to prevent Meta from retrying the delivery

### Requirement 7: Replace AiSensy in Expiry Checker Automation

**User Story:** As a gym owner, I want my membership expiry reminders (D-3, D-0, D+2) to be sent through the Meta Cloud API, so that messages come from my own WhatsApp number.

#### Acceptance Criteria

1. WHEN the `dailyExpiryCheck` or `triggerAutomationManual` function sends an expiry reminder, THE function SHALL call the Message_Service `sendWhatsAppMessage` function instead of the AiSensy `sendTemplateMessage` function
2. THE expiry checker SHALL pass the gym's `gymId`, recipient phone number, template name, and template parameters to the Message_Service
3. WHEN the Message_Service returns a failure, THE expiry checker SHALL log the error in the member's `automationLogs` subcollection with `status` set to `FAILED`

### Requirement 8: Replace AiSensy in Inactivity Checker Automation

**User Story:** As a gym owner, I want my inactivity alerts (D-5, D-10) to be sent through the Meta Cloud API, so that messages come from my own WhatsApp number.

#### Acceptance Criteria

1. WHEN the `dailyInactivityCheck` function sends an inactivity alert, THE function SHALL call the Message_Service `sendWhatsAppMessage` function instead of the AiSensy `sendTemplateMessage` function
2. THE inactivity checker SHALL pass the gym's `gymId`, recipient phone number, template name, and template parameters to the Message_Service
3. WHEN the Message_Service returns a failure, THE inactivity checker SHALL log the error in the member's `automationLogs` subcollection with `status` set to `FAILED`

### Requirement 9: Replace AiSensy in Broadcast Messaging

**User Story:** As a gym owner, I want broadcast messages to be sent through the Meta Cloud API, so that members receive messages from my own WhatsApp number.

#### Acceptance Criteria

1. WHEN the `sendBroadcast` Cloud Function sends messages to recipients, THE function SHALL call the Message_Service `sendWhatsAppMessage` function instead of directly calling the AiSensy API
2. THE broadcast function SHALL pass the gym's `gymId` and each recipient's phone number to the Message_Service so that the correct credentials are resolved per gym
3. WHEN the Message_Service returns a failure for a recipient, THE broadcast function SHALL increment the `failed` counter and continue processing remaining recipients

### Requirement 10: Replace AiSensy in Lead WhatsApp Outreach

**User Story:** As a gym employee, I want lead WhatsApp messages to be sent through the Meta Cloud API, so that leads receive messages from the gym's own number.

#### Acceptance Criteria

1. WHEN the `sendLeadWhatsApp` Cloud Function sends a message to a lead, THE function SHALL call the Message_Service `sendWhatsAppMessage` function instead of directly calling the AiSensy API
2. THE lead WhatsApp function SHALL pass the gym's `gymId`, lead phone number, template name, and template parameters to the Message_Service

### Requirement 11: Replace AiSensy in OTP Verification

**User Story:** As a new user signing up, I want OTP messages to be sent through the Meta Cloud API, so that the verification flow uses the platform's direct WhatsApp integration.

#### Acceptance Criteria

1. WHEN the `triggerSignupVerification` function sends a WhatsApp OTP, THE function SHALL call the Message_Service `sendWhatsAppMessage` function using the Default_Number credentials instead of directly calling the AiSensy API
2. WHEN the `resendWhatsAppOTP` function resends an OTP, THE function SHALL call the Message_Service `sendWhatsAppMessage` function using the Default_Number credentials
3. WHEN the `sendWhatsAppOnlyOTP` function sends a WhatsApp-only OTP, THE function SHALL call the Message_Service `sendWhatsAppMessage` function using the Default_Number credentials
4. IF the Message_Service returns a failure during OTP sending, THEN THE OTP function SHALL log the error and continue without throwing (email OTP remains the primary verification channel)

### Requirement 12: Remove AiSensy Dependencies

**User Story:** As a platform developer, I want all AiSensy-specific code removed, so that the codebase has a single WhatsApp integration path through the Meta Cloud API.

#### Acceptance Criteria

1. WHEN the migration is complete, THE codebase SHALL contain no imports from `functions/src/whatsapp/aisensy.service.ts`
2. WHEN the migration is complete, THE codebase SHALL contain no references to the AiSensy API endpoint `https://backend.aisensy.com`
3. WHEN the migration is complete, THE codebase SHALL contain no references to the `AISENSY_API_KEY` environment variable
4. THE frontend service file `frontend/src/services/whatsapp.service.ts` SHALL remove the `sendInvoiceWhatsApp`, `sendPaymentReminder`, and `testAiSensyConnection` functions that directly call the AiSensy API
5. THE `functions/src/whatsapp/aisensy.service.ts` file SHALL be deleted from the codebase

### Requirement 13: WhatsApp Connect Dashboard Card

**User Story:** As a gym owner, I want to see a WhatsApp Connect card on my dashboard, so that I can connect my WhatsApp Business number and monitor its status.

#### Acceptance Criteria

1. THE WhatsApp_Connect_Card SHALL be rendered on the Dashboard page and be visible only to users with the Gym_Admin role
2. WHILE the Connection_Status is `not_connected`, THE WhatsApp_Connect_Card SHALL display a "Connect WhatsApp" button and a list of benefits (own number branding, direct message delivery, webhook-based status tracking)
3. WHEN the Gym_Admin clicks the "Connect WhatsApp" button, THE WhatsApp_Connect_Card SHALL launch the Meta Embedded_Signup popup using the Meta Facebook JS SDK with the META_APP_ID and META_CONFIG_ID configuration values
4. WHEN the Embedded_Signup popup returns an authorization code, THE WhatsApp_Connect_Card SHALL call the `connectWhatsApp` Cloud Function with the code and set the local Connection_Status to `pending`
5. WHILE the Connection_Status is `pending`, THE WhatsApp_Connect_Card SHALL display a progress indicator and the text "Connecting..."
6. WHILE the Connection_Status is `pending`, THE WhatsApp_Connect_Card SHALL poll the `getWhatsAppStatus` Cloud Function every 3 seconds until the status changes to `live` or `not_connected`
7. WHEN polling detects the Connection_Status has changed to `live`, THE WhatsApp_Connect_Card SHALL stop polling and display the connected state
8. WHILE the Connection_Status is `live`, THE WhatsApp_Connect_Card SHALL display the connected phone number, display name, and a "Disconnect" button
9. WHEN the Gym_Admin clicks the "Disconnect" button, THE WhatsApp_Connect_Card SHALL show a confirmation dialog before calling the `disconnectWhatsApp` Cloud Function
10. IF the Embedded_Signup popup is closed without completing authorization, THEN THE WhatsApp_Connect_Card SHALL remain in the `not_connected` state without showing an error

### Requirement 14: Environment Variable Configuration

**User Story:** As a platform developer, I want all Meta API credentials and configuration values stored as environment variables, so that secrets are not hardcoded in the source code.

#### Acceptance Criteria

1. THE Cloud Functions runtime SHALL read the following environment variables: `META_APP_ID`, `META_APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`, `DEFAULT_PHONE_NUMBER_ID`, `DEFAULT_WA_ACCESS_TOKEN`, `META_CONFIG_ID`, and `TOKEN_ENCRYPTION_KEY`
2. IF any required environment variable is missing when a Cloud Function starts, THEN THE Cloud Function SHALL return an error with code `failed-precondition` and a message identifying the missing variable
3. THE frontend application SHALL read `META_APP_ID` and `META_CONFIG_ID` from Vite environment variables prefixed with `VITE_` (i.e., `VITE_META_APP_ID` and `VITE_META_CONFIG_ID`)

### Requirement 15: Access Token Encryption

**User Story:** As a platform developer, I want access tokens encrypted at rest, so that a Firestore data breach does not expose gym owners' Meta API credentials.

#### Acceptance Criteria

1. WHEN an Access_Token is stored in Firestore, THE Message_Service SHALL encrypt the token using AES-256-GCM with the TOKEN_ENCRYPTION_KEY environment variable and a randomly generated 12-byte initialization vector
2. THE encrypted Access_Token field in Firestore SHALL store the IV and ciphertext concatenated as a single base64-encoded string
3. WHEN the Message_Service reads an Access_Token from Firestore, THE Message_Service SHALL decrypt the token using AES-256-GCM with the same TOKEN_ENCRYPTION_KEY and the stored IV
4. IF decryption fails due to a corrupted token or incorrect key, THEN THE Message_Service SHALL return an error and fall back to the Default_Number credentials

### Requirement 16: Webhook Signature Verification

**User Story:** As a platform developer, I want webhook requests verified using HMAC signatures, so that only authentic Meta callbacks are processed.

#### Acceptance Criteria

1. WHEN the Webhook_Endpoint receives an HTTP POST request, THE Webhook_Endpoint SHALL compute an HMAC-SHA256 digest of the raw request body using the META_APP_SECRET environment variable
2. THE Webhook_Endpoint SHALL compare the computed digest against the value in the X-Hub-Signature-256 header using a timing-safe comparison function
3. IF the computed digest does not match the X-Hub-Signature-256 header value, THEN THE Webhook_Endpoint SHALL respond with HTTP 401 and discard the request body

### Requirement 17: Admin-Only Access Control for Connection Management

**User Story:** As a gym owner, I want only admins to manage the WhatsApp connection, so that employees cannot accidentally disconnect or reconfigure the integration.

#### Acceptance Criteria

1. WHEN the `connectWhatsApp` Cloud Function is called, THE Cloud Function SHALL verify that `request.auth.uid` matches the `gymId` parameter (confirming Gym_Admin identity)
2. WHEN the `disconnectWhatsApp` Cloud Function is called, THE Cloud Function SHALL verify that `request.auth.uid` matches the `gymId` parameter
3. IF the caller's `request.auth.uid` does not match the `gymId`, THEN THE Cloud Function SHALL reject the request with error code `permission-denied` and the message "Admin only"
