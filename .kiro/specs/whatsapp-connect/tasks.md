# Implementation Plan: WhatsApp Connect

## Overview

Migrate PingFlow from AiSensy-based WhatsApp messaging to a direct Meta WhatsApp Cloud API integration. Each gym owner connects their own WhatsApp Business number via Meta's Embedded Signup flow. Gyms without a connected number fall back to Pixalara's shared default number. The implementation proceeds bottom-up: crypto utilities → message service → connection management → webhook → migration of all existing callers → frontend card → cleanup.

## Tasks

- [x] 1. Create crypto utility and environment variable scaffolding
  - [x] 1.1 Add environment variable placeholders to `functions/.env` and `frontend/.env.local`
    - Add `META_APP_ID`, `META_APP_SECRET`, `WEBHOOK_VERIFY_TOKEN`, `DEFAULT_PHONE_NUMBER_ID`, `DEFAULT_WA_ACCESS_TOKEN`, `TOKEN_ENCRYPTION_KEY`, `META_CONFIG_ID` to `functions/.env`
    - Add `VITE_META_APP_ID` and `VITE_META_CONFIG_ID` to `frontend/.env.local`
    - _Requirements: 14.1, 14.3_

  - [x] 1.2 Create `functions/src/whatsapp/crypto.util.ts` with `encryptToken` and `decryptToken`
    - Use Node.js built-in `crypto` module (no new dependencies)
    - AES-256-GCM with 12-byte random IV, 16-byte auth tag
    - Key from `TOKEN_ENCRYPTION_KEY` env var (32-byte hex string → 64 hex chars)
    - Storage format: `base64(IV[12] + ciphertext[N] + authTag[16])`
    - `encryptToken(plaintext: string): string` returns base64 encoded
    - `decryptToken(encrypted: string): string` returns original plaintext, throws on failure
    - _Requirements: 1.4, 15.1, 15.2, 15.3_

  - [ ]* 1.3 Write property tests for crypto utility (`functions/src/whatsapp/__tests__/crypto.util.test.ts`)
    - Install `fast-check` as a dev dependency in `functions/`
    - **Property 1: Token encryption round-trip** — For any valid string, `decryptToken(encryptToken(s)) === s` and encrypted output is valid base64 not containing plaintext
    - **Validates: Requirements 1.4, 15.1, 15.2, 15.3**
    - **Property 2: Encryption non-determinism** — For any string, two calls to `encryptToken` produce different ciphertexts that both decrypt to the original
    - **Validates: Requirements 15.1**

- [x] 2. Implement Meta Cloud API message service
  - [x] 2.1 Create `functions/src/whatsapp/metaCloud.service.ts` with `sendWhatsAppMessage`
    - Signature: `sendWhatsAppMessage(gymId, phoneNumber, templateName, templateParams, languageCode?)` → `Promise<SendMessageResult>`
    - Look up `gyms/{gymId}/whatsappConfig/default` from Firestore
    - If `status === "live"`, decrypt token via `crypto.util.ts` and use gym's `phoneNumberId`
    - If no config, status !== "live", or decryption fails → fall back to `DEFAULT_PHONE_NUMBER_ID` and `DEFAULT_WA_ACCESS_TOKEN` env vars
    - Special case: `gymId === '__default__'` skips config lookup, uses default credentials directly
    - Format phone: strip non-digits, prepend `91` if exactly 10 digits
    - POST to `https://graph.facebook.com/v21.0/{phoneNumberId}/messages` with template payload
    - Return `{ success: boolean, messageId: string | null, error: string | null }`
    - Never throw — always return a result object
    - Check for missing env vars and return `failed-precondition` style error
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 14.2, 15.4_

  - [ ]* 2.2 Write property tests for message service (`functions/src/whatsapp/__tests__/metaCloud.service.test.ts`)
    - **Property 4: Credential resolution by connection status** — Mock Firestore configs (present/absent, live/not_connected/pending) and verify correct credentials are used
    - **Validates: Requirements 4.4, 5.1, 5.2, 5.3, 15.4**
    - **Property 5: Phone number formatting** — For any phone string, result contains only digits; 10-digit inputs get `91` prefix; others pass through digits unchanged
    - **Validates: Requirements 5.6**
    - **Property 6: Message result shape invariant** — For any input, result has `success`, `messageId`, `error`; when success=true, messageId is non-null and error is null; when success=false, error is non-null
    - **Validates: Requirements 5.4**

- [x] 3. Checkpoint — Verify core service builds
  - Ensure `cd functions && npm run build` succeeds with no errors. Ask the user if questions arise.

