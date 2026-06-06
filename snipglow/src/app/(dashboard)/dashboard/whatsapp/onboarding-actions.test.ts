// =============================================================================
// Property-based tests for the dedicated WhatsApp onboarding server actions.
// Feature: pro-plan-whatsapp-onboarding
//
// These tests exercise the orchestrating server actions end-to-end
// (`getOnboardingState`, `submitAuthCode`, `retryOnboarding`,
// `disconnectDedicated`) against an in-memory fake Supabase store that honors
// the one-row-per-tenant constraint on `tenant_whatsapp_settings`.
//
// Mocking strategy (per design "Testing Strategy"):
//   - `@/lib/supabase/server`  → auth stub whose getUser() yields a configurable
//                                 user with user_metadata.tenant_id/role.
//   - `@/lib/supabase/admin`   → admin client backed by the in-memory store for
//                                 `tenants`, `tenant_whatsapp_settings`, and
//                                 `whatsapp_onboarding_events`.
//   - `@/lib/whatsapp/token-exchange`     → real `validateAuthCode`, mocked
//                                            `exchangeCodeForToken` (spy).
//   - `@/lib/whatsapp/webhook-subscription` → mocked `subscribeWaba` (spy).
//   - `@/lib/whatsapp/credential-store`   → real `getSettings` /
//                                            `clearDedicatedCredentials`; the
//                                            real `upsertDedicatedCredentials`
//                                            is wrapped so storage failure can be
//                                            forced for Property 6.
//   - `fetch` is mocked to assert no Graph call is ever made when the guard rejects.
//   - `TOKEN_ENCRYPTION_KEY` is a fixed 64-hex test key.
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { randomUUID } from 'node:crypto';

// A fixed 64-hex (32-byte) test key for AES-256-GCM token encryption. Must be
// present before any encrypt/decrypt call inside the connect orchestration.
const TEST_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;

const TENANT_ID = 't1';

