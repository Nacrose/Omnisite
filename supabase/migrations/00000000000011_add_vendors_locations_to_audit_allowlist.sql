-- ============================================================
-- OmniSite — Add 'vendors' and 'project_locations' to audit allowlist
-- Migration: 00000000000011
-- Date: 2026-08-11
--
-- Closes the TODO from migration 00000000000010_vendors_and_locations.sql:
-- the two new tables (vendors, project_locations) couldn't use the
-- transactional upsert_with_audit / delete_with_audit path because the
-- allowlist in those Postgres functions (set in migration 07, hardened in
-- migration 09) didn't include them yet. With the API routes for
-- /api/vendors and /api/project-locations now live, we need the same
-- transactional audit guarantee every other table gets.
--
-- This migration recreates BOTH functions with the updated allowlist
-- (adds 'vendors' and 'project_locations' to the existing 17-table list).
-- All the migration-09 hardening is preserved verbatim:
--   • search_path = public, pg_temp (search_path injection guard)
--   • PII masking on workers.phone / subcontractors.pan / .gst
--   • project_id resolution into audit_log.project_id
--
-- Safe to re-run: CREATE OR REPLACE FUNCTION is idempotent.
-- ============================================================

-- ─── 1. Recreate upsert_with_audit() with the new allowlist ────────────────
CREATE OR REPLACE FUNCTION upsert_with_audit(
  p_table TEXT,
  p_row JSONB,
  p_pk TEXT,
  p_user_id TEXT,
  p_action TEXT,
  p_old_values JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record_id TEXT;
  v_diff      JSONB;
  v_result    JSONB;
  v_update_cols TEXT;
  v_project_id  UUID;
BEGIN
  -- Defense-in-depth: p_table is interpolated via %I (which quotes identifiers
  -- safely), but we still validate against an allowlist so a future caller
  -- can't pass an arbitrary table name.
  IF p_table NOT IN (
    'boq_items', 'tasks', 'dsr_entries', 'cbs_nodes', 'requisitions',
    'purchase_orders', 'drawings', 'letters', 'qs_items', 'equipment',
    'subcontractors', 'workers', 'chat_messages', 'projects',
    'user_projects', 'grns', 'stock_items',
    -- New in migration 11 — unified vendor master + project locations
    -- (see migration 10 for schema + RLS).
    'vendors', 'project_locations'
  ) THEN
    RAISE EXCEPTION 'upsert_with_audit: table % not in allowlist', p_table
      USING ERRCODE = 'check_violation';
  END IF;

  v_record_id := p_row->>p_pk;

  -- Field-level diff with PII masking applied to workers.phone and
  -- subcontractors.pan / .gst. Non-PII fields are stored unchanged.
  IF p_old_values IS NOT NULL THEN
    SELECT COALESCE(jsonb_object_agg(
      key,
      jsonb_build_object(
        'old', mask_pii(p_table, key, p_old_values->key),
        'new', mask_pii(p_table, key, p_row->key)
      )
    ) FILTER (WHERE p_old_values->key IS DISTINCT FROM p_row->key), '{}'::jsonb)
    INTO v_diff
    FROM jsonb_object_keys(p_row) AS key;
  END IF;

  -- Build the SET clause for ON CONFLICT UPDATE (all cols except PK).
  SELECT string_agg(quote_ident(col) || ' = EXCLUDED.' || quote_ident(col), ', ')
  INTO v_update_cols
  FROM jsonb_object_keys(p_row) AS col
  WHERE col <> p_pk;

  -- Upsert + return the resulting row as JSON.
  EXECUTE format(
    'WITH ins AS (
       INSERT INTO %I SELECT * FROM jsonb_populate_record(NULL::%I, $1)
       ON CONFLICT (%I) DO UPDATE SET %s
       RETURNING *
     )
     SELECT to_jsonb(ins) FROM ins',
    p_table, p_table, p_pk, COALESCE(v_update_cols, 'updated_at = NOW()')
  ) INTO v_result
  USING p_row;

  -- Resolve project_id from the row for the audit entry (so PMs can filter
  -- audit_log by project in addition to table + record_id). Non-project-scoped
  -- tables (projects, user_projects) will have NULL project_id — that's fine.
  BEGIN
    v_project_id := NULLIF(p_row->>'project_id', '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_project_id := NULL;
  END;

  -- Audit entry in the same transaction — rolls back if this fails.
  INSERT INTO audit_log (table_name, record_id, action, changed_by, changed_fields, old_values, new_values, project_id)
  VALUES (
    p_table,
    COALESCE(v_record_id, ''),
    p_action::TEXT,
    p_user_id,
    v_diff,
    p_old_values,
    p_row,
    v_project_id
  );

  RETURN v_result;
END;
$$;

-- Preserve the service_role-only grant (CREATE OR REPLACE keeps existing
-- grants, but we re-issue to be explicit and resilient to future DROPs).
REVOKE EXECUTE ON FUNCTION upsert_with_audit(TEXT, JSONB, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_with_audit(TEXT, JSONB, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- ─── 2. Recreate delete_with_audit() with the new allowlist ────────────────
CREATE OR REPLACE FUNCTION delete_with_audit(
  p_table TEXT,
  p_record_id TEXT,
  p_pk TEXT,
  p_user_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old       JSONB;
  v_project_id UUID;
BEGIN
  IF p_table NOT IN (
    'boq_items', 'tasks', 'dsr_entries', 'cbs_nodes', 'requisitions',
    'purchase_orders', 'drawings', 'letters', 'qs_items', 'equipment',
    'subcontractors', 'workers', 'chat_messages', 'projects',
    'user_projects', 'grns', 'stock_items',
    -- New in migration 11 — unified vendor master + project locations.
    'vendors', 'project_locations'
  ) THEN
    RAISE EXCEPTION 'delete_with_audit: table % not in allowlist', p_table
      USING ERRCODE = 'check_violation';
  END IF;

  -- Capture the pre-delete row state.
  EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE %I = $1', p_table, p_pk)
    INTO v_old
    USING p_record_id;

  IF v_old IS NULL THEN
    RETURN false;
  END IF;

  EXECUTE format('DELETE FROM %I WHERE %I = $1', p_table, p_pk)
    USING p_record_id;

  -- Resolve project_id for the audit entry.
  BEGIN
    v_project_id := NULLIF(v_old->>'project_id', '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_project_id := NULL;
  END;

  INSERT INTO audit_log (table_name, record_id, action, changed_by, changed_fields, old_values, new_values, project_id)
  VALUES (
    p_table,
    p_record_id,
    'DELETE',
    p_user_id,
    NULL,
    v_old,
    NULL,
    v_project_id
  );

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION delete_with_audit(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_with_audit(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ─── 3. Mask PII on vendors.pan / vendors.gst (same rule as subcontractors) ─
-- The mask_pii() helper (defined in migration 09) only masks PII for tables
-- it knows about. vendors is a superset of subcontractors and stores the same
-- PAN/GST columns under the same names — extend the helper so the audit diff
-- for vendors doesn't leak PAN/GST in cleartext.
--
-- We DROP + CREATE so the function body changes are picked up even on
-- databases where it was already CREATEd in migration 09. The signature is
-- unchanged so existing callers don't need updates.
DROP FUNCTION IF EXISTS mask_pii(TEXT, TEXT, JSONB);

CREATE FUNCTION mask_pii(p_table TEXT, p_field TEXT, p_value JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_text TEXT;
  v_len  INTEGER;
BEGIN
  IF p_value IS NULL THEN RETURN NULL; END IF;
  IF jsonb_typeof(p_value) <> 'string' THEN RETURN p_value; END IF;

  v_text := p_value #>> '{}';
  v_len  := length(v_text);
  IF v_len = 0 THEN RETURN p_value; END IF;

  -- workers.phone: keep country code + last 2 digits, mask the middle.
  IF p_table = 'workers' AND p_field = 'phone' THEN
    IF v_len <= 6 THEN
      RETURN to_jsonb(repeat('X', v_len));
    END IF;
    RETURN to_jsonb(
      substring(v_text FROM 1 FOR 4)
      || repeat('X', v_len - 6)
      || substring(v_text FROM v_len - 1 FOR 2)
    );
  END IF;

  -- subcontractors.pan / .gst: keep last 4, mask leading.
  -- vendors.pan / .gst: same masking (vendors supersedes subcontractors
  -- and carries the same PII columns).
  IF (p_table = 'subcontractors' OR p_table = 'vendors') AND p_field IN ('pan', 'gst') THEN
    IF v_len <= 4 THEN
      RETURN to_jsonb(repeat('X', v_len));
    END IF;
    RETURN to_jsonb(repeat('X', v_len - 4) || substring(v_text FROM v_len - 3 FOR 4));
  END IF;

  RETURN p_value;
END;
$$;

-- mask_pii is referenced by upsert_with_audit() (SECURITY DEFINER, runs as
-- the owner) — no explicit GRANT needed for the service role. Keep it
-- executable by PUBLIC since it's a pure helper (no PII leak risk: it only
-- masks, never reveals).
-- (No REVOKE/GRANT — IMMUTABLE helper functions are safe to leave PUBLIC.)