- [x] 4. Implement connection management Cloud Functions
  - [x] 4.1 Create `functions/src/whatsapp/whatsappConnect.ts` with `connectWhatsApp`, `getWhatsAppStatus`, and `disconnectWhatsApp`
    - `connectWhatsApp` (onCall, asia-south1): verify `request.auth.uid === gymId`, exchange Meta auth code for long-lived token via `POST https://graph.facebook.com/v21.0/oauth/access_token`, fetch WABA details, encrypt token, write to `gyms/{gymId}/whatsappConfig/default` with `status: "live"`, log audit event `WHATSAPP_CONNECTED`
    - `getWhatsAppStatus` (onCall, asia-south1): verify authenticated, read whatsappConfig, return `{ status, phoneNumber, displayName }` or `{ status: "not_connected", phoneNumber: null, displayName: null }` if no doc
    - `disconnectWhatsApp` (onCall, asia-south1): verify `request.auth.uid === gymId`, delete whatsappConfig doc, log audit event `WHATSAPP_DISCONNECTED`
    - Return proper `HttpsError` codes: `unauthenticated`, `permission-denied`, `invalid-argument`, `internal`, `failed-precondition`
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 14.2, 17.1, 17.2, 17.3_

  - [ ]* 4.2 Write property tests for connection management (`functions/src/whatsapp/__tests__/whatsappConnect.test.ts`)
    - **Property 3: Admin-only access control** — For any `(callerUid, gymId)` where `callerUid !== gymId`, connectWhatsApp and disconnectWhatsApp reject with `permission-denied`
    - **Validates: Requirements 2.6, 4.3, 17.1, 17.2, 17.3**
    - **Property 10: Connection status field constraint** — After any sequence of connect/disconnect operations, the status field is always one of `not_connected`, `pending`, or `live`
    - **Validates: Requirements 1.2**

  - [ ]* 4.3 Write unit tests for connection management (`functions/src/whatsapp/__tests__/whatsappConnect.unit.test.ts`)
    - Test `connectWhatsApp` with valid code (mocked Meta API) → stores encrypted token, status=live, audit log
    - Test `connectWhatsApp` with invalid code → returns `invalid-argument`
    - Test `connectWhatsApp` with Meta API failure → sets status to `not_connected`, returns `internal`
    - Test `getWhatsAppStatus` with no config → returns `not_connected`
    - Test `getWhatsAppStatus` without auth → returns `unauthenticated`
    - Test `disconnectWhatsApp` deletes config + creates audit log
    - _Requirements: 2.1–2.7, 3.1–3.3, 4.1–4.3_

- [x] 5. Implement webhook endpoint
  - [x] 5.1 Create `functions/src/whatsapp/webhook.ts` with `whatsappWebhook` HTTP function
    - Use `onRequest` (not `onCall`) with `region: 'asia-south1'`
    - GET handler: verify `hub.mode === "subscribe"` and `hub.verify_token === WEBHOOK_VERIFY_TOKEN`, respond with `hub.challenge` (HTTP 200) or HTTP 403
    - POST handler: verify `X-Hub-Signature-256` using HMAC-SHA256 with `META_APP_SECRET` and `crypto.timingSafeEqual`; respond HTTP 401 if invalid
    - Parse `entry[].changes[].value.statuses[]` for message status updates
    - Map Meta status (`sent`→`Sent`, `delivered`→`Delivered`, `read`→`Read`, `failed`→`Failed`) and update matching automation log doc's `currentStatus` field
    - Always respond HTTP 200 to valid POST requests (prevent Meta retries)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 16.1, 16.2, 16.3_

  - [ ]* 5.2 Write property tests for webhook (`functions/src/whatsapp/__tests__/webhook.test.ts`)
    - **Property 7: Webhook verification echoes challenge** — For any random challenge string, GET with correct verify_token returns HTTP 200 + challenge; wrong token returns HTTP 403
    - **Validates: Requirements 6.1, 6.2**
    - **Property 8: Webhook signature validation** — For any body and secret, POST is accepted (HTTP 200) iff X-Hub-Signature-256 matches HMAC-SHA256 digest; otherwise HTTP 401
    - **Validates: Requirements 6.3, 6.4, 16.1, 16.2, 16.3**