// -----------------------------------------------------------------------------
// In-memory fake store + control surface (hoisted so vi.mock factories can use it)
// -----------------------------------------------------------------------------
const harness = vi.hoisted(() => {
  interface SettingsRow {
    tenant_id: string;
    mode: string | null;
    booking_slug: string | null;
    waba_id: string | null;
    phone_number_id: string | null;
    display_phone_number: string | null;
    access_token_encrypted: string | null;
    display_name: string | null;
    display_name_status: string | null;
    webhook_status: string | null;
    onboarding_status: string | null;
    onboarding_error: string | null;
    onboarding_updated_at: string | null;
    [k: string]: unknown;
  }

  const state = {
    user: null as any,
    tenants: new Map<string, any>(),
    settings: new Map<string, SettingsRow>(),
    events: [] as any[],
    // control flags / impls
    storageShouldFail: false,
    failUpdates: false,
    exchangeImpl: async (_code: string): Promise<any> => ({
      ok: true,
      accessToken: 'long-lived-access-token',
      waba: {
        wabaId: 'waba-123',
        phoneNumberId: 'pn-123',
        displayPhoneNumber: '+1 555 000 1111',
      },
    }),
    subscribeImpl: async (): Promise<any> => ({ ok: true }),
  };

  function defaultSettingsRow(tenantId: string): SettingsRow {
    return {
      tenant_id: tenantId,
      mode: null,
      booking_slug: null,
      waba_id: null,
      phone_number_id: null,
      display_phone_number: null,
      access_token_encrypted: null,
      display_name: null,
      display_name_status: null,
      webhook_status: null,
      onboarding_status: null,
      onboarding_error: null,
      onboarding_updated_at: null,
    };
  }

  function getRows(table: string): any[] {
    if (table === 'tenant_whatsapp_settings') return [...state.settings.values()];
    if (table === 'tenants') return [...state.tenants.values()];
    if (table === 'whatsapp_onboarding_events') return state.events;
    return [];
  }

  function matches(row: any, filters: [string, unknown][]): boolean {
    return filters.every(([col, val]) => row[col] === val);
  }

  // A minimal awaitable Supabase-like query builder over the in-memory store.
  class QueryBuilder {
    private op: 'select' | 'insert' | 'update' | null = null;
    private filters: [string, unknown][] = [];
    private payload: any = null;
    private resultMode: 'single' | 'maybeSingle' | 'multi' = 'multi';

    constructor(private table: string) {}

    select(_cols?: string) {
      if (this.op === null) this.op = 'select';
      return this;
    }
    insert(values: any) {
      this.op = 'insert';
      this.payload = values;
      return this;
    }
    update(values: any) {
      this.op = 'update';
      this.payload = values;
      return this;
    }
    eq(col: string, val: unknown) {
      this.filters.push([col, val]);
      return this;
    }
    single() {
      this.resultMode = 'single';
      return this;
    }
    maybeSingle() {
      this.resultMode = 'maybeSingle';
      return this;
    }

    private execute(): { data: any; error: any } {
      const op = this.op ?? 'select';

      if (op === 'select') {
        const rows = getRows(this.table).filter((r) => matches(r, this.filters));
        if (this.resultMode === 'single') {
          return rows.length > 0
            ? { data: { ...rows[0] }, error: null }
            : { data: null, error: { message: 'no rows' } };
        }
        if (this.resultMode === 'maybeSingle') {
          return { data: rows.length > 0 ? { ...rows[0] } : null, error: null };
        }
        return { data: rows.map((r) => ({ ...r })), error: null };
      }

      if (op === 'insert') {
        if (this.table === 'tenant_whatsapp_settings') {
          const tid = this.payload.tenant_id;
          if (state.settings.has(tid)) {
            // Honor the one-row-per-tenant unique constraint.
            return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
          }
          const row = { ...defaultSettingsRow(tid), ...this.payload };
          state.settings.set(tid, row);
          return this.shape([row]);
        }
        if (this.table === 'whatsapp_onboarding_events') {
          const row = {
            id: randomUUID(),
            created_at: new Date().toISOString(),
            reason: null,
            ...this.payload,
          };
          state.events.push(row);
          return this.shape([row]);
        }
        return { data: null, error: null };
      }

      // update
      if (state.failUpdates) {
        // Simulate a failed update: NO mutation is applied.
        return { data: null, error: { message: 'simulated update failure' } };
      }
      const rows = getRows(this.table).filter((r) => matches(r, this.filters));
      rows.forEach((r) => Object.assign(r, this.payload));
      return this.shape(rows);
    }

    private shape(rows: any[]): { data: any; error: any } {
      if (this.resultMode === 'single') {
        return rows.length > 0
          ? { data: { ...rows[0] }, error: null }
          : { data: null, error: { message: 'no rows' } };
      }
      if (this.resultMode === 'maybeSingle') {
        return { data: rows.length > 0 ? { ...rows[0] } : null, error: null };
      }
      return { data: rows.map((r) => ({ ...r })), error: null };
    }

    then(onF: (v: any) => any, onR?: (e: any) => any) {
      return Promise.resolve(this.execute()).then(onF, onR);
    }
    catch(onR: (e: any) => any) {
      return Promise.resolve(this.execute()).catch(onR);
    }
    finally(f: () => void) {
      return Promise.resolve(this.execute()).finally(f);
    }
  }

  function makeAdminClient() {
    return { from: (table: string) => new QueryBuilder(table) };
  }

  function makeServerClient() {
    return {
      auth: {
        getUser: async () => ({ data: { user: state.user } }),
      },
    };
  }

  return { state, makeAdminClient, makeServerClient, defaultSettingsRow };
});

// -----------------------------------------------------------------------------
// Module mocks
// -----------------------------------------------------------------------------
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => harness.makeServerClient(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => harness.makeAdminClient(),
}));

vi.mock('@/lib/whatsapp/token-exchange', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/whatsapp/token-exchange')>();
  return {
    ...actual, // keep the real validateAuthCode
    exchangeCodeForToken: vi.fn((code: string) => harness.state.exchangeImpl(code)),
  };
});

