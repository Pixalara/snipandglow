# Implementation Plan: Pro Plan WhatsApp Onboarding

## Overview

This plan completes the unfinished `dedicated` WhatsApp path so a Pro plan Tenant can connect its own
WhatsApp Business number. The work is built bottom-up from pure, dependency-free cores (encryption,
state machine) through services (token exchange, webhook subscription, credential store, logging,
redaction), then the orchestrating server actions, the tenant-router credential selection, and finally
the owner and admin UI. Each step builds on the previous one and ends by wiring the new code into the
existing webhook + sender path.

Property-based tests (`fast-check` under `vitest`, `node` environment, min 100 runs each) implement the
19 correctness properties from the design. Integration tests (mocked `fetch`) cover the external Meta
Graph API calls that the properties intentionally exclude. All test sub-tasks are marked optional (`*`).

Language: TypeScript (matches the existing `snipglow/` Next.js app and the design's concrete interfaces).

## Tasks

- [x] 1. Add onboarding schema migration
  - [x] 1.1 Create migration `025_whatsapp_onboarding_status.sql`
    - Add `onboarding_status TEXT NOT NULL DEFAULT 'not_started'` with a CHECK constraint over
      `('not_started','in_progress','connected','failed','disconnected')`, plus `onboarding_error TEXT`
      and `onboarding_updated_at TIMESTAMPTZ` to `tenant_whatsapp_settings` (use `ADD COLUMN IF NOT EXISTS`;
      alter no existing column)
    - Create the append-only `whatsapp_onboarding_events` table (`id`, `tenant_id` FK → `tenants` ON DELETE
      CASCADE, `status`, `reason`, `created_at`) and index `idx_wa_onboarding_events_tenant (tenant_id, created_at DESC)`
    - File: `supabase/migrations/025_whatsapp_onboarding_status.sql`
    - _Requirements: 4.4, 10.1, 10.4_

  - [x]* 1.2 Write schema smoke test for migrations 014 and 025
    - Assert migration `014` still declares the `tenant_id` unique index, and that `025` adds
      `onboarding_status` with its CHECK constraint and creates `whatsapp_onboarding_events`
    - File: `src/lib/whatsapp/migrations.test.ts`
    - _Requirements: 4.4_

- [x] 2. Implement token encryption module
  - [x] 2.1 Port AES-256-GCM `token-encryption.ts`
    - Port `encryptToken`/`decryptToken` verbatim from `functions/src/whatsapp/crypto.util.ts`: 12-byte
      random IV, 16-byte auth tag, 32-byte key from `TOKEN_ENCRYPTION_KEY` (64 hex), output
      `base64(IV ‖ ciphertext ‖ authTag)`; pure, no I/O; `decryptToken` throws on wrong key / tamper
    - File: `src/lib/crypto/token-encryption.ts`
    - _Requirements: 4.1, 4.6_

  - [x]* 2.2 Write property test for encryption round-trip
    - **Property 1: Access token encryption round-trip** — `decryptToken(encryptToken(t)) === t` and the
      ciphertext differs from the plaintext, over `fc.fullUnicodeString()` tokens
    - **Validates: Requirements 4.1, 4.6**
    - File: `src/lib/crypto/token-encryption.test.ts`

  - [x]* 2.3 Write property test for fail-closed decryption
    - **Property 2: Decryption fails closed on tampered or invalid ciphertext** — random/truncated/bit-flipped
      inputs (`fc.uint8Array()` → base64) cause `decryptToken` to throw rather than return a usable token
    - **Validates: Requirements 4.6, 6.4**
    - File: `src/lib/crypto/token-encryption.test.ts`

- [x] 3. Implement onboarding state machine and plan gating
  - [x] 3.1 Implement `onboarding-status.ts`
    - Define `OnboardingStatus`, `LEGAL_TRANSITIONS`, `canTransition(from, to)`, `controlsFor(status)`
      (`showConnect`/`showRetry`/`showDisconnect`/`showProgress`), `defaultStatus()` → `'not_started'`,
      a retry-transition helper that preserves valid prior progress, and a plan-gating helper that enables
      the connect action iff `plan_tier === 'pro'` and otherwise yields the upgrade prompt
    - File: `src/lib/whatsapp/onboarding-status.ts`
    - _Requirements: 1.2, 1.3, 1.4, 2.4, 7.3, 7.4, 7.5, 7.6, 8.1, 8.6, 10.5_

  - [x]* 3.2 Write property test for plan-tier gating
    - **Property 3: Plan-tier gating** — connect enabled iff tier is `pro`, else upgrade prompt, over
      `fc.constantFrom('trial','starter','pro')`
    - **Validates: Requirements 1.2, 1.3, 1.4**
    - File: `src/lib/whatsapp/onboarding-status.test.ts`

  - [x]* 3.3 Write property test for control derivation
    - **Property 11: Onboarding control derivation** — retry shown iff `failed`; disconnect shown iff
      `connected`; while `in_progress` progress is shown and connect is hidden
    - **Validates: Requirements 7.3, 7.4, 7.6, 8.1**
    - File: `src/lib/whatsapp/onboarding-status.test.ts`

  - [x]* 3.4 Write property test for transition legality
    - **Property 12: Onboarding transition legality** — `canTransition` permits exactly the legal edges and
      rejects all others, over all `(from, to)` status pairs
    - **Validates: Requirements 2.4, 7.5, 8.6**
    - File: `src/lib/whatsapp/onboarding-status.test.ts`

  - [x]* 3.5 Write property test for retry preserving progress
    - **Property 13: Retry preserves valid prior progress** — applying retry to a `failed` state with partial
      valid fields transitions to `in_progress` and keeps those fields
    - **Validates: Requirements 7.5**
    - File: `src/lib/whatsapp/onboarding-status.test.ts`

- [x] 4. Checkpoint - foundational modules
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement token exchange service
  - [x] 5.1 Implement `token-exchange.ts`
    - `validateAuthCode(code)` (non-empty, non-whitespace, well-formed); `exchangeCodeForToken(code)` calling
      the Meta Graph API via `WA_BASE_URL` with an `AbortController` 30s timeout; `fetchWabaDetails(token)`
      mapping `waba_id`/`phone_number_id`/`display_phone_number`; error reasons from Graph `error.message`/HTTP
      status only (never a token)
    - File: `src/lib/whatsapp/token-exchange.ts`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x]* 5.2 Write integration tests for token exchange (mocked fetch)
    - Valid code → exchange endpoint called with platform app credentials (3.1); mocked Graph response →
      `fetchWabaDetails` maps the three fields (3.2); delayed fetch + fake timers → abort at 30s returns a
      `timeout` reason (3.6)
    - File: `src/lib/whatsapp/token-exchange.test.ts`
    - _Requirements: 3.1, 3.2, 3.6_

