import { describe, it, expect } from 'vitest';
import { consumeOtpCode, normalizeIndianPhone, tenDigitPhone } from './otp';

// =============================================================================
// This verifier guards account access, so the properties that matter are:
//  • a valid code is CONSUMED (single use — no replay),
//  • an expired code is rejected AND cleaned up,
//  • a wrong code is rejected but NOT consumed, so the user can retype it.
// =============================================================================

/**
 * Minimal fake of the Supabase builder chain this module uses. Records which
 * phone shapes were looked up and how many deletes were issued, which is how the
 * single-use and cleanup behaviour is asserted.
 */
interface FakeRow {
  id: string;
  code: string;
  expires_at: string;
}

/** Self-referential, so it needs an explicit type rather than inference. */
interface FakeQuery extends PromiseLike<unknown> {
  select: () => FakeQuery;
  order: () => FakeQuery;
  limit: () => FakeQuery;
  delete: () => FakeQuery;
  eq: (column: string, value: string) => FakeQuery;
  maybeSingle: () => Promise<{ data: FakeRow | null }>;
}

function admin(row: FakeRow | null) {
  const state = { deletes: 0, lookups: [] as string[] };
  const client = {
    from() {
      let deleting = false;
      const b: FakeQuery = {
        select: () => b,
        order: () => b,
        limit: () => b,
        delete: () => {
          deleting = true;
          return b;
        },
        eq: (_column: string, value: string) => {
          if (deleting) state.deletes++;
          else state.lookups.push(value);
          return b;
        },
        maybeSingle: async () => ({ data: row }),
        // Builders are awaitable; the delete path awaits the chain directly.
        then: (resolve) => Promise.resolve({ data: null }).then(resolve),
      };
      return b;
    },
  };
  return { client, state };
}

const future = () => new Date(Date.now() + 5 * 60 * 1000).toISOString();
const past = () => new Date(Date.now() - 60 * 1000).toISOString();

describe('normalizeIndianPhone', () => {
  it('converts a 10-digit number to the stored 12-digit form', () => {
    expect(normalizeIndianPhone('9586616092')).toBe('919586616092');
  });

  it('strips spaces, dashes, brackets and a leading +', () => {
    expect(normalizeIndianPhone('+91 95866-16092')).toBe('919586616092');
    expect(normalizeIndianPhone('(9586) 616092')).toBe('919586616092');
  });

  it('leaves an already-normalised number alone', () => {
    expect(normalizeIndianPhone('919586616092')).toBe('919586616092');
  });
});

describe('tenDigitPhone', () => {
  it('strips the country code', () => {
    expect(tenDigitPhone('919586616092')).toBe('9586616092');
    expect(tenDigitPhone('+91 9586616092')).toBe('9586616092');
    expect(tenDigitPhone('9586616092')).toBe('9586616092');
  });
});

describe('consumeOtpCode', () => {
  it('rejects missing input without touching the database', async () => {
    const { client, state } = admin(null);
    const r = await consumeOtpCode(client, { phone: '', code: '' });
    expect(r.ok).toBe(false);
    expect(r.failure).toBe('INVALID_INPUT');
    expect(state.lookups).toHaveLength(0);
  });

  it('rejects a code that is not 6 digits', async () => {
    const { client } = admin(null);
    const r = await consumeOtpCode(client, { phone: '9586616092', code: '123' });
    expect(r.failure).toBe('INVALID_INPUT');
    expect(r.message).toMatch(/6-digit/);
  });

  it('reports NOT_FOUND when no code was issued', async () => {
    const { client } = admin(null);
    const r = await consumeOtpCode(client, { phone: '9586616092', code: '123456' });
    expect(r.failure).toBe('NOT_FOUND');
  });

  it('accepts a valid code and CONSUMES it so it cannot be replayed', async () => {
    const { client, state } = admin({ id: 'r1', code: '123456', expires_at: future() });
    const r = await consumeOtpCode(client, { phone: '9586616092', code: '123456' });
    expect(r.ok).toBe(true);
    expect(r.phone).toBe('919586616092');
    expect(state.deletes).toBe(1);
  });

  it('tolerates surrounding whitespace in the submitted code', async () => {
    const { client } = admin({ id: 'r1', code: '123456', expires_at: future() });
    const r = await consumeOtpCode(client, { phone: '9586616092', code: '  123456 ' });
    expect(r.ok).toBe(true);
  });

  it('rejects an expired code and cleans the row up', async () => {
    const { client, state } = admin({ id: 'r1', code: '123456', expires_at: past() });
    const r = await consumeOtpCode(client, { phone: '9586616092', code: '123456' });
    expect(r.failure).toBe('EXPIRED');
    expect(state.deletes).toBe(1);
  });

  it('rejects a wrong code WITHOUT consuming it, so the user can retry', async () => {
    const { client, state } = admin({ id: 'r1', code: '123456', expires_at: future() });
    const r = await consumeOtpCode(client, { phone: '9586616092', code: '999999' });
    expect(r.failure).toBe('MISMATCH');
    expect(state.deletes).toBe(0);
  });

  it('looks the number up in every stored shape', async () => {
    // send-otp writes the 12-digit form, but older rows used other shapes; a
    // lookup miss reads to the user as "no OTP" right after they received one.
    const { client, state } = admin(null);
    await consumeOtpCode(client, { phone: '9586616092', code: '123456' });
    expect(state.lookups).toEqual(['9586616092', '919586616092', '+919586616092']);
  });

  it('stops looking as soon as it finds a row', async () => {
    const { client, state } = admin({ id: 'r1', code: '123456', expires_at: future() });
    await consumeOtpCode(client, { phone: '9586616092', code: '123456' });
    expect(state.lookups).toEqual(['9586616092']);
  });
});