vi.mock('@/lib/whatsapp/webhook-subscription', () => ({
  subscribeWaba: vi.fn(() => harness.state.subscribeImpl()),
}));

vi.mock('@/lib/whatsapp/credential-store', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/whatsapp/credential-store')>();
  return {
    ...actual, // real getSettings / clearDedicatedCredentials
    upsertDedicatedCredentials: vi.fn(async (tenantId: string, creds: any) => {
      if (harness.state.storageShouldFail) {
        throw new Error('storage write failed');
      }
      return actual.upsertDedicatedCredentials(tenantId, creds);
    }),
  };
});

// Imports AFTER mocks are registered.
import {
  getOnboardingState,
  submitAuthCode,
  retryOnboarding,
  disconnectDedicated,
} from '@/app/(dashboard)/dashboard/whatsapp/actions';
import { exchangeCodeForToken, validateAuthCode } from '@/lib/whatsapp/token-exchange';
import { subscribeWaba } from '@/lib/whatsapp/webhook-subscription';
import {
  upsertDedicatedCredentials,
  getSettings,
} from '@/lib/whatsapp/credential-store';

const exchangeSpy = vi.mocked(exchangeCodeForToken);
const subscribeSpy = vi.mocked(subscribeWaba);

// -----------------------------------------------------------------------------
// Test state helpers
// -----------------------------------------------------------------------------
function resetState() {
  harness.state.settings.clear();
  harness.state.events.length = 0;
  harness.state.tenants.clear();
  harness.state.storageShouldFail = false;
  harness.state.failUpdates = false;
  harness.state.exchangeImpl = async () => ({
    ok: true,
    accessToken: 'long-lived-access-token',
    waba: {
      wabaId: 'waba-123',
      phoneNumberId: 'pn-123',
      displayPhoneNumber: '+1 555 000 1111',
    },
  });
  harness.state.subscribeImpl = async () => ({ ok: true });
  // Default: a Pro plan owner.
  harness.state.tenants.set(TENANT_ID, { id: TENANT_ID, plan_tier: 'pro' });
  harness.state.user = {
    id: 'u1',
    user_metadata: { tenant_id: TENANT_ID, role: 'owner' },
  };
  exchangeSpy.mockClear();
  subscribeSpy.mockClear();
  vi.mocked(upsertDedicatedCredentials).mockClear();
}

function setProOwner() {
  harness.state.tenants.set(TENANT_ID, { id: TENANT_ID, plan_tier: 'pro' });
  harness.state.user = {
    id: 'u1',
    user_metadata: { tenant_id: TENANT_ID, role: 'owner' },
  };
}

beforeEach(() => {
  resetState();
  // A fetch spy that fails loudly: no Graph call should reach the network in
  // these tests (token-exchange / webhook are mocked). Used to assert no call.
  global.fetch = vi.fn(async () => {
    throw new Error('unexpected network call');
  }) as any;
});

const AUTH_REASONS = new Set(['not_authenticated', 'not_owner', 'not_pro', 'not_authorized']);

