// =============================================================================
// Schema smoke tests for the WhatsApp onboarding migrations.
// Reads the actual SQL files at test time and asserts the schema guarantees the
// feature depends on are present:
//   - migration 014 declares the one-row-per-tenant UNIQUE index
//   - migration 025 adds onboarding_status + CHECK constraint and the
//     whatsapp_onboarding_events table + index
//
// Task 1.2 — Requirement 4.4
// =============================================================================

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// From src/lib/whatsapp/ the repo root is three levels up, then supabase/migrations.
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../supabase/migrations');

function readMigration(fileName: string): string {
  const filePath = path.join(MIGRATIONS_DIR, fileName);
  expect(
    existsSync(filePath),
    `Expected migration file to exist at ${filePath}. ` +
      `Check the relative depth from src/lib/whatsapp/ to supabase/migrations.`
  ).toBe(true);
  return readFileSync(filePath, 'utf8');
}

describe('migration 014_whatsapp_multi_tenant.sql', () => {
  const sql = readMigration('014_whatsapp_multi_tenant.sql');

  it('declares a UNIQUE index on tenant_id for tenant_whatsapp_settings (Requirement 4.4)', () => {
    // Match a UNIQUE INDEX statement that references both the table and tenant_id,
    // case-insensitively and tolerant of whitespace/newlines.
    const uniqueTenantIndex =
      /CREATE\s+UNIQUE\s+INDEX[\s\S]*?ON\s+tenant_whatsapp_settings\s*\(\s*tenant_id\s*\)/i;
    expect(sql).toMatch(uniqueTenantIndex);

    // Independent presence checks so the failure message is clear if the exact
    // index name (idx_tenant_whatsapp_tenant) ever differs.
    expect(sql).toMatch(/UNIQUE\s+INDEX/i);
    expect(sql.toLowerCase()).toContain('tenant_whatsapp_settings');
    expect(sql.toLowerCase()).toContain('tenant_id');
  });
});

describe('migration 025_whatsapp_onboarding_status.sql', () => {
  const sql = readMigration('025_whatsapp_onboarding_status.sql');

  it('adds onboarding_status with a CHECK constraint listing the five values (Requirement 4.4)', () => {
    expect(sql).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+onboarding_status/i);

    // CHECK constraint must enumerate all five legal onboarding states.
    const checkMatch = sql.match(/onboarding_status\s+IN\s*\(([^)]*)\)/i);
    expect(checkMatch, 'Expected a CHECK (onboarding_status IN (...)) constraint').not.toBeNull();

    const values = checkMatch![1];
    for (const v of [
      'not_started',
      'in_progress',
      'connected',
      'failed',
      'disconnected',
    ]) {
      expect(values).toContain(v);
    }
  });

  it('creates the whatsapp_onboarding_events table', () => {
    expect(sql).toMatch(
      /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+whatsapp_onboarding_events/i
    );
  });

  it('creates the idx_wa_onboarding_events_tenant index', () => {
    expect(sql).toMatch(
      /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_wa_onboarding_events_tenant/i
    );
  });
});