- [x] 6. Implement webhook subscription service
  - [x] 6.1 Implement `webhook-subscription.ts`
    - `subscribeWaba(wabaId, token)` calling Graph API `{waba-id}/subscribed_apps` via `WA_BASE_URL`; returns a
      success/failure result with a token-free reason on error
    - File: `src/lib/whatsapp/webhook-subscription.ts`
    - _Requirements: 5.1_

  - [x]* 6.2 Write integration test for webhook subscription (mocked fetch)
    - Successful path calls `{waba-id}/subscribed_apps` with the token in the Authorization header
    - File: `src/lib/whatsapp/webhook-subscription.test.ts`
    - _Requirements: 5.1_

- [x] 7. Implement logging, credential store, and redaction
  - [x] 7.1 Implement `onboarding-log.ts`
    - `recordOnboardingEvent(tenantId, status, reason?)` appending one row to `whatsapp_onboarding_events`;
      best-effort try/catch that never throws and never includes a token in `reason`
    - File: `src/lib/whatsapp/onboarding-log.ts`
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 7.2 Implement `credential-store.ts`
    - `upsertDedicatedCredentials(...)` (one row per tenant: update existing, else insert),
      `clearDedicatedCredentials(...)` (null out `access_token_encrypted`, `phone_number_id`,
      `display_phone_number`), and `getSettings(tenantId)`, using `createAdminClient()`
    - File: `src/lib/whatsapp/credential-store.ts`
    - _Requirements: 4.2, 4.3, 4.5, 8.4_

  - [x] 7.3 Implement `redaction.ts` view mappers
    - Redaction-safe mappers for the admin view and server-action responses that omit both
      `access_token_encrypted` and any plaintext token from every returned shape
    - File: `src/lib/whatsapp/redaction.ts`
    - _Requirements: 4.7, 9.2, 10.3_

  - [x]* 7.4 Write property test for redaction
    - **Property 17: Tokens never leak through responses, admin view, or logged reasons** — for any settings
      row and any error reason, the redacted response, admin view mapping, and logged reason contain neither
      the plaintext token nor `access_token_encrypted`
    - **Validates: Requirements 4.7, 9.2, 10.3, 3.3**
    - File: `src/lib/whatsapp/redaction.test.ts`

