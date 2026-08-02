-- ============================================================
-- OmniSite — Drawing annotations + drawings file-type columns
-- Migration: 00000000000013
-- Date: 2026-08-13
--
-- Introduces the `drawing_annotations` table — one row per Fabric.js
-- markup object drawn on top of a PDF page in the Drawings module.
-- Markups are stored SEPARATELY from the original PDF file, which is
-- never mutated. Each row carries:
--   • the Fabric.js-serialized object (so the markup can be re-rendered)
--   • author + timestamp (audit trail per annotation)
--   • type / color / stroke-width (for filtering + legend rendering)
--   • page_number + normalized (x, y, w, h) so the overlay scales with
--     the PDF zoom level without re-serializing Fabric.js data
--
-- Also extends `drawings` with file-type metadata so the module can
-- route PDFs through the in-browser viewer + markup overlay, while
-- DWG / DXF / ZIP / RAR files are presented as downloadable source
-- files (no in-browser rendering — those formats need native CAD tools).
--
-- Adds `drawing_annotations` to the upsert_with_audit / delete_with_audit
-- allowlist so the transactional audit path covers it.
--
-- Safe to re-run: every statement uses IF NOT EXISTS / DROP IF EXISTS.
-- ============================================================

-- ─── 1. drawings file-type columns ──────────────────────────────────────────
-- `file_type` discriminates between 'pdf' (full viewer + markup) and
--   'dwg' | 'dxf' | 'zip' | 'rar' | 'image' (download-only).
-- `file_url`     — for PDFs, the URL the viewer renders.
-- `source_file_url` — for DWG/DXF/ZIP/RAR, the download URL.
-- `file_size`    — bytes, surfaced in the download card.
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'pdf';
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS source_file_url TEXT;
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- ─── 2. drawing_annotations table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drawing_annotations (
  id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  drawing_id TEXT NOT NULL,  -- FK to drawings(id) — left un-constrained so
                             -- legacy / seed rows don't fail the migration.
  page_number INTEGER NOT NULL DEFAULT 1,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('freehand', 'rectangle', 'text', 'stamp', 'arrow', 'circle')),
  color TEXT DEFAULT '#ef4444',
  stroke_width NUMERIC DEFAULT 2,
  -- Fabric.js object data (JSON serialized). The full Fabric.js serialized
  -- object graph is stored here so the markup can be re-rendered exactly.
  fabric_data JSONB NOT NULL,
  -- Text content for text/stamp annotations (so the list view can render a
  -- preview without deserializing Fabric.js).
  text_content TEXT,
  -- Position on page (normalized 0-1 coordinates so they scale with zoom).
  x NUMERIC NOT NULL,
  y NUMERIC NOT NULL,
  width NUMERIC,
  height NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS drawing_annotations_drawing_page_idx
  ON drawing_annotations (drawing_id, page_number);
CREATE INDEX IF NOT EXISTS drawing_annotations_project_idx
  ON drawing_annotations (project_id);

-- ─── 3. RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE drawing_annotations ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone with project access can read (engineers, foremen, PMs).
DROP POLICY IF EXISTS "drawing_annotations_select" ON drawing_annotations;
CREATE POLICY "drawing_annotations_select" ON drawing_annotations
  FOR SELECT USING (user_has_project_access(project_id));

-- Writes (INSERT/UPDATE/DELETE) require PM or SITE_ENGINEER — markups are
-- redlines that change the contractual record. Field teams (foremen,
-- storekeepers) can read but not annotate.
DROP POLICY IF EXISTS "drawing_annotations_insert" ON drawing_annotations;
CREATE POLICY "drawing_annotations_insert" ON drawing_annotations
  FOR INSERT WITH CHECK (user_has_pm_or_engineer_access(project_id));

DROP POLICY IF EXISTS "drawing_annotations_update" ON drawing_annotations;
CREATE POLICY "drawing_annotations_update" ON drawing_annotations
  FOR UPDATE USING (user_has_pm_or_engineer_access(project_id))
  WITH CHECK (user_has_pm_or_engineer_access(project_id));

DROP POLICY IF EXISTS "drawing_annotations_delete" ON drawing_annotations;
CREATE POLICY "drawing_annotations_delete" ON drawing_annotations
  FOR DELETE USING (user_has_pm_or_engineer_access(project_id));

-- ─── 4. updated_at trigger ──────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_drawing_annotations_updated_at ON drawing_annotations;
CREATE TRIGGER update_drawing_annotations_updated_at
  BEFORE UPDATE ON drawing_annotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 5. Realtime ────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE drawing_annotations; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ─── 6. Add drawing_annotations to audit allowlist ──────────────────────────
-- Recreate upsert_with_audit() and delete_with_audit() with the new table
-- in the allowlist so the API route can use the transactional audit path
-- (business write + audit entry in a single Postgres transaction).
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
    -- Added in migration 11
    'vendors', 'project_locations',
    -- Added in migration 13 — drawing annotations (markups on PDFs)
    'drawing_annotations'
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
    -- Added in migration 13
    'drawing_annotations'
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
