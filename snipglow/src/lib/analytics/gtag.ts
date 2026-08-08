// =============================================================================
// Google Ads (gtag.js) helpers.
//
// The account tag itself is loaded once in the root layout (src/app/layout.tsx)
// via next/script. This module only holds the IDs and the typed, safe wrappers
// used to report conversions from the app.
//
// Why a wrapper instead of an inline <script>:
//   • gtag.js loads with strategy="afterInteractive", so `window.gtag` may not
//     exist yet when a fast user completes an action - every call is guarded.
//   • This is a SPA; conversions must fire at the exact success point in code,
//     not on a page load, so pasting Google's snippet into <head> would either
//     never fire or fire on every visit to that route.
// =============================================================================

/** Google Ads account tag. */
export const GOOGLE_ADS_ID = 'AW-18361807295';

/** Conversion action: a salon has completed signup (account created). */
export const SIGNUP_CONVERSION_SEND_TO = 'AW-18361807295/-J1zCOfOgt4cEL_jy7NE';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Report the Sign-up conversion to Google Ads.
 *
 * Safe to call from anywhere in the browser: it no-ops during SSR, when the tag
 * has not loaded, and on repeat calls for the same signup (React re-renders,
 * Strict Mode double-invocation, or the user navigating back would otherwise
 * inflate the conversion count).
 *
 * @param dedupeKey Stable id for this signup (e.g. the new tenant id).
 */
export function trackSignupConversion(dedupeKey?: string): void {
  if (typeof window === 'undefined') return;

  const storageKey = `sg_signup_conversion_${dedupeKey ?? 'default'}`;
  try {
    if (window.localStorage.getItem(storageKey) === '1') return;
  } catch {
    /* storage blocked (private mode) - fall through and still report once */
  }

  if (typeof window.gtag !== 'function') return;

  window.gtag('event', 'conversion', {
    send_to: SIGNUP_CONVERSION_SEND_TO,
    value: 1.0,
    currency: 'INR',
  });

  try {
    window.localStorage.setItem(storageKey, '1');
  } catch {
    /* ignore */
  }
}
