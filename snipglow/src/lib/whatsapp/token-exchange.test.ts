// =============================================================================
// Integration tests for the WhatsApp Token Exchange Service (Task 5.2).
//
// These are example/integration tests (NOT property-based): they mock the
// global `fetch` so the external Meta Graph API calls are exercised
// deterministically.
//
// Coverage:
//  - Req 3.1: valid code -> the oauth exchange endpoint is called with the
//    platform app credentials (client_id / client_secret).
//  - Req 3.2: a mocked Graph response -> fetchWabaDetails maps
//    waba_id / phone_number_id / display_phone_number.
//  - Req 3.6: a delayed fetch that honours the abort signal -> the 30s
//    AbortController timeout returns a timeout error reason.
// =============================================================================

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { exchangeCodeForToken, fetchWabaDetails } from './token-exchange';
import { WA_BASE_URL } from './config';

// Fixed platform app credentials used as the "platform" identity for the test.
const TEST_APP_ID = 'test-app-id-123';
const TEST_APP_SECRET = 'test-app-secret-456';

/** Build a mock Response-like object with the subset of fields the code uses. */
function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  process.env.META_APP_ID = TEST_APP_ID;
  process.env.META_APP_SECRET = TEST_APP_SECRET;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('exchangeCodeForToken (Req 3.1)', () => {
  it('calls the oauth endpoint with the platform app credentials for a valid code', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/oauth/access_token')) {
        return jsonResponse({ access_token: 'long-lived-token' });
      }
      if (url.includes('/me/whatsapp_business_accounts')) {
        return jsonResponse({ data: [{ id: 'waba-1' }] });
      }
      if (url.includes('/phone_numbers')) {
        return jsonResponse({
          data: [{ id: 'phone-1', display_phone_number: '+1 555 0100' }],
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await exchangeCodeForToken('valid_code_123');

    expect(result.ok).toBe(true);

    // The oauth exchange must have been invoked.
    const oauthCall = fetchMock.mock.calls.find(([input]) => {
      const url = typeof input === 'string' ? input : String(input);
      return url.includes('/oauth/access_token');
    });
    expect(oauthCall).toBeDefined();

    const oauthUrl =
      typeof oauthCall![0] === 'string'
        ? oauthCall![0]
        : String(oauthCall![0]);

    // URL targets the configured Graph base + oauth path.
    expect(oauthUrl).toContain(WA_BASE_URL);
    expect(oauthUrl).toContain('/oauth/access_token');

    // Platform credentials (client_id / client_secret) are present (Req 3.1).
    const params = new URLSearchParams(oauthUrl.split('?')[1]);
    expect(params.get('client_id')).toBe(TEST_APP_ID);
    expect(params.get('client_secret')).toBe(TEST_APP_SECRET);
    expect(params.get('code')).toBe('valid_code_123');
  });

  it('returns a descriptive token-free reason when the oauth call errors', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: { message: 'bad code' } }, false, 400)
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await exchangeCodeForToken('valid_code_123');

    expect(result.ok).toBe(false);
    expect(result.accessToken).toBeUndefined();
    expect(result.errorReason).toContain('400');
    expect(result.errorReason).toContain('bad code');
  });
});

describe('fetchWabaDetails (Req 3.2)', () => {
  it('maps waba_id, phone_number_id and display_phone_number from the Graph response', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('/me/whatsapp_business_accounts')) {
        return jsonResponse({ data: [{ id: 'waba-mapped' }] });
      }
      if (url.includes('/waba-mapped/phone_numbers')) {
        return jsonResponse({
          data: [
            {
              id: 'phone-mapped',
              display_phone_number: '+44 20 7946 0000',
            },
          ],
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchWabaDetails('access-token');

    expect('errorReason' in result).toBe(false);
    expect(result).toEqual({
      wabaId: 'waba-mapped',
      phoneNumberId: 'phone-mapped',
      displayPhoneNumber: '+44 20 7946 0000',
    });

    // Confirm the expected Graph paths were called.
    const calledUrls = fetchMock.mock.calls.map(([input]) =>
      typeof input === 'string' ? input : String(input)
    );
    expect(
      calledUrls.some((u) => u.includes('/me/whatsapp_business_accounts'))
    ).toBe(true);
    expect(calledUrls.some((u) => u.includes('/waba-mapped/phone_numbers'))).toBe(
      true
    );
  });

  it('returns a token-free errorReason when no WABA is found', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchWabaDetails('access-token');

    expect('errorReason' in result).toBe(true);
    if ('errorReason' in result) {
      expect(result.errorReason).not.toContain('access-token');
    }
  });
});

describe('exchangeCodeForToken timeout (Req 3.6)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aborts at 30s and returns a timeout reason', async () => {
    // fetch never resolves on its own, but rejects with an AbortError when the
    // AbortController signal fires (mirroring the real fetch contract).
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener('abort', () => {
              const abortError = new Error('The operation was aborted');
              abortError.name = 'AbortError';
              reject(abortError);
            });
          }
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = exchangeCodeForToken('valid_code_123');

    // Advance past the 30s AbortController timeout.
    await vi.advanceTimersByTimeAsync(30_000);

    const result = await resultPromise;

    expect(result.ok).toBe(false);
    expect(result.errorReason?.toLowerCase()).toContain('timed out');
    // Reason must never leak the code or a token.
    expect(result.errorReason).not.toContain('valid_code_123');
  });
});
