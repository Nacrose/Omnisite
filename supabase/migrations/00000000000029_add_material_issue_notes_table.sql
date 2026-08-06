-- Migration: Add `material_issue_notes` (MINs) table
--
-- Closes the P1-16 stopgap documented in src/components/modules/procurement/index.tsx:92:
-- MINs were previously stored in localStorage via usePersistentState, so material
-- issues created by a site engineer weren't visible to the storekeeper on another
-- machine. This migration adds the `material_issue_notes` table + RLS + audit
-- allowlist entry so the procurement module can switch to useSyncedState.
--
-- Schema mirrors the MinNote TypeScript interface (procurement/types.ts:74).
-- Stock deduction is intentionally NOT done via a DB trigger here — it remains
-- an app-level concern in material-reconciliation.ts so the existing variance
-- tracking logic continues to work. A future trigger could decrement
-- stock_items.on_hand on MIN INSERT, but that's a separate design decision
-- (would require a stock_ledger table to be reversible).

CREATE TABLE IF NOT EXISTS material_issue_notes (
  id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  date TEXT NOT NULL,
  task TEXT NOT NULL,
  items TEXT NOT NULL,
  issued TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Issued' CHECK (status IN ('Issued', 'N/A')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_material_issue_notes_project_id
  ON material_issue_notes(project_id);
CREATE INDEX IF NOT EXISTS idx_material_issue_notes_status
  ON material_issue_notes(status);

-- updated_at trigger — reuse the existing update_updated_at() function.
DROP TRIGGER IF EXISTS set_updated_at_material_issue_notes
  ON material_issue_notes;
CREATE TRIGGER set_updated_at_material_issue_notes
  BEFORE UPDATE ON material_issue_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row-Level Security ─────────────────────────────────────────────────────
-- Storekeepers author MINs (they issue material from the store). Site engineers
-- also need to author (sometimes material is issued directly to a task without
-- going through the store). PMs can do everything. Foremen are read-only.
ALTER TABLE material_issue_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "material_issue_notes_select" ON material_issue_notes;
CREATE POLICY "material_issue_notes_select" ON material_issue_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_projects
      WHERE user_id = auth.uid()
        AND project_id = material_issue_notes.project_id
    )
  );

DROP POLICY IF EXISTS "material_issue_notes_insert" ON material_issue_notes;
CREATE POLICY "material_issue_notes_insert" ON material_issue_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_projects
      WHERE user_id = auth.uid()
        AND project_id = material_issue_notes.project_id
        AND role IN ('PM', 'SITE_ENGINEER', 'STOREKEEPER')
    )
  );

DROP POLICY IF EXISTS "material_issue_notes_update" ON material_issue_notes;
CREATE POLICY "material_issue_notes_update" ON material_issue_notes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_projects
      WHERE user_id = auth.uid()
        AND project_id = material_issue_notes.project_id
        AND role IN ('PM', 'SITE_ENGINEER', 'STOREKEEPER')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_projects
      WHERE user_id = auth.uid()
        AND project_id = material_issue_notes.project_id
        AND role IN ('PM', 'SITE_ENGINEER', 'STOREKEEPER')
    )
  );

DROP POLICY IF EXISTS "material_issue_notes_delete" ON material_issue_notes;
CREATE POLICY "material_issue_notes_delete" ON material_issue_notes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_projects
      WHERE user_id = auth.uid()
        AND project_id = material_issue_notes.project_id
        AND role IN ('PM', 'STOREKEEPER')
    )
  );

-- ─── Add material_issue_notes to the audit allowlist ──────────────────────
-- Same pattern as migration 28: CREATE OR REPLACE both functions with the
-- new table added to the allowlist. All migration-09 hardening preserved.

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
  IF p_table NOT IN (
    'boq_items', 'tasks', 'dsr_entries', 'cbs_nodes', 'requisitions',
    'purchase_orders', 'drawings', 'letters', 'qs_items', 'equipment',
    'subcontractors', 'workers', 'chat_messages', 'projects',
    'user_projects', 'grns', 'stock_items',
    'vendors', 'project_locations',
    'drawing_annotations',
    'rfis',
    -- Added in migration 29 — material issue notes
    'material_issue_notes'
  ) THEN
    RAISE EXCEPTION 'upsert_with_audit: table % not in allowlist', p_table
      USING ERRCODE = 'check_violation';
  END IF;

  v_record_id := p_row->>p_pk;

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

  SELECT string_agg(quote_ident(col) || ' = EXCLUDED.' || quote_ident(col), ', ')
  INTO v_update_cols
  FROM jsonb_object_keys(p_row) AS col
  WHERE col <> p_pk;

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

  BEGIN
    v_project_id := NULLIF(p_row->>'project_id', '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_project_id := NULL;
  END;

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

REVOKE EXECUTE ON FUNCTION upsert_with_audit(TEXT, JSONB, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_with_audit(TEXT, JSONB, TEXT, TEXT, TEXT, JSONB) TO service_role;

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
    'vendors', 'project_locations',
    'drawing_annotations',
    'rfis',
    -- Added in migration 29
    'material_issue_notes'
  ) THEN
    RAISE EXCEPTION 'delete_with_audit: table % not in allowlist', p_table
      USING ERRCODE = 'check_violation';
  END IF;

  EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE %I = $1', p_table, p_pk)
    INTO v_old
    USING p_record_id;

  IF v_old IS NULL THEN
    RETURN false;
  END IF;

  EXECUTE format('DELETE FROM %I WHERE %I = $1', p_table, p_pk)
    USING p_record_id;

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

-- ─── Seed the demo project with the 3 MINs that previously lived in
-- localStorage-only seed data (src/data/seed/procurement.ts INITIAL_MINS).
-- ON CONFLICT DO NOTHING so re-running is safe.
INSERT INTO material_issue_notes (id, project_id, date, task, items, issued, status)
VALUES
  ('MIN-0042', '00000000-0000-0000-0000-000000000001', '30 Jul', 'T-203 PCC M15',
   '392 bags cement, 12.8 cum sand', 'Bikash R.', 'Issued'),
  ('MIN-0041', '00000000-0000-0000-0000-000000000001', '29 Jul', 'T-301 Base slab',
   '3.2 MT steel, 60 sheets ply', 'Bikash R.', 'Issued'),
  ('MIN-0040', '00000000-0000-0000-0000-000000000001', '29 Jul', 'T-201 Excavation',
   'Diesel 180L (Excavator EX-200)', 'Bikash R.', 'Issued')
ON CONFLICT (id) DO NOTHING;

-- ─── Realtime ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE material_issue_notes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
