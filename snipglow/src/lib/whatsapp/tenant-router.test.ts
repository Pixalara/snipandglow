// =============================================================================
// Property-based tests for dedicated credential selection in the WhatsApp
// tenant router (src/lib/whatsapp/tenant-router.ts).
//
// Framework: vitest + fast-check (node env, min 100 runs each).
// Properties implemented here (from design "Correctness Properties"):
//   - Property 7:  Not-connected tenants route through shared credentials
//   - Property 8:  Connected dedicated tenants route through decrypted
//                  dedicated credentials
//   - Property 9:  Decryption failure falls back to shared and records an error
//   - Property 10: Inbound routing by dedicated phone number id
//
// Isolation strategy (per design Testing Strategy):
//   - The Supabase admin client is replaced with an in-memory fake that serves
//     the rows the router queries (chainable .from().select().eq().single()).
//   - TOKEN_ENCRYPTION_KEY is a fixed 64-hex test key so encrypt/decrypt work.
//   - Platform credentials are controlled via env so we can test both the
//     "platform creds present" and "platform creds missing" (null) cases.
//
// NOTE: the async predicates use fc.asyncProperty with `await fc.assert(...)`
// so each iteration runs sequentially against the shared in-memory store
// (avoids the concurrency hazard of fc.property + async callbacks).
// =============================================================================

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

// ---------------------------------------------------------------------------
// Environment: set BEFORE importing modules that read env at call time.
// ---------------------------------------------------------------------------
const TEST_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// The shared platform phone number id (matches config.ts PLATFORM_PHONE_NUMBER_ID).
const SHARED_PHONE_NUMBER_ID = '1165461446644735';
const PLATFORM_ACCESS_TOKEN = 'platform-access-token';
const PLATFORM_WABA_ID = '1245944267357075';

process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
process.env.META_WHATSAPP_ACCESS_TOKEN = PLATFORM_ACCESS_TOKEN;
process.env.META_WHATSAPP_PHONE_NUMBER_ID = SHARED_PHONE_NUMBER_ID;
process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID = PLATFORM_WABA_ID;

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
  process.env.META_WHATSAPP_ACCESS_TOKEN = PLATFORM_ACCESS_TOKEN;
  process.env.META_WHATSAPP_PHONE_NUMBER_ID = SHARED_PHONE_NUMBER_ID;
  process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID = PLATFORM_WABA_ID;
});

// ---------------------------------------------------------------------------
// In-memory Supabase fake. `store` is hoisted so the vi.mock factory (which is
// itself hoisted to the top of the module) can close over it. Each test resets
// `store.tables` to the rows it needs the router to read.
// ---------------------------------------------------------------------------
const { store } = vi.hoisted(() => ({
  store: { tables: {} as Record<string, Record<string, unknown>[]> },
}));

vi.mock('@/lib/supabase/admin', () => {
  // Return the first row in `table` that matches all collected equality filters.
  function matchOne(
    table: string,
    filters: [string, unknown][],
  ): Record<string, unknown> | null {
    const rows = store.tables[table] ?? [];
    const found = rows.find((row) =>
      filters.every(([col, val]) => row[col] === val),
    );
    return found ?? null;
  }

  function makeQuery(table: string) {
    const filters: [string, unknown][] = [];
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return builder;
      },
      ilike: () => builder,
      gt: () => builder,
      order: () => builder,
      limit: () => builder,
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => builder,
      delete: () => builder,
      single: () =>
        Promise.resolve({ data: matchOne(table, filters), error: null }),
      maybeSingle: () =>
        Promise.resolve({ data: matchOne(table, filters), error: null }),
    };
    return builder;
  }

  return {
    createAdminClient: () => ({
      from: (table: string) => makeQuery(table),
    }),
  };
});

import { decryptToken, encryptToken } from '@/lib/crypto/token-encryption';
import {
  getCredentialsForTenant,
  resolveTenant,
} from '@/lib/whatsapp/tenant-router';

const NON_CONNECTED_STATUSES = [
  'not_started',
  'in_progress',
  'failed',
  'disconnected',
] as const;