- [x] 8. Checkpoint - services complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement onboarding server actions
  - [x] 9.1 Implement `assertProOwner` guard and `getOnboardingState`
    - Add the `'use server'` guard (SSR `createClient()` auth → owner role + Pro plan check, else
      `AuthorizationError`) and `getOnboardingState()` returning a redacted
      `{ status, mode, displayPhoneNumber, webhookStatus, errorReason, controls }`, defaulting to
      `not_started` when no row exists (via `getSettings` + `controlsFor` + redaction mapper)
    - File: `src/app/(dashboard)/dashboard/whatsapp/actions.ts`
    - _Requirements: 1.5, 1.6, 1.7, 7.1, 10.4, 10.5_

  - [x] 9.2 Implement `submitAuthCode` connect orchestration
    - Guard → set `in_progress` → `validateAuthCode` → `exchangeCodeForToken` → `fetchWabaDetails` →
      `encryptToken` → `upsertDedicatedCredentials` → `subscribeWaba`; on full success set
      `mode=dedicated`, `webhook_status=active`, `onboarding_status=connected`; on webhook failure set
      `webhook_status=inactive`, `onboarding_status=failed`, keep `mode=shared`; append an onboarding event
      and return a redacted result (never the token)
    - File: `src/app/(dashboard)/dashboard/whatsapp/actions.ts`
    - _Requirements: 2.4, 3.3, 4.1, 4.2, 4.7, 5.1, 5.2, 5.3, 5.4, 10.1_

  - [x] 9.3 Implement `retryOnboarding`
    - Allowed only from `failed`; transition to `in_progress` preserving valid prior progress and restart from
      the failed step
    - File: `src/app/(dashboard)/dashboard/whatsapp/actions.ts`
    - _Requirements: 7.5_

  - [x] 9.4 Implement `disconnectDedicated`
    - Single atomic `UPDATE` setting `mode=shared`, `onboarding_status=disconnected`,
      `webhook_status=inactive` and clearing `access_token_encrypted`/`phone_number_id`/`display_phone_number`;
      verify affected-row count and surface an error without partial state; append an onboarding event
    - File: `src/app/(dashboard)/dashboard/whatsapp/actions.ts`
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

  - [x]* 9.5 Write property test for authorization gating
    - **Property 4: Non-Pro / non-owner requests never exchange** — for any tier/role where tier ≠ `pro` or
      role ≠ `owner`, every action rejects with an authorization error, no exchange runs, no write occurs
      (`fc.constantFrom` tiers × roles; `fetch` mocked to assert no Graph call)
    - **Validates: Requirements 1.5, 1.6, 1.7**
    - File: `src/app/(dashboard)/dashboard/whatsapp/onboarding-actions.test.ts`

  - [x]* 9.6 Write property test for auth-code gating of the Graph call
    - **Property 5: Authorization-code validation gates the Graph API call** — for any code string the exchange
      is invoked iff validation succeeds (non-empty, non-whitespace, well-formed)
    - **Validates: Requirements 3.4, 3.5**
    - File: `src/app/(dashboard)/dashboard/whatsapp/onboarding-actions.test.ts`

  - [x]* 9.7 Write property test for connect outcome
    - **Property 6: Connect outcome is determined by storage and webhook results** — for any
      `(storageSucceeded, webhookSucceeded)` pair the final state is deterministic (both true →
      `dedicated`/`connected`/`active`; webhook not succeeded → `inactive`/`failed`/`shared`)
    - **Validates: Requirements 5.2, 5.3, 5.4**
    - File: `src/app/(dashboard)/dashboard/whatsapp/onboarding-actions.test.ts`

  - [x]* 9.8 Write property test for one-row-per-tenant upsert
    - **Property 14: At most one settings row per tenant** — for any sequence of upserts for one tenant the
      in-memory store ends with exactly one row (insert only when none exists, else update)
    - **Validates: Requirements 4.3, 4.5**
    - File: `src/app/(dashboard)/dashboard/whatsapp/onboarding-actions.test.ts`

  - [x]* 9.9 Write property test for disconnect end state
    - **Property 15: Disconnect produces the shared/cleared end state** — a successful disconnect yields
      `mode=shared`, `onboarding_status=disconnected`, `webhook_status=inactive`, and cleared credential fields
    - **Validates: Requirements 8.2, 8.4**
    - File: `src/app/(dashboard)/dashboard/whatsapp/onboarding-actions.test.ts`

  - [x]* 9.10 Write property test for disconnect atomicity
    - **Property 16: Disconnect is atomic (all-or-nothing)** — for any sub-step failure, stored `mode`,
      `onboarding_status`, `webhook_status`, and credential fields remain identical to their pre-disconnect values
    - **Validates: Requirements 8.3**
    - File: `src/app/(dashboard)/dashboard/whatsapp/onboarding-actions.test.ts`

  - [x]* 9.11 Write property test for event recording
    - **Property 18: Status transitions are recorded as events** — for any legal transition through the
      orchestrator, exactly one event is appended carrying tenant id, new status, and a timestamp
    - **Validates: Requirements 10.1**
    - File: `src/app/(dashboard)/dashboard/whatsapp/onboarding-actions.test.ts`

  - [x]* 9.12 Write property test for outcome persistence round-trip
    - **Property 19: Onboarding outcome persistence round-trip** — for any completed attempt, reading state
      afterward returns the same persisted status; reading with no row returns `not_started`
    - **Validates: Requirements 10.4, 10.5**
    - File: `src/app/(dashboard)/dashboard/whatsapp/onboarding-actions.test.ts`

