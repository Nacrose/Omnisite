-- Migration: Add `worker_attendance` table — per-day attendance records
--
-- Closes P1-13 in gap analysis. Previously, the Time & Attendance module
-- could only export today's snapshot as a single-day CSV — the pay-period
-- selector in the UI was decorative, and the export handler had a code
-- comment admitting "multi-day payroll requires per-day attendance tracking
-- (not yet implemented)".
--
-- This migration adds the per-day table. Each row is one worker's
-- attendance on one date (composite unique key on (worker_id, date)).
-- The Time & Attendance inspector now lets the foreman log hours per day;
-- the payroll CSV export walks the pay-period range and reads each row.
--
-- Schema mirrors the Worker.todayHours field but keyed by (worker, date)
-- so historical records survive across days. The Worker table keeps its
-- `today_hours` column for the "live today" snapshot; this table is the
-- historical record.

CREATE TABLE IF NOT EXISTS worker_attendance (
  id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  worker_id TEXT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  -- ISO date YYYY-MM-DD. Combined with worker_id this is the natural key.
  date TEXT NOT NULL,
  -- Total hours worked that day (regular + OT). Used by the payroll export.
  hours NUMERIC NOT NULL DEFAULT 0 CHECK (hours >= 0 AND hours <= 24),
  -- Computed OT hours for the day (hours above standardHours for the worker).
  -- Stored separately so the export doesn't need to re-derive it.
  ot_hours NUMERIC NOT NULL DEFAULT 0 CHECK (ot_hours >= 0),
  -- Optional override of the worker's wage_rate for this day (e.g. a holiday
  -- rate). NULL = use workers.wage_rate.
  wage_override NUMERIC,
  -- Free-text note for the day (e.g. "half-day - personal leave", "rain stop").
  note TEXT,
  -- Who logged this entry (auth.users.id). NULL in demo mode.
  logged_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1,
  -- Composite unique constraint so re-inserting the same (worker, date)
  -- updates instead of duplicating. The ON CONFLICT clause in upsertWithAudit
  -- uses the PK `id`, so the app generates deterministic ids like
  -- `WA-<workerId>-<YYYY-MM-DD>` to make re-inserts idempotent.
  CONSTRAINT worker_attendance_worker_date_unique UNIQUE (worker_id, date)
);

CREATE INDEX IF NOT EXISTS idx_worker_attendance_project_date
  ON worker_attendance(project_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_worker_attendance_worker_date
  ON worker_attendance(worker_id, date DESC);

-- updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_worker_attendance ON worker_attendance;
CREATE TRIGGER set_updated_at_worker_attendance
  BEFORE UPDATE ON worker_attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row-Level Security ─────────────────────────────────────────────────────
-- Read: any project member (PM, Site Engineer, Storekeeper, Foreman).
-- Write: PM, Site Engineer, Foreman. Storekeeper is read-only (they don't
-- manage labour). Delete: PM only (admin cleanup).
ALTER TABLE worker_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "worker_attendance_select" ON worker_attendance;
CREATE POLICY "worker_attendance_select" ON worker_attendance
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_projects
      WHERE user_id = auth.uid()
        AND project_id = worker_attendance.project_id
    )
  );

DROP POLICY IF EXISTS "worker_attendance_insert" ON worker_attendance;
CREATE POLICY "worker_attendance_insert" ON worker_attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_projects
      WHERE user_id = auth.uid()
        AND project_id = worker_attendance.project_id
        AND role IN ('PM', 'SITE_ENGINEER', 'FOREMAN')
    )
  );

DROP POLICY IF EXISTS "worker_attendance_update" ON worker_attendance;
CREATE POLICY "worker_attendance_update" ON worker_attendance
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_projects
      WHERE user_id = auth.uid()
        AND project_id = worker_attendance.project_id
        AND role IN ('PM', 'SITE_ENGINEER', 'FOREMAN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_projects
      WHERE user_id = auth.uid()
        AND project_id = worker_attendance.project_id
        AND role IN ('PM', 'SITE_ENGINEER', 'FOREMAN')
    )
  );

DROP POLICY IF EXISTS "worker_attendance_delete" ON worker_attendance;
CREATE POLICY "worker_attendance_delete" ON worker_attendance
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_projects
      WHERE user_id = auth.uid()
        AND project_id = worker_attendance.project_id
        AND role = 'PM'
    )
  );

-- ─── Add worker_attendance to the audit allowlist ─────────────────────────
-- Same pattern as migrations 28, 29, 30.

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
    'material_issue_notes',
    'notifications',
    -- Added in migration 31 — per-day attendance records
    'worker_attendance'
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
    'material_issue_notes',
    'notifications',
    -- Added in migration 31
    'worker_attendance'
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

-- ─── Realtime ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE worker_attendance;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
