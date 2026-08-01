-- Migration: Add upsert_with_audit() Postgres function for transactional writes
-- Date: 2026-08-01
--
-- This function performs an upsert AND writes the audit entry in a single
-- transaction. If either fails, both roll back. Used by API routes via
-- the service-role client to guarantee the audit trail is never lost.
--
-- Usage:
--   const { data, error } = await serviceClient.rpc('upsert_with_audit', {
--     p_table: 'boq_items',
--     p_row: body,
--     p_pk: 'id',
--     p_user_id: user.id,
--     p_action: 'UPDATE',
--     p_old_values: oldData
--   })
--
-- Note: this is a SECURITY DEFINER function (runs as the owner, bypassing
-- RLS) so it must only be called from the server-side service-role client.
-- REVOKE from anon/authenticated ensures it can't be called from the browser.

CREATE OR REPLACE FUNCTION upsert_with_audit(
  p_table TEXT,
  p_row JSONB,
  p_pk TEXT,
  p_user_id TEXT,
  p_action TEXT,
  p_old_values JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_record_id TEXT;
  v_diff JSONB;
  v_result JSONB;
  v_update_cols TEXT;
  v_select_cols TEXT;
BEGIN
  v_record_id := p_row->>p_pk;

  -- Compute field-level diff for the audit trail (old vs new per changed field).
  IF p_old_values IS NOT NULL THEN
    SELECT COALESCE(jsonb_object_agg(
      key,
      jsonb_build_object('old', p_old_values->key, 'new', p_row->key)
    ) FILTER (WHERE p_old_values->key IS DISTINCT FROM p_row->key), '{}'::jsonb)
    INTO v_diff
    FROM jsonb_object_keys(p_row) AS key;
  END IF;

  -- Build the SET clause for the ON CONFLICT UPDATE (all cols except PK).
  SELECT string_agg(quote_ident(col) || ' = EXCLUDED.' || quote_ident(col), ', ')
  INTO v_update_cols
  FROM jsonb_object_keys(p_row) AS col
  WHERE col <> p_pk;

  SELECT string_agg(quote_ident(col), ', ')
  INTO v_select_cols
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

  -- Audit entry in the same transaction — rolls back if this fails.
  INSERT INTO audit_log (table_name, record_id, action, changed_by, changed_fields, old_values, new_values)
  VALUES (
    p_table,
    COALESCE(v_record_id, ''),
    p_action::TEXT,
    p_user_id,
    v_diff,
    p_old_values,
    p_row
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only the service_role can call this function (server-side audit logging).
REVOKE EXECUTE ON FUNCTION upsert_with_audit(TEXT, JSONB, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_with_audit(TEXT, JSONB, TEXT, TEXT, TEXT, JSONB) TO service_role;