- [x] 10. Checkpoint - orchestration complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Wire dedicated credential selection into the tenant router
  - [x] 11.1 Implement `resolveCredentials` and remove the placeholder TODOs
    - Add the `resolveCredentials(settings, platform, recordError)` helper that returns decrypted dedicated
      credentials only when `mode=dedicated` AND `onboarding_status=connected` AND the token decrypts, else
      falls back to platform credentials (null only when platform creds also missing) and records an error
      reason; route inbound dedicated matching on `phone_number_id` but require `connected`; delegate both the
      `resolveTenant` dedicated branch and `getCredentialsForTenant` to it (replacing both `getPlatformCredentials`
      placeholders / `TODO: Decrypt`)
    - File: `src/lib/whatsapp/tenant-router.ts`
    - _Requirements: 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 8.5_

  - [x]* 11.2 Write property test for not-connected routing
    - **Property 7: Not-connected tenants route through shared credentials** — for any settings whose status is
      not `connected`, the router selects platform credentials
    - **Validates: Requirements 5.5, 8.5, 6.5**
    - File: `src/lib/whatsapp/tenant-router.test.ts`

  - [x]* 11.3 Write property test for connected dedicated routing
    - **Property 8: Connected dedicated tenants route through decrypted dedicated credentials** — for any token,
      a connected `dedicated` row returns credentials whose `accessToken` equals the original and whose
      `phoneNumberId`/`businessAccountId` equal the stored `phone_number_id`/`waba_id`
    - **Validates: Requirements 6.1, 6.2**
    - File: `src/lib/whatsapp/tenant-router.test.ts`

  - [x]* 11.4 Write property test for decryption-failure fallback
    - **Property 9: Decryption failure falls back to shared and records an error** — a connected dedicated row
      with an undecryptable token returns platform credentials (or null when none) and records an error reason
    - **Validates: Requirements 6.4, 6.5**
    - File: `src/lib/whatsapp/tenant-router.test.ts`

  - [x]* 11.5 Write property test for inbound routing by phone number id
    - **Property 10: Inbound routing by dedicated phone number id** — for any connected dedicated settings, an
      inbound webhook whose `phone_number_id` matches resolves to that row's tenant
    - **Validates: Requirements 6.3**
    - File: `src/lib/whatsapp/tenant-router.test.ts`