// Dedicated phone-number-id generator that can never collide with the shared id.
const dedicatedPhoneIdArb = fc
  .string({ minLength: 1 })
  .map((s) => `ded-${s}`)
  .filter((id) => id !== SHARED_PHONE_NUMBER_ID);

beforeEach(() => {
  store.tables = {};
  // Default platform creds present unless a test overrides.
  process.env.META_WHATSAPP_ACCESS_TOKEN = PLATFORM_ACCESS_TOKEN;
});

// ---------------------------------------------------------------------------
// Property 7: Not-connected tenants route through shared credentials
// ---------------------------------------------------------------------------
// Feature: pro-plan-whatsapp-onboarding, Property 7: For any WhatsApp_Settings whose onboarding_status is not 'connected' (including 'not_started', 'in_progress', 'failed', and 'disconnected'), the Tenant_Router selects the platform (Shared_Mode) credentials for outbound messages.
describe('Property 7: Not-connected tenants route through shared credentials', () => {
  // **Validates: Requirements 5.5, 8.5, 6.5**
  it('returns platform credentials for any non-connected settings row', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom(...NON_CONNECTED_STATUSES),
        fc.constantFrom('shared', 'dedicated'),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string(),
        async (tenantId, status, mode, phoneNumberId, wabaId, token) => {
          // Even with a perfectly valid encrypted dedicated token present, a
          // non-connected status must fail closed to platform credentials.
          store.tables = {
            tenant_whatsapp_settings: [
              {
                tenant_id: tenantId,
                mode,
                onboarding_status: status,
                phone_number_id: phoneNumberId,
                waba_id: wabaId,
                access_token_encrypted: encryptToken(token),
              },
            ],
          };

          const creds = await getCredentialsForTenant(tenantId);
          expect(creds).not.toBeNull();
          expect(creds!.accessToken).toBe(PLATFORM_ACCESS_TOKEN);
          expect(creds!.phoneNumberId).toBe(SHARED_PHONE_NUMBER_ID);
          expect(creds!.businessAccountId).toBe(PLATFORM_WABA_ID);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Connected dedicated tenants route through decrypted dedicated
// credentials
// ---------------------------------------------------------------------------
// Feature: pro-plan-whatsapp-onboarding, Property 8: For any access token, given a connected WhatsApp_Settings row with mode=dedicated and that token stored encrypted, the Tenant_Router returns credentials whose accessToken equals the original token and whose phoneNumberId and businessAccountId equal the row's phone_number_id and waba_id.
describe('Property 8: Connected dedicated tenants route through decrypted dedicated credentials', () => {
  // **Validates: Requirements 6.1, 6.2**
  it('returns decrypted dedicated credentials matching the stored row', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string(),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (tenantId, token, phoneNumberId, wabaId) => {
          store.tables = {
            tenant_whatsapp_settings: [
              {
                tenant_id: tenantId,
                mode: 'dedicated',
                onboarding_status: 'connected',
                phone_number_id: phoneNumberId,
                waba_id: wabaId,
                access_token_encrypted: encryptToken(token),
              },
            ],
          };

          const creds = await getCredentialsForTenant(tenantId);
          expect(creds).not.toBeNull();
          expect(creds!.accessToken).toBe(token);
          expect(creds!.phoneNumberId).toBe(phoneNumberId);
          expect(creds!.businessAccountId).toBe(wabaId);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Decryption failure falls back to shared and records an error
// ---------------------------------------------------------------------------
// Feature: pro-plan-whatsapp-onboarding, Property 9: For any connected dedicated row whose access_token_encrypted is not decryptable, the Tenant_Router returns the platform credentials (or null when no platform credentials exist) and records an error reason for the Tenant.
describe('Property 9: Decryption failure falls back to shared and records an error', () => {
  // An undecryptable ciphertext: any string for which decryptToken throws.
  const undecryptableArb = fc
    .string()
    .map((s) => `not-valid-ciphertext-${s}`)
    .filter((s) => {
      try {
        decryptToken(s);
        return false; // decryptable — exclude (vanishingly unlikely)
      } catch {
        return true;
      }
    });

  // **Validates: Requirements 6.4, 6.5**
  it('falls back to platform credentials and records an error reason when platform creds exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        undecryptableArb,
        async (tenantId, phoneNumberId, wabaId, badCipher) => {
          const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

          try {
            store.tables = {
              tenant_whatsapp_settings: [
                {
                  tenant_id: tenantId,
                  mode: 'dedicated',
                  onboarding_status: 'connected',
                  phone_number_id: phoneNumberId,
                  waba_id: wabaId,
                  access_token_encrypted: badCipher,
                },
              ],
            };

            const creds = await getCredentialsForTenant(tenantId);
            // Falls back to platform credentials.
            expect(creds).not.toBeNull();
            expect(creds!.accessToken).toBe(PLATFORM_ACCESS_TOKEN);
            expect(creds!.phoneNumberId).toBe(SHARED_PHONE_NUMBER_ID);
            // Records a token-free error reason for the tenant.
            expect(errorSpy).toHaveBeenCalled();
            const loggedReason = errorSpy.mock.calls
              .map((c) => String(c[0]))
              .join('\n');
            expect(loggedReason).toMatch(/decryption failed/i);
            // The error reason never contains the encrypted value.
            expect(loggedReason).not.toContain(badCipher);
          } finally {
            errorSpy.mockRestore();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 6.4, 6.5**
  it('returns null when decryption fails and no platform credentials exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        undecryptableArb,
        async (tenantId, phoneNumberId, wabaId, badCipher) => {
          const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
          // Remove platform credentials for this run.
          const saved = process.env.META_WHATSAPP_ACCESS_TOKEN;
          delete process.env.META_WHATSAPP_ACCESS_TOKEN;

          try {
            store.tables = {
              tenant_whatsapp_settings: [
                {
                  tenant_id: tenantId,
                  mode: 'dedicated',
                  onboarding_status: 'connected',
                  phone_number_id: phoneNumberId,
                  waba_id: wabaId,
                  access_token_encrypted: badCipher,
                },
              ],
            };

            const creds = await getCredentialsForTenant(tenantId);
            // No dedicated creds (undecryptable) and no platform creds → null.
            expect(creds).toBeNull();
            // Still records an error reason.
            expect(errorSpy).toHaveBeenCalled();
          } finally {
            process.env.META_WHATSAPP_ACCESS_TOKEN = saved;
            errorSpy.mockRestore();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Inbound routing by dedicated phone number id
// ---------------------------------------------------------------------------
// Feature: pro-plan-whatsapp-onboarding, Property 10: For any connected dedicated WhatsApp_Settings, an inbound webhook whose phone_number_id matches the row's phone_number_id resolves to that row's Tenant.
describe('Property 10: Inbound routing by dedicated phone number id', () => {
  // **Validates: Requirements 6.3**
  it('resolves an inbound dedicated phone_number_id to the owning tenant', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        dedicatedPhoneIdArb,
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string(),
        fc.string({ minLength: 1 }),
        async (
          tenantId,
          branchId,
          phoneNumberId,
          wabaId,
          salonName,
          token,
          customerPhone,
        ) => {
          store.tables = {
            tenant_whatsapp_settings: [
              {
                tenant_id: tenantId,
                mode: 'dedicated',
                onboarding_status: 'connected',
                phone_number_id: phoneNumberId,
                waba_id: wabaId,
                access_token_encrypted: encryptToken(token),
              },
            ],
            tenants: [{ id: tenantId, name: salonName }],
            branches: [{ id: branchId, tenant_id: tenantId, is_default: true }],
          };

          const ctx = await resolveTenant(phoneNumberId, customerPhone, '');
          expect(ctx).not.toBeNull();
          expect(ctx!.tenantId).toBe(tenantId);
          // Connected dedicated row routes as dedicated mode.
          expect(ctx!.mode).toBe('dedicated');
          expect(ctx!.branchId).toBe(branchId);
        },
      ),
      { numRuns: 100 },
    );
  });
});
