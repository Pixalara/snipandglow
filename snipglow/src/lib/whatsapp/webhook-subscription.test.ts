// =============================================================================
// Integration tests for the webhook subscription service (mocked fetch).
// Covers the external Meta Graph API call that the correctness properties
// intentionally exclude.
//
// Task 6.2 — Requirement 5.1
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subscribeWaba } from './webhook-subscription';
import { WA_BASE_URL } from './config';

describe('subscribeWaba (Requirement 5.1)', () => {
  const WABA_ID = '1234567890';
  const TOKEN = 'EAA-super-secret-long-lived-token';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls Graph API {waba-id}/subscribed_apps via POST with the token in the Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await subscribeWaba(WABA_ID, TOKEN);

    expect(result.ok).toBe(true);

    // fetch was called exactly once
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];

    // URL targets the WABA's subscribed_apps endpoint on the shared base URL
    expect(url).toBe(`${WA_BASE_URL}/${WABA_ID}/subscribed_apps`);
    expect(String(url).endsWith(`/${WABA_ID}/subscribed_apps`)).toBe(true);

    // Method is POST
    expect(init?.method).toBe('POST');

    // Token is sent in the Authorization header as a Bearer token
    expect(init?.headers?.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('returns ok=false on a Graph API error and never leaks the token in the error reason', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: { message: 'bad' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await subscribeWaba(WABA_ID, TOKEN);

    expect(result.ok).toBe(false);
    expect(result.errorReason).toBeDefined();
    // The descriptive reason comes from the Graph API error.message only.
    expect(result.errorReason).toContain('bad');
    // The token must NEVER appear in any returned error reason.
    expect(result.errorReason).not.toContain(TOKEN);
  });
});
