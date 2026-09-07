-- =============================================================================
-- Migration 051: let invoices actually be updated
--
-- THE BUG
-- -------
-- Editing an invoice's payment method or status appeared to work — the dialog
-- showed "Invoice updated!" and closed — but the old value came straight back.
--
-- `invoices` has had RLS enabled since migration 005 with only two policies:
-- `invoices_select` and `invoices_insert`. There was no UPDATE policy, and under
-- RLS an operation with no permissive policy is denied. So the UPDATE matched
-- zero rows.
--
-- The reason it reported success is the part worth remembering: a Postgres UPDATE
-- that matches zero rows IS NOT AN ERROR. PostgREST returned 204 with no error,
-- so `updateInvoicePayment` saw `error === null` and told the user it had saved.
-- A silent write failure, not a visible one.
--
-- The same gap also broke a rollback. `completeAndGenerateBill` deletes the
-- invoice it just created when a wallet debit fails, "so the balance and bill
-- never disagree" — but with no DELETE policy that delete did nothing, leaving a
-- paid invoice with no matching wallet debit. Note billing/actions.ts already
-- worked around this in its own copy of that rollback by reaching for the admin
-- client; the appointments copy did not. That is fixed in application code
-- rather than here, so this migration does not have to widen delete rights.
--
-- WHY OWNER-ONLY
-- --------------
-- Matching the application's own permission matrix (src/lib/permissions.ts),
-- which grants managers `billing: ['read', 'create']` and deliberately withholds
-- 'update'. A manager may raise a bill but not retrospectively change how it was
-- paid. `invoices_insert` stays as it is — owner OR manager — because creating is
-- exactly what managers are allowed to do.
--
-- No DELETE policy is added. Deleting an invoice is destructive and
-- audit-sensitive, the only two call sites are internal rollbacks that use the
-- service-role client, and nothing in the UI deletes an invoice.
--
-- SAFETY: additive. Creates one policy. No table, column or row is modified, and
-- re-running is harmless.
-- =============================================================================

-- Dropped first so the migration is idempotent.
DROP POLICY IF EXISTS "invoices_update" ON invoices;

CREATE POLICY "invoices_update" ON invoices FOR UPDATE
  -- USING decides which existing rows may be targeted.
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = 'owner'
  )
  -- WITH CHECK validates the row AFTER the update, which stops an invoice being
  -- reassigned to another tenant. Postgres would fall back to USING here, but
  -- stating it explicitly means the intent survives future edits to this policy.
  WITH CHECK (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = 'owner'
  );

COMMENT ON POLICY "invoices_update" ON invoices IS
  'Owners may correct an invoice payment method or status. Managers can raise bills (invoices_insert) but not rewrite how one was paid, matching permissions.ts.';
