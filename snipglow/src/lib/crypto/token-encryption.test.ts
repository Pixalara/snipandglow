// =============================================================================
// Property-based tests for the AES-256-GCM token encryption module.
// Feature: pro-plan-whatsapp-onboarding
// =============================================================================

import { beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';

// A fixed 64-hex (32-byte) test key must be set BEFORE importing the module
// under test, because getKey() reads process.env.TOKEN_ENCRYPTION_KEY at call
// time. Setting it here (module top-level) guarantees it is present for every
// encrypt/decrypt call in the node test environment.
const TEST_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
});

// Eagerly set the key before the import is evaluated as well, so the very first
// access in any environment is safe.
process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;

import { decryptToken, encryptToken } from '@/lib/crypto/token-encryption';

describe('token-encryption properties', () => {
  // Feature: pro-plan-whatsapp-onboarding, Property 1: Access token encryption round-trip — for any string access token, decryptToken(encryptToken(token)) returns a plaintext equal to the original token, and the encrypted output is not equal to the plaintext.
  it('Property 1: encryption round-trips and ciphertext differs from plaintext', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (token) => {
        const encrypted = encryptToken(token);
        // Ciphertext must never equal the plaintext token.
        expect(encrypted).not.toBe(token);
        // Round-trip must recover the exact original token.
        expect(decryptToken(encrypted)).toBe(token);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: pro-plan-whatsapp-onboarding, Property 2: Decryption fails closed on tampered or invalid ciphertext — for any string that was not produced by encryptToken with the active key (random bytes, truncated, or bit-flipped valid ciphertext), decryptToken throws rather than returning a usable token.
  it('Property 2: decryption fails closed on random byte-array inputs', () => {
    fc.assert(
      fc.property(fc.uint8Array(), (bytes) => {
        const input = Buffer.from(bytes).toString('base64');
        // Random bytes are not valid ciphertext for the active key: either the
        // buffer is too short to hold IV+authTag (length guard) or the GCM auth
        // tag check fails. Both must throw rather than return a usable token.
        expect(() => decryptToken(input)).toThrow();
      }),
      { numRuns: 100 },
    );
  });

  // Feature: pro-plan-whatsapp-onboarding, Property 2: Decryption fails closed on tampered or invalid ciphertext — for any string that was not produced by encryptToken with the active key (random bytes, truncated, or bit-flipped valid ciphertext), decryptToken throws rather than returning a usable token.
  it('Property 2: decryption fails closed on truncated valid ciphertext', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: 'binary', minLength: 1 }),
        fc.nat(),
        (token, drop) => {
          const valid = Buffer.from(encryptToken(token), 'base64');
          // Truncate at least one byte from the end (auth tag / ciphertext),
          // producing a value that is no longer valid ciphertext for the key.
          const cut = 1 + (drop % valid.length);
          const truncated = valid.subarray(0, valid.length - cut);
          const input = Buffer.from(truncated).toString('base64');
          expect(() => decryptToken(input)).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: pro-plan-whatsapp-onboarding, Property 2: Decryption fails closed on tampered or invalid ciphertext — for any string that was not produced by encryptToken with the active key (random bytes, truncated, or bit-flipped valid ciphertext), decryptToken throws rather than returning a usable token.
  it('Property 2: decryption fails closed on bit-flipped valid ciphertext', () => {
    fc.assert(
      fc.property(
        fc.string({ unit: 'binary', minLength: 1 }),
        fc.nat(),
        fc.integer({ min: 1, max: 255 }),
        (token, pos, xorMask) => {
          const valid = Buffer.from(encryptToken(token), 'base64');
          const tampered = Buffer.from(valid);
          const index = pos % tampered.length;
          // Flip one or more bits in a single byte (xorMask is non-zero), which
          // breaks the GCM auth tag and must cause a throw.
          tampered[index] = tampered[index] ^ xorMask;
          const input = tampered.toString('base64');
          expect(() => decryptToken(input)).toThrow();
        },
      ),
      { numRuns: 100 },
    );
  });
});