- [x] 6. Export new functions and update Firestore rules
  - [x] 6.1 Update `functions/src/index.ts` to export new Cloud Functions
    - Add exports for `connectWhatsApp`, `getWhatsAppStatus`, `disconnectWhatsApp` from `./whatsapp/whatsappConnect`
    - Add export for `whatsappWebhook` from `./whatsapp/webhook`
    - Remove the `sendTemplateMessage` import from `./whatsapp/aisensy.service` used by `testWhatsAppDelivery`
    - Update `testWhatsAppDelivery` to use `sendWhatsAppMessage` from `./whatsapp/metaCloud.service`
    - Update `syncMessageStatuses` to remove AiSensy references (keep function for backward compat but note webhook replaces it)
    - _Requirements: 12.1, 12.3_

  - [x] 6.2 Add Firestore security rules for `whatsappConfig` subcollection
    - Add rule at `gyms/{gymId}/whatsappConfig/{docId}`: `allow read: if isAdmin(gymId); allow write: if false;`
    - Cloud Functions use Admin SDK which bypasses rules
    - _Requirements: 1.1 (schema), 17.1 (access control)_

- [x] 7. Checkpoint — Verify all new modules build and deploy
  - Ensure `cd functions && npm run build` succeeds. Ensure Firestore rules are valid. Ask the user if questions arise.

- [x] 8. Migrate expiry checker from AiSensy to Meta Cloud API
  - [x] 8.1 Update `functions/src/automation/expiryChecker.ts` to use `sendWhatsAppMessage`
    - Replace `import { sendTemplateMessage } from '../whatsapp/aisensy.service'` with `import { sendWhatsAppMessage } from '../whatsapp/metaCloud.service'`
    - Replace all `sendTemplateMessage(gymId, phone, campaignName, name, params)` calls with `sendWhatsAppMessage(gymId, phone, campaignName, params)`
    - Update result handling: `sendWhatsAppMessage` returns `{ success, messageId, error }` — store `messageId` in automation log
    - Log `FAILED` status when `success === false`
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 9. Migrate inactivity checker from AiSensy to Meta Cloud API
  - [x] 9.1 Update `functions/src/automation/inactivityChecker.ts` to use `sendWhatsAppMessage`
    - Replace `import { sendTemplateMessage } from '../whatsapp/aisensy.service'` with `import { sendWhatsAppMessage } from '../whatsapp/metaCloud.service'`
    - Replace `sendTemplateMessage(gymId, phone, campaignName, name, params)` with `sendWhatsAppMessage(gymId, phone, campaignName, params)`
    - Update result handling to use `{ success, messageId, error }` shape
    - Log `FAILED` status when `success === false`
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 10. Migrate broadcast from AiSensy to Meta Cloud API
  - [x] 10.1 Update `functions/src/broadcast/sendBroadcast.ts` to use `sendWhatsAppMessage`
    - Remove direct `fetch(AISENSY_API, ...)` calls and `AISENSY_API` constant
    - Remove `process.env.AISENSY_API_KEY` usage
    - Import and call `sendWhatsAppMessage(gymId, phone, 'pingflow_broadcast', [message])` for each recipient
    - Increment `failed` counter when `sendWhatsAppMessage` returns `success: false`, continue processing remaining recipients
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ]* 10.2 Write property test for broadcast failure resilience (`functions/src/broadcast/__tests__/sendBroadcast.test.ts`)
    - **Property 9: Broadcast failure resilience** — For any list of recipients with random success/failure patterns, all recipients are attempted and `failed` count equals the number of failures
    - **Validates: Requirements 9.3**

- [x] 11. Migrate lead WhatsApp from AiSensy to Meta Cloud API
  - [x] 11.1 Update `functions/src/whatsapp/sendLeadWhatsApp.ts` to use `sendWhatsAppMessage`
    - Remove direct `fetch(AISENSY_API, ...)` call and `AISENSY_API` constant
    - Remove `process.env.AISENSY_API_KEY` usage
    - Import and call `sendWhatsAppMessage(gymId, phone, templateName, [leadName, gymName])`
    - _Requirements: 10.1, 10.2_

- [x] 12. Migrate OTP verification from AiSensy to Meta Cloud API
  - [x] 12.1 Update `functions/src/auth/otpVerification.ts` to use `sendWhatsAppMessage`
    - Remove `AISENSY_API` constant and all direct `fetch(AISENSY_API, ...)` calls (4 places: `triggerSignupVerification`, `resendWhatsAppOTP`, `sendWhatsAppOnlyOTP`)
    - Remove `process.env.AISENSY_API_KEY` usage
    - Import `sendWhatsAppMessage` from `../whatsapp/metaCloud.service`
    - Call `sendWhatsAppMessage('__default__', cleanPhone, 'pingflow_otp_verification', [otp])` for all OTP sends (uses default Pixalara number since no gym exists yet)
    - If `sendWhatsAppMessage` returns `success: false`, log the error but do NOT throw (email OTP is primary)
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 13. Checkpoint — Verify all backend migrations build
  - Ensure `cd functions && npm run build` succeeds with no errors. All AiSensy imports should be gone from migrated files. Ask the user if questions arise.