describe('onboarding server actions — property tests', () => {
  // ===========================================================================
  // Feature: pro-plan-whatsapp-onboarding, Property 4: Non-Pro / non-owner requests never exchange — for any combination of Plan_Tier and user role where the tier is not `pro` or the role is not `owner`, every dedicated onboarding server action is rejected with an authorization error, no token exchange is initiated, and no credential write occurs.
  // ===========================================================================
  it('Property 4: non-Pro / non-owner requests are rejected and never exchange or write', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('trial', 'starter', 'pro'),
        fc.constantFrom('owner', 'manager', 'staff', 'admin', undefined),
        async (tier, role) => {
          // Only consider non-authorized combos (exclude the pro + owner case).
          fc.pre(!(tier === 'pro' && role === 'owner'));

          resetState();
          harness.state.tenants.set(TENANT_ID, { id: TENANT_ID, plan_tier: tier });
          harness.state.user = {
            id: 'u1',
            user_metadata: { tenant_id: TENANT_ID, role },
          };

          const submit = await submitAuthCode('valid_code_123');
          const retry = await retryOnboarding();
          const disconnect = await disconnectDedicated();

          // Every action is rejected with an authorization error.
          expect(submit.ok).toBe(false);
          expect(retry.ok).toBe(false);
          expect(disconnect.ok).toBe(false);
          if (!submit.ok) expect(AUTH_REASONS.has(submit.reason)).toBe(true);
          if (!retry.ok) expect(AUTH_REASONS.has(retry.reason)).toBe(true);
          if (!disconnect.ok) expect(AUTH_REASONS.has(disconnect.reason)).toBe(true);

          // No token exchange was initiated...
          expect(exchangeSpy).not.toHaveBeenCalled();
          expect(subscribeSpy).not.toHaveBeenCalled();
          // ...and no Graph network call occurred.
          expect(global.fetch).not.toHaveBeenCalled();
          // No credential write occurred (no settings row was created/modified).
          expect(harness.state.settings.size).toBe(0);
          expect(vi.mocked(upsertDedicatedCredentials)).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  // ===========================================================================
  // Feature: pro-plan-whatsapp-onboarding, Property 5: Authorization-code validation gates the Graph API call — for any authorization code string, validation succeeds if and only if the code is non-empty, non-whitespace, and well-formed; the Meta Graph API exchange is invoked if and only if validation succeeds.
  // ===========================================================================
  it('Property 5: the Graph exchange is invoked iff validateAuthCode succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Mix of arbitrary strings, whitespace, empty, and plausibly well-formed codes.
        fc.oneof(
          fc.string(),
          fc.constantFrom('', '   ', '\t\n', 'valid_code_123', 'AQ-Bc.d|e-f', 'has space'),
          fc.stringMatching(/^[A-Za-z0-9._|-]{1,40}$/),
        ),
        async (code) => {
          resetState();
          setProOwner();

          const expected = validateAuthCode(code).ok;

          await submitAuthCode(code);

          // Exchange called exactly when (and only when) validation passed.
          expect(exchangeSpy.mock.calls.length).toBe(expected ? 1 : 0);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ===========================================================================
  // Feature: pro-plan-whatsapp-onboarding, Property 6: Connect outcome is determined by storage and webhook results — for any boolean pair (storageSucceeded, webhookSucceeded), the connect orchestration produces a deterministic final state: when both are true the result is mode=dedicated / onboarding_status=connected / webhook_status=active; whenever the webhook step does not succeed the result is webhook_status=inactive / onboarding_status=failed / mode=shared.
  // ===========================================================================
  it('Property 6: connect outcome is determined by storage and webhook results', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), fc.boolean(), async (storageSucceeded, webhookSucceeded) => {
        resetState();
        setProOwner();
        harness.state.storageShouldFail = !storageSucceeded;
        harness.state.subscribeImpl = async () => ({
          ok: webhookSucceeded,
          errorReason: webhookSucceeded ? undefined : 'subscribe failed',
        });

        const result = await submitAuthCode('valid_code_123');

        if (storageSucceeded && webhookSucceeded) {
          // Full success.
          expect(result.ok).toBe(true);
          expect(result.state.status).toBe('connected');
          expect(result.state.mode).toBe('dedicated');
          expect(result.state.webhookStatus).toBe('active');
        } else if (storageSucceeded && !webhookSucceeded) {
          // Webhook failed: keep shared, mark inactive + failed.
          expect(result.ok).toBe(false);
          expect(result.state.status).toBe('failed');
          expect(result.state.mode).toBe('shared');
          expect(result.state.webhookStatus).toBe('inactive');
        } else {
          // Storage failed before the webhook step: failed, never dedicated.
          expect(result.ok).toBe(false);
          expect(result.state.status).toBe('failed');
          expect(result.state.mode).toBe('shared');
        }
      }),
      { numRuns: 100 },
    );
  });

  // ===========================================================================
  // Feature: pro-plan-whatsapp-onboarding, Property 14: At most one settings row per tenant — for any sequence of credential upserts for a single Tenant, the Credential_Store ends with exactly one WhatsApp_Settings row for that Tenant (new rows are created only when none exists; otherwise the existing row is updated).
  // ===========================================================================
  it('Property 14: any sequence of upserts leaves exactly one settings row per tenant', async () => {
    const credArb = fc.record({
      accessTokenEncrypted: fc.string({ minLength: 1 }),
      wabaId: fc.string({ minLength: 1 }),
      phoneNumberId: fc.string({ minLength: 1 }),
      displayPhoneNumber: fc.string({ minLength: 1 }),
    });

    await fc.assert(
      fc.asyncProperty(fc.array(credArb, { minLength: 1, maxLength: 10 }), async (sequence) => {
        resetState();

        for (const creds of sequence) {
          await upsertDedicatedCredentials(TENANT_ID, creds);
        }

        // Exactly one row for this tenant in the store.
        expect(harness.state.settings.size).toBe(1);
        expect(harness.state.settings.has(TENANT_ID)).toBe(true);

        // And it reflects the last upsert's values.
        const last = sequence[sequence.length - 1];
        const row = await getSettings(TENANT_ID);
        expect(row?.access_token_encrypted).toBe(last.accessTokenEncrypted);
        expect(row?.waba_id).toBe(last.wabaId);
        expect(row?.phone_number_id).toBe(last.phoneNumberId);
        expect(row?.display_phone_number).toBe(last.displayPhoneNumber);
      }),
      { numRuns: 100 },
    );
  });

  // ===========================================================================
  // Feature: pro-plan-whatsapp-onboarding, Property 15: Disconnect produces the shared/cleared end state — for any connected Tenant, a successful disconnect yields exactly mode=shared, onboarding_status=disconnected, webhook_status=inactive, and clears access_token_encrypted, phone_number_id, and display_phone_number.
  // ===========================================================================
  it('Property 15: a successful disconnect yields the shared/cleared end state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          waba: fc.string({ minLength: 1 }),
          phone: fc.string({ minLength: 1 }),
          display: fc.string({ minLength: 1 }),
          token: fc.string({ minLength: 1 }),
          webhook: fc.constantFrom('active', 'inactive'),
        }),
        async (seed) => {
          resetState();
          setProOwner();
          // Seed a connected dedicated row.
          harness.state.settings.set(TENANT_ID, {
            ...harness.defaultSettingsRow(TENANT_ID),
            mode: 'dedicated',
            onboarding_status: 'connected',
            webhook_status: seed.webhook,
            waba_id: seed.waba,
            phone_number_id: seed.phone,
            display_phone_number: seed.display,
            access_token_encrypted: seed.token,
          });

          const result = await disconnectDedicated();

          expect(result.ok).toBe(true);
          const row = harness.state.settings.get(TENANT_ID)!;
          expect(row.mode).toBe('shared');
          expect(row.onboarding_status).toBe('disconnected');
          expect(row.webhook_status).toBe('inactive');
          expect(row.access_token_encrypted).toBeNull();
          expect(row.phone_number_id).toBeNull();
          expect(row.display_phone_number).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  // ===========================================================================
  // Feature: pro-plan-whatsapp-onboarding, Property 16: Disconnect is atomic (all-or-nothing) — for any sub-step failure during disconnect, the Tenant's stored mode, onboarding_status, webhook_status, and credential fields remain identical to their pre-disconnect values (no partial update is observable).
  // ===========================================================================
  it('Property 16: a failed disconnect leaves the stored row byte-for-byte unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          waba: fc.string({ minLength: 1 }),
          phone: fc.string({ minLength: 1 }),
          display: fc.string({ minLength: 1 }),
          token: fc.string({ minLength: 1 }),
        }),
        async (seed) => {
          resetState();
          setProOwner();
          harness.state.settings.set(TENANT_ID, {
            ...harness.defaultSettingsRow(TENANT_ID),
            mode: 'dedicated',
            onboarding_status: 'connected',
            webhook_status: 'active',
            waba_id: seed.waba,
            phone_number_id: seed.phone,
            display_phone_number: seed.display,
            access_token_encrypted: seed.token,
          });

          // Snapshot before the (failing) disconnect.
          const before = structuredClone(harness.state.settings.get(TENANT_ID));

          // Force the atomic UPDATE to fail.
          harness.state.failUpdates = true;
          const result = await disconnectDedicated();

          // The disconnect surfaces an error and no partial state is applied.
          expect(result.ok).toBe(false);
          const after = harness.state.settings.get(TENANT_ID);
          expect(after).toEqual(before);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ===========================================================================
  // Feature: pro-plan-whatsapp-onboarding, Property 18: Status transitions are recorded as events — for any legal transition applied through the orchestrator, exactly one onboarding event is appended carrying the Tenant identifier, the new Onboarding_Status, and a timestamp.
  // ===========================================================================
  it('Property 18: each orchestrated transition appends exactly one event with tenant id, status, timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('success', 'webhook_fail', 'storage_fail', 'invalid_code'),
        async (scenario) => {
          resetState();
          setProOwner();

          let code = 'valid_code_123';
          let expectedStatuses: string[];

          switch (scenario) {
            case 'success':
              expectedStatuses = ['in_progress', 'connected'];
              break;
            case 'webhook_fail':
              harness.state.subscribeImpl = async () => ({ ok: false, errorReason: 'no' });
              expectedStatuses = ['in_progress', 'failed'];
              break;
            case 'storage_fail':
              harness.state.storageShouldFail = true;
              expectedStatuses = ['in_progress', 'failed'];
              break;
            default: // invalid_code
              code = '   ';
              expectedStatuses = ['in_progress', 'failed'];
              break;
          }

          await submitAuthCode(code);

          // Exactly one event per transition, in order.
          const statuses = harness.state.events.map((e) => e.status);
          expect(statuses).toEqual(expectedStatuses);

          // Every event carries the tenant id, a status, and a timestamp.
          for (const event of harness.state.events) {
            expect(event.tenant_id).toBe(TENANT_ID);
            expect(typeof event.status).toBe('string');
            expect(event.status.length).toBeGreaterThan(0);
            expect(typeof event.created_at).toBe('string');
            expect(Number.isNaN(Date.parse(event.created_at))).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // ===========================================================================
  // Feature: pro-plan-whatsapp-onboarding, Property 19: Onboarding outcome persistence round-trip — for any completed attempt, reading the onboarding state afterward returns the same persisted status; when no settings row exists for a Tenant, the read returns not_started.
  // ===========================================================================
  it('Property 19: reading state round-trips the persisted status (defaulting to not_started)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('none', 'success', 'webhook_fail', 'invalid_code'),
        async (scenario) => {
          resetState();
          setProOwner();

          if (scenario === 'none') {
            // No prior attempt: no settings row exists.
            const state = await getOnboardingState();
            expect(state.status).toBe('not_started');
            expect(state.mode).toBe('shared');
            return;
          }

          if (scenario === 'webhook_fail') {
            harness.state.subscribeImpl = async () => ({ ok: false, errorReason: 'no' });
          }
          const code = scenario === 'invalid_code' ? '' : 'valid_code_123';

          await submitAuthCode(code);

          // The persisted status in the store...
          const persisted = harness.state.settings.get(TENANT_ID)?.onboarding_status;
          // ...is exactly what a subsequent read returns.
          const state = await getOnboardingState();
          expect(state.status).toBe(persisted);
          // Sanity: completed attempts land on a terminal-ish status.
          if (scenario === 'success') {
            expect(state.status).toBe('connected');
          } else {
            expect(state.status).toBe('failed');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
