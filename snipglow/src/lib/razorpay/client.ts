// Server-only — never import in client components
import 'server-only';
import Razorpay from 'razorpay';

// =============================================================================
// Razorpay client (lazy).
//
// The SDK constructor throws when key_id/key_secret are missing, so it must NOT
// run at module load — otherwise `next build` fails while collecting page data
// on machines/CI without the secrets. Call getRazorpay() inside a request.
// =============================================================================

let cached: Razorpay | null = null;

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getRazorpay(): Razorpay {
  if (cached) return cached;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error('RAZORPAY_NOT_CONFIGURED');
  }
  cached = new Razorpay({ key_id, key_secret });
  return cached;
}
