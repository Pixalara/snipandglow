// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { PlanTier } from '@/types';
import { WhatsAppClient } from './whatsapp-client';
import type { OnboardingStatus } from '@/lib/whatsapp/onboarding-status';
import { controlsFor } from '@/lib/whatsapp/onboarding-status';

// -----------------------------------------------------------------------------
// Mock the server actions module. The component dynamically imports './actions'
// inside effects/handlers, but vi.mock at module scope still intercepts the
// dynamic import (Req 1.1, 2.2, 7.1).
// -----------------------------------------------------------------------------
vi.mock('./actions', () => ({
  getOnboardingState: vi.fn(),
  submitAuthCode: vi.fn(),
  retryOnboarding: vi.fn(),
  disconnectDedicated: vi.fn(),
  getWhatsAppLogs: vi.fn(),
  getSetupRequest: vi.fn(),
  requestWhatsAppSetup: vi.fn(),
}));

import * as actions from './actions';

const mockGetOnboardingState = vi.mocked(actions.getOnboardingState);
const mockSubmitAuthCode = vi.mocked(actions.submitAuthCode);
const mockRetryOnboarding = vi.mocked(actions.retryOnboarding);
const mockDisconnectDedicated = vi.mocked(actions.disconnectDedicated);
const mockGetWhatsAppLogs = vi.mocked(actions.getWhatsAppLogs);
const mockGetSetupRequest = vi.mocked(actions.getSetupRequest);
const mockRequestWhatsAppSetup = vi.mocked(actions.requestWhatsAppSetup);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

type State = {
  status: OnboardingStatus;
  mode: 'shared' | 'dedicated';
  displayPhoneNumber: string | null;
  webhookStatus: 'active' | 'inactive' | null;
  errorReason: string | null;
  controls: ReturnType<typeof controlsFor>;
};