- [x] 14. Remove AiSensy dependencies and delete service file
  - [x] 14.1 Delete `functions/src/whatsapp/aisensy.service.ts`
    - Verify no remaining imports reference this file across the entire `functions/src/` directory
    - _Requirements: 12.1, 12.5_

  - [x] 14.2 Clean up any remaining AiSensy references in the codebase
    - Remove `AISENSY_API_KEY` from `functions/.env`
    - Verify no file in `functions/src/` references `https://backend.aisensy.com`
    - Verify no file references `AISENSY_API_KEY`
    - _Requirements: 12.1, 12.2, 12.3_

- [x] 15. Implement frontend WhatsApp types and service functions
  - [x] 15.1 Add WhatsApp types to `frontend/src/types/index.ts`
    - Add `WhatsAppConnectionStatus = 'not_connected' | 'pending' | 'live'`
    - Add `WhatsAppStatus` interface with `status`, `phoneNumber`, `displayName`
    - _Requirements: 1.2, 3.1_

  - [x] 15.2 Update `frontend/src/services/whatsapp.service.ts`
    - Remove `sendInvoiceWhatsApp`, `sendPaymentReminder`, `testAiSensyConnection` functions and the `AISENSY_API` constant and `AiSensyPayload` interface
    - Add `connectWhatsApp(gymId, code)` → calls `httpsCallable(functions, 'connectWhatsApp')`
    - Add `getWhatsAppStatus(gymId)` → calls `httpsCallable(functions, 'getWhatsAppStatus')`
    - Add `disconnectWhatsApp(gymId)` → calls `httpsCallable(functions, 'disconnectWhatsApp')`
    - Keep existing `triggerManualAutomation`, `syncMessageStatuses`, `generateAIBroadcast` functions
    - _Requirements: 12.4, 13.3, 13.4, 13.9_

- [x] 16. Implement WhatsApp Connect Dashboard Card
  - [x] 16.1 Create `frontend/src/components/ui/WhatsAppConnectCard.tsx`
    - Visible only to users with admin role (use `useRole` hook)
    - Read `gymId` from `useAuthStore`
    - Three states based on `WhatsAppConnectionStatus`:
      - `not_connected`: Show benefits list (own number branding, direct delivery, webhook status tracking) + "Connect WhatsApp" button
      - `pending`: Show spinner + "Connecting..." text, poll `getWhatsAppStatus` every 3 seconds until status changes
      - `live`: Show connected phone number, display name, "Disconnect" button
    - On "Connect" click: load Meta JS SDK (`https://connect.facebook.net/en_US/sdk.js`), call `FB.init({ appId: VITE_META_APP_ID })`, then `FB.login(callback, { config_id: VITE_META_CONFIG_ID, response_type: 'code', override_default_response_type: true })`
    - On auth code received: call `connectWhatsApp` Cloud Function, set local status to `pending`
    - On "Disconnect" click: show confirmation dialog, then call `disconnectWhatsApp` Cloud Function
    - If popup closed without completing: stay in `not_connected`, no error
    - If Meta JS SDK fails to load: disable "Connect" button with tooltip
    - Match existing Dashboard card styling (white background, `#E2E8F0` border, `14px` border-radius, Outfit font)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10_

  - [x] 16.2 Add `WhatsAppConnectCard` to `frontend/src/pages/Dashboard.tsx`
    - Import and render `WhatsAppConnectCard` in the Dashboard, visible only to admin users
    - Place it between the revenue row and the branch comparison / bottom widgets section
    - _Requirements: 13.1_

- [x] 17. Checkpoint — Verify frontend builds
  - Ensure `cd frontend && npm run build` succeeds with no errors. Ask the user if questions arise.

- [x] 18. Final verification and cleanup
  - [x] 18.1 Verify no AiSensy references remain in the entire codebase
    - Search for `aisensy` (case-insensitive) across all `functions/src/` and `frontend/src/` files
    - Search for `AISENSY` across all source files
    - Search for `backend.aisensy.com` across all source files
    - Confirm `functions/src/whatsapp/aisensy.service.ts` is deleted
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 18.2 Verify both projects build successfully
    - Run `cd functions && npm run build` — must succeed
    - Run `cd frontend && npm run build` — must succeed
    - _Requirements: all_

- [x] 19. Final checkpoint — Ensure all builds pass
  - Ensure all tests pass, both `functions` and `frontend` build without errors. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major phase
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `__default__` gymId convention for OTP messages avoids unnecessary Firestore lookups during signup
- Environment variable placeholders use empty values — actual secrets must be configured before deployment
- The `testWhatsAppDelivery` and `syncMessageStatuses` functions in `index.ts` are updated for backward compatibility but may be deprecated later as the webhook replaces polling
