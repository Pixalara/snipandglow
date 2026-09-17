import { describe, expect, it } from 'vitest';
import { TENANT_TEMPLATE_NAMES } from './template-clone';

describe('TENANT_TEMPLATE_NAMES allowlist', () => {
  const set = new Set<string>(TENANT_TEMPLATE_NAMES);

  it('includes every per-tenant customer + owner template', () => {
    for (const name of [
      'booking_confirmation_v2',
      'appointment_rescheduled_v1',
      'appointment_reminder_v1',
      'bill_receipt_v2',
      'bill_receipt_v1',
      'feedback_request_v1',
      'wallet_recharge_v1',
      'owner_booking_alert',
      'owner_reschedule_alert',
      'owner_cancel_alert',
      'owner_feedback_alert',
    ]) {
      expect(set.has(name), `${name} should be cloned`).toBe(true);
    }
  });

  it('excludes platform-only, sample, marketing and superseded templates', () => {
    for (const name of [
      'platform_signup_alert', // sent from the shared number only
      'trial_expiry_v1',       // platform -> owner ops
      'staff_welcome_v2',      // welcome, shared number
      'hello_world',           // Meta reserved sample
      'invoice_receipt',       // legacy
      'booking_confirmation',  // superseded by _v2
      'appointment_reminder',  // superseded by _v1
      'feedback_request',      // superseded by _v1
      'renewal_reminder',      // marketing
      'winback_30_day',        // marketing
    ]) {
      expect(set.has(name), `${name} should NOT be cloned`).toBe(false);
    }
  });
});