function makeState(overrides: Partial<State> = {}): State {
  const status = overrides.status ?? 'not_started';
  return {
    status,
    mode: overrides.mode ?? 'shared',
    displayPhoneNumber: overrides.displayPhoneNumber ?? null,
    webhookStatus: overrides.webhookStatus ?? null,
    errorReason: overrides.errorReason ?? null,
    controls: overrides.controls ?? controlsFor(status),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: a fresh, not-started onboarding state and no logs.
  mockGetOnboardingState.mockResolvedValue(makeState() as any);
  mockGetWhatsAppLogs.mockResolvedValue([] as any);
  mockGetSetupRequest.mockResolvedValue(null as any);
  // Default: Embedded Signup is available (config id present) so the self-serve
  // "Connect WhatsApp" button renders. Interim-mode tests override this.
  vi.stubEnv('NEXT_PUBLIC_FB_CONFIG_ID', 'test-config-id');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// =============================================================================
// Plan gating (Req 1.1, 1.2, 1.3, 1.4)
// =============================================================================
describe('WhatsAppClient — plan gating', () => {
  it('reads the plan tier before render and shows an upgrade prompt for non-Pro tenants (Req 1.1, 1.3)', async () => {
    vi.stubGlobal('FB', { init: vi.fn(), login: vi.fn() });

    render(<WhatsAppClient planTier={'starter' as PlanTier} />);

    // The upgrade prompt is shown instead of the connect action.
    expect(await screen.findByText(/Available on the Pro plan/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Upgrade to Pro/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect WhatsApp/i })).not.toBeInTheDocument();
  });

  it('shows the connect action for Pro tenants in not_started status (Req 1.2, 1.4)', async () => {
    vi.stubGlobal('FB', { init: vi.fn(), login: vi.fn() });

    render(<WhatsAppClient planTier={'pro' as PlanTier} />);

    expect(await screen.findByRole('button', { name: /Connect WhatsApp/i })).toBeInTheDocument();
    expect(screen.queryByText(/Available on the Pro plan/i)).not.toBeInTheDocument();
  });
});

// =============================================================================
// Embedded Signup launch + auth code submission (Req 2.1, 2.2, 2.3, 2.5)
// =============================================================================
describe('WhatsAppClient — Embedded Signup', () => {
  it('launches FB.login with config_id and response_type="code" on connect (Req 2.1)', async () => {
    const login = vi.fn();
    vi.stubGlobal('FB', { init: vi.fn(), login });

    render(<WhatsAppClient planTier={'pro' as PlanTier} />);

    const connectBtn = await screen.findByRole('button', { name: /Connect WhatsApp/i });
    fireEvent.click(connectBtn);

    expect(login).toHaveBeenCalledTimes(1);
    const [callback, options] = login.mock.calls[0];
    expect(typeof callback).toBe('function');
    expect(options).toMatchObject({
      config_id: expect.any(String),
      response_type: 'code',
    });
  });

  it('submits the returned authorization code via submitAuthCode on success (Req 2.2)', async () => {
    // FB.login invokes its callback with a successful auth response.
    const login = vi.fn((cb: (r: { authResponse?: { code: string } }) => void) => {
      cb({ authResponse: { code: 'test-code' } });
    });
    vi.stubGlobal('FB', { init: vi.fn(), login });
    mockSubmitAuthCode.mockResolvedValue({
      ok: true,
      state: makeState({ status: 'connected', mode: 'dedicated', displayPhoneNumber: '+91 90000 00000' }),
    } as any);

    render(<WhatsAppClient planTier={'pro' as PlanTier} />);

    const connectBtn = await screen.findByRole('button', { name: /Connect WhatsApp/i });
    fireEvent.click(connectBtn);

    await waitFor(() => {
      expect(mockSubmitAuthCode).toHaveBeenCalledWith('test-code');
    });
  });

  it('submits nothing and shows a cancellation message when Embedded Signup is cancelled (Req 2.3)', async () => {
    // FB.login invokes its callback with no authResponse (user cancelled/closed).
    const login = vi.fn((cb: (r: { authResponse?: { code: string } }) => void) => {
      cb({});
    });
    vi.stubGlobal('FB', { init: vi.fn(), login });

    render(<WhatsAppClient planTier={'pro' as PlanTier} />);

    const connectBtn = await screen.findByRole('button', { name: /Connect WhatsApp/i });
    fireEvent.click(connectBtn);

    expect(await screen.findByText(/Connection cancelled/i)).toBeInTheDocument();
    expect(mockSubmitAuthCode).not.toHaveBeenCalled();
  });

  it('submits nothing and shows a not-ready message when the SDK has not loaded (Req 2.5)', async () => {
    // SDK never loaded: FB is undefined.
    vi.stubGlobal('FB', undefined);

    render(<WhatsAppClient planTier={'pro' as PlanTier} />);

    const connectBtn = await screen.findByRole('button', { name: /Connect WhatsApp/i });
    fireEvent.click(connectBtn);

    expect(await screen.findByText(/not ready/i)).toBeInTheDocument();
    expect(mockSubmitAuthCode).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Render by status (Req 7.1, 7.2, 7.3)
// =============================================================================
describe('WhatsAppClient — render by onboarding status', () => {
  it('renders the connected number and confirmation when status is connected (Req 7.1, 7.2)', async () => {
    vi.stubGlobal('FB', { init: vi.fn(), login: vi.fn() });
    mockGetOnboardingState.mockResolvedValue(
      makeState({ status: 'connected', mode: 'dedicated', displayPhoneNumber: '+91 98765 43210' }) as any,
    );

    render(<WhatsAppClient planTier={'pro' as PlanTier} />);

    expect(await screen.findByText('+91 98765 43210')).toBeInTheDocument();
    expect(screen.getByText(/Connected Successfully/i)).toBeInTheDocument();
    expect(screen.getByText(/Your WhatsApp Business number is now linked/i)).toBeInTheDocument();
    // Connected exposes the disconnect control, not a connect action.
    expect(screen.getByRole('button', { name: /Disconnect/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect WhatsApp/i })).not.toBeInTheDocument();
  });

  it('renders the recorded error reason and a Retry action when status is failed (Req 7.3)', async () => {
    vi.stubGlobal('FB', { init: vi.fn(), login: vi.fn() });
    mockGetOnboardingState.mockResolvedValue(
      makeState({ status: 'failed', errorReason: 'Token exchange failed' }) as any,
    );

    render(<WhatsAppClient planTier={'pro' as PlanTier} />);

    expect(await screen.findByText('Token exchange failed')).toBeInTheDocument();
    expect(screen.getByText(/Connection Failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });
});

// =============================================================================
// Interim manual-setup flow (when Embedded Signup config id is absent)
// =============================================================================
describe('WhatsAppClient — interim manual setup', () => {
  it('shows the Request WhatsApp Setup form (not the connect button) when no config id is present', async () => {
    vi.stubEnv('NEXT_PUBLIC_FB_CONFIG_ID', '');
    vi.stubGlobal('FB', { init: vi.fn(), login: vi.fn() });

    render(<WhatsAppClient planTier={'pro' as PlanTier} />);

    expect(await screen.findByRole('button', { name: /Request WhatsApp Setup/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Connect WhatsApp/i })).not.toBeInTheDocument();
  });

  it('submits a manual setup request and then shows the in-progress state', async () => {
    vi.stubEnv('NEXT_PUBLIC_FB_CONFIG_ID', '');
    vi.stubGlobal('FB', { init: vi.fn(), login: vi.fn() });
    mockRequestWhatsAppSetup.mockResolvedValue({
      ok: true,
      request: { id: 'r1', contactPhone: '+91 98765 43210', contactName: null, status: 'pending', createdAt: 'now' },
    } as any);

    render(<WhatsAppClient planTier={'pro' as PlanTier} />);

    const phoneInput = await screen.findByPlaceholderText(/Your WhatsApp number/i);
    fireEvent.change(phoneInput, { target: { value: '+91 98765 43210' } });

    const submitBtn = screen.getByRole('button', { name: /Request WhatsApp Setup/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockRequestWhatsAppSetup).toHaveBeenCalledWith({
        contactPhone: '+91 98765 43210',
        contactName: null,
      });
    });
    expect(await screen.findByText(/Setup in progress/i)).toBeInTheDocument();
  });

  it('shows the in-progress state on mount when a pending request already exists', async () => {
    vi.stubEnv('NEXT_PUBLIC_FB_CONFIG_ID', '');
    vi.stubGlobal('FB', { init: vi.fn(), login: vi.fn() });
    mockGetSetupRequest.mockResolvedValue({
      id: 'r1',
      contactPhone: '+91 90000 11111',
      contactName: null,
      status: 'pending',
      createdAt: 'now',
    } as any);

    render(<WhatsAppClient planTier={'pro' as PlanTier} />);

    expect(await screen.findByText(/Setup in progress/i)).toBeInTheDocument();
    expect(screen.getByText('+91 90000 11111')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Request WhatsApp Setup/i })).not.toBeInTheDocument();
  });
});