- [x] 12. Build owner onboarding UI
  - [x] 12.1 Wire `whatsapp-client.tsx` to server-driven status
    - On mount call `getOnboardingState()`; render by status using `controlsFor`: `connected` → show
      `display_phone_number` + confirmation; `failed` → show `errorReason` + Retry; `in_progress` → progress
      indicator with connect hidden; `connected` → Disconnect; gate connect vs upgrade prompt by plan tier;
      after Embedded Signup returns a code call `submitAuthCode(code)`; on cancel/SDK-not-ready show a message
      and submit nothing
    - File: `src/app/(dashboard)/dashboard/whatsapp/whatsapp-client.tsx`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.5, 7.1, 7.2, 7.3, 7.6, 8.1_

  - [x]* 12.2 Write unit tests for owner UI branches
    - Plan read before render (1.1); `FB.login` config (2.1); success callback submits code (2.2);
      cancel / SDK-not-ready submits nothing (2.3, 2.5); status, connected number + confirmation, and failed
      error text render correctly (7.1, 7.2, 7.3)
    - File: `src/app/(dashboard)/dashboard/whatsapp/whatsapp-client.test.tsx`
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.5, 7.1, 7.2, 7.3_

- [x] 13. Extend admin visibility
  - [x] 13.1 Extend the admin "WhatsApp Settings" section
    - In `admin/tenants/[id]/page.tsx`, render `mode`, `onboarding_status`, `display_phone_number`, and
      `webhook_status` via the redaction-safe view mapper (omitting `access_token_encrypted` and any plaintext);
      show "Dedicated WhatsApp not configured" when no row exists; keep audit logging via the existing
      `logAdminAction` (already swallows failures so the page still renders)
    - File: `src/app/admin/tenants/[id]/page.tsx`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x]* 13.2 Write unit tests for the admin view
    - Mode/status/number/webhook exposed (9.1); "not configured" empty state (9.3)
    - File: `src/app/admin/tenants/[id]/page.test.tsx`
    - _Requirements: 9.1, 9.3_

- [x] 14. Final checkpoint - full suite green
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; core implementation
  tasks are never optional.
- Each task references specific requirement clauses for traceability, and each property task references its
  design property number plus the requirements it validates.
- Property tests use `fast-check` under `vitest` (`node` env, min 100 runs); the Supabase client is replaced by
  an in-memory fake honoring the one-row-per-tenant constraint, `fetch` is mocked for any Meta path, and
  `TOKEN_ENCRYPTION_KEY` is a fixed 64-hex test key.
- Integration tests (tasks 5.2, 6.2) cover the external Graph API calls that the properties intentionally exclude.
- Checkpoints (tasks 4, 8, 10, 14) provide incremental validation between layers.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "5.1", "6.1", "7.1", "7.2", "7.3"] },
    { "id": 1, "tasks": ["1.2", "2.2", "3.2", "5.2", "6.2", "7.4", "11.1", "9.1", "13.1"] },
    { "id": 2, "tasks": ["2.3", "3.3", "11.2", "9.2", "13.2"] },
    { "id": 3, "tasks": ["3.4", "11.3", "9.3"] },
    { "id": 4, "tasks": ["3.5", "11.4", "9.4"] },
    { "id": 5, "tasks": ["11.5", "9.5", "12.1"] },
    { "id": 6, "tasks": ["9.6", "12.2"] },
    { "id": 7, "tasks": ["9.7"] },
    { "id": 8, "tasks": ["9.8"] },
    { "id": 9, "tasks": ["9.9"] },
    { "id": 10, "tasks": ["9.10"] },
    { "id": 11, "tasks": ["9.11"] },
    { "id": 12, "tasks": ["9.12"] }
  ]
}
```
