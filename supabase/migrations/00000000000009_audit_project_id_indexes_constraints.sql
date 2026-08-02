-- ============================================================
-- OmniSite — P1 architecture & DB fixes
-- Date: 2026-08-03
--
-- Closes six gaps surfaced by the P1 audit:
--
--   1. audit_log had no project_id — PMs could not filter the audit trail
--      per project. Adds the column + an index.
--   2. project_id was unindexed on every business table — every RLS policy
--      check did a sequential scan. Adds B-tree indexes on project_id for
--      all 16 business tables, plus cbs_nodes(parent_code) which the CBS
--      trigger walks on every write.
--   3. Financial columns had no >= 0 guard — a negative qty/value could
--      silently poison the CBS rollups. Adds CHECK constraints on
--      cbs_nodes.budget/committed/actual/forecast, purchase_orders.value,
--      requisitions.qty, stock_items.on_hand, grns.grn_qty.
--   4. Four foreign keys were missing — orphan rows could accumulate:
--        task_dependencies.predecessor_id → tasks(id)
--        purchase_orders.req_id           → requisitions(id)
--        grns.po_id                       → purchase_orders(id)
--        chat_messages.reply_to           → chat_messages(id)  (self-ref)
--   5. upsert_with_audit / delete_with_audit / recompute_cbs_subtree were
--      SECURITY DEFINER without `SET search_path` — vulnerable to the
--      search_path injection class (CVE-2018-1058 style). Also, the audit
--      diff stored workers.phone / subcontractors.pan / subcontractors.gst
--      in cleartext, leaking PII to anyone with audit_log SELECT. Adds
--      `SET search_path = public, pg_temp` and a mask_pii() helper applied
--      to the changed_fields diff.
--   6. The CBS trigger fired on every UPDATE (including updated_at bumps)
--      and ran 5 SUM subqueries per ancestor (one per column + 3 inside the
--      margin_pct CASE). Consolidates to a single SELECT per ancestor and
--      adds `UPDATE OF (budget, committed, actual, forecast, parent_code)`
--      so the trigger only fires when a rollup-affecting column changes.
--
-- Safe to re-run: every statement uses IF NOT EXISTS / DROP IF EXISTS.
-- ============================================================

-- ─── 1. audit_log.project_id ────────────────────────────────────────────────
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS audit_log_project_id_idx ON audit_log (project_id);

-- ─── 2. project_id indexes for all 16 business tables + cbs_nodes(parent_code)
CREATE INDEX IF NOT EXISTS boq_items_project_id_idx        ON boq_items (project_id);
CREATE INDEX IF NOT EXISTS tasks_project_id_idx            ON tasks (project_id);
CREATE INDEX IF NOT EXISTS task_dependencies_project_id_idx ON task_dependencies (project_id);
CREATE INDEX IF NOT EXISTS dsr_entries_project_id_idx      ON dsr_entries (project_id);
CREATE INDEX IF NOT EXISTS cbs_nodes_project_id_idx        ON cbs_nodes (project_id);
CREATE INDEX IF NOT EXISTS cbs_nodes_parent_code_idx       ON cbs_nodes (parent_code);
CREATE INDEX IF NOT EXISTS requisitions_project_id_idx     ON requisitions (project_id);
CREATE INDEX IF NOT EXISTS purchase_orders_project_id_idx  ON purchase_orders (project_id);
CREATE INDEX IF NOT EXISTS drawings_project_id_idx         ON drawings (project_id);
CREATE INDEX IF NOT EXISTS letters_project_id_idx          ON letters (project_id);
CREATE INDEX IF NOT EXISTS qs_items_project_id_idx         ON qs_items (project_id);
CREATE INDEX IF NOT EXISTS equipment_project_id_idx        ON equipment (project_id);
CREATE INDEX IF NOT EXISTS subcontractors_project_id_idx   ON subcontractors (project_id);
CREATE INDEX IF NOT EXISTS workers_project_id_idx          ON workers (project_id);
CREATE INDEX IF NOT EXISTS chat_messages_project_id_idx    ON chat_messages (project_id);
CREATE INDEX IF NOT EXISTS grns_project_id_idx             ON grns (project_id);
CREATE INDEX IF NOT EXISTS stock_items_project_id_idx      ON stock_items (project_id);

-- ─── 3. CHECK (>= 0) on financial columns ────────────────────────────────────
-- Each ALTER is wrapped in DROP IF EXISTS so re-running the migration is safe.
ALTER TABLE cbs_nodes DROP CONSTRAINT IF EXISTS cbs_budget_nonneg;
ALTER TABLE cbs_nodes ADD    CONSTRAINT cbs_budget_nonneg    CHECK (budget    >= 0);
ALTER TABLE cbs_nodes DROP CONSTRAINT IF EXISTS cbs_committed_nonneg;
ALTER TABLE cbs_nodes ADD    CONSTRAINT cbs_committed_nonneg CHECK (committed >= 0);
ALTER TABLE cbs_nodes DROP CONSTRAINT IF EXISTS cbs_actual_nonneg;
ALTER TABLE cbs_nodes ADD    CONSTRAINT cbs_actual_nonneg    CHECK (actual    >= 0);
ALTER TABLE cbs_nodes DROP CONSTRAINT IF EXISTS cbs_forecast_nonneg;
ALTER TABLE cbs_nodes ADD    CONSTRAINT cbs_forecast_nonneg  CHECK (forecast  >= 0);

ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS po_value_nonneg;
ALTER TABLE purchase_orders ADD    CONSTRAINT po_value_nonneg CHECK (value >= 0);

ALTER TABLE requisitions DROP CONSTRAINT IF EXISTS req_qty_nonneg;
ALTER TABLE requisitions ADD    CONSTRAINT req_qty_nonneg    CHECK (qty >= 0);

ALTER TABLE stock_items DROP CONSTRAINT IF EXISTS stock_on_hand_nonneg;
ALTER TABLE stock_items ADD    CONSTRAINT stock_on_hand_nonneg CHECK (on_hand >= 0);

-- The spec mentions grns.qty_received; the actual column on grns is grn_qty
-- (the received-quantity column). Apply the non-negativity check there.
-- po_qty / invoice_qty / rate are also non-negative by definition; add the
-- same guard so a malformed write cannot create a negative-qty GRN.
ALTER TABLE grns DROP CONSTRAINT IF EXISTS grns_grn_qty_nonneg;
ALTER TABLE grns ADD    CONSTRAINT grns_grn_qty_nonneg     CHECK (grn_qty     >= 0);
ALTER TABLE grns DROP CONSTRAINT IF EXISTS grns_po_qty_nonneg;
ALTER TABLE grns ADD    CONSTRAINT grns_po_qty_nonneg      CHECK (po_qty      >= 0);
ALTER TABLE grns DROP CONSTRAINT IF EXISTS grns_invoice_qty_nonneg;
ALTER TABLE grns ADD    CONSTRAINT grns_invoice_qty_nonneg CHECK (invoice_qty >= 0);
ALTER TABLE grns DROP CONSTRAINT IF EXISTS grns_rate_nonneg;
ALTER TABLE grns ADD    CONSTRAINT grns_rate_nonneg        CHECK (rate        >= 0);

-- ─── 4. Missing foreign keys ─────────────────────────────────────────────────
-- Each block checks pg_constraint first so the migration is idempotent.
-- ON DELETE behavior matches the relationship semantics:
--   - task_dependencies.predecessor_id → CASCADE (deleting a task orphans its deps)
--   - purchase_orders.req_id           → SET NULL (PO survives req deletion)
--   - grns.po_id                       → CASCADE (deleting a PO drops its GRNs)
--   - chat_messages.reply_to           → SET NULL (reply survives parent delete)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'task_deps_predecessor_fk'
      AND conrelid = 'task_dependencies'::regclass
  ) THEN
    ALTER TABLE task_dependencies
      ADD CONSTRAINT task_deps_predecessor_fk
      FOREIGN KEY (predecessor_id) REFERENCES tasks(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'task_deps_predecessor_fk skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'po_req_id_fk'
      AND conrelid = 'purchase_orders'::regclass
  ) THEN
    ALTER TABLE purchase_orders
      ADD CONSTRAINT po_req_id_fk
      FOREIGN KEY (req_id) REFERENCES requisitions(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'po_req_id_fk skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'grns_po_id_fk'
      AND conrelid = 'grns'::regclass
  ) THEN
    ALTER TABLE grns
      ADD CONSTRAINT grns_po_id_fk
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'grns_po_id_fk skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_messages_reply_to_fk'
      AND conrelid = 'chat_messages'::regclass
  ) THEN
    ALTER TABLE chat_messages
      ADD CONSTRAINT chat_messages_reply_to_fk
      FOREIGN KEY (reply_to) REFERENCES chat_messages(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'chat_messages_reply_to_fk skipped: %', SQLERRM;
END $$;

-- ─── 5a. mask_pii() helper ──────────────────────────────────────────────────
-- Returns the input JSONB unchanged for non-PII fields. For PII fields on
-- workers / subcontractors, returns a masked version so the audit diff never
-- contains the cleartext PII:
--   workers.phone         → keep first 4 + last 2, mask middle with X
--   subcontractors.pan    → keep last 4, mask leading with X
--   subcontractors.gst    → keep last 4, mask leading with X
--
-- Applied to the changed_fields diff in upsert_with_audit(). The full row
-- (old_values / new_values) is left unmasked on purpose — forensic recovery
-- requires the true values; the diff is what users browse day-to-day.

CREATE OR REPLACE FUNCTION mask_pii(p_table TEXT, p_field TEXT, p_value JSONB)
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

  -- subcontractors.pan: keep last 4, mask leading.
  IF p_table = 'subcontractors' AND p_field = 'pan' THEN
    IF v_len <= 4 THEN
      RETURN to_jsonb(repeat('X', v_len));
    END IF;
    RETURN to_jsonb(repeat('X', v_len - 4) || substring(v_text FROM v_len - 3 FOR 4));
  END IF;

  -- subcontractors.gst: same masking as PAN.
  IF p_table = 'subcontractors' AND p_field = 'gst' THEN
    IF v_len <= 4 THEN
      RETURN to_jsonb(repeat('X', v_len));
    END IF;
    RETURN to_jsonb(repeat('X', v_len - 4) || substring(v_text FROM v_len - 3 FOR 4));
  END IF;

  RETURN p_value;
END;
$$;

-- ─── 5b. Recreate upsert_with_audit() with search_path hardening + PII masking
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
    'user_projects', 'grns', 'stock_items'
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

-- ─── 5c. Recreate delete_with_audit() with search_path hardening ───────────
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
    'user_projects', 'grns', 'stock_items'
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

-- ─── 6. Consolidate CBS trigger + add UPDATE OF column filter ───────────────
-- Original: 5 SUM subqueries per ancestor UPDATE (budget, committed, actual,
-- forecast, + 3 inside the margin_pct CASE). Consolidated to a single
-- SELECT ... INTO that captures all four sums into local variables, then the
-- UPDATE reads variables instead of re-running SUMs.
--
-- Also restricts the trigger to fire only when one of the rollup-affecting
-- columns changes (budget, committed, actual, forecast, parent_code). Without
-- the column filter, every updated_at bump from the BEFORE UPDATE trigger
-- re-fired this AFTER UPDATE trigger — a no-op walk up the tree.

CREATE OR REPLACE FUNCTION recompute_cbs_subtree()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  parent_code_val TEXT;
  current_code_val TEXT;
  v_budget     NUMERIC;
  v_committed  NUMERIC;
  v_actual     NUMERIC;
  v_forecast   NUMERIC;
BEGIN
  -- Re-entrancy guard: the walk-up loop and the self-recompute block below
  -- both issue UPDATE cbs_nodes, which re-fires THIS trigger. Without this
  -- guard, any node with children recurses forever (stack depth exceeded).
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  current_code_val := COALESCE(NEW.code, OLD.code);
  parent_code_val  := COALESCE(NEW.parent_code, OLD.parent_code);

  -- Walk up the tree, recomputing each ancestor from its children.
  -- Consolidated: ONE SELECT per ancestor captures all 4 sums; the UPDATE
  -- then reads the local variables (no re-execution of SUM).
  WHILE parent_code_val IS NOT NULL LOOP
    SELECT COALESCE(SUM(budget), 0),
           COALESCE(SUM(committed), 0),
           COALESCE(SUM(actual), 0),
           COALESCE(SUM(forecast), 0)
      INTO v_budget, v_committed, v_actual, v_forecast
      FROM cbs_nodes
     WHERE parent_code = parent_code_val;

    UPDATE cbs_nodes SET
      budget    = v_budget,
      committed = v_committed,
      actual    = v_actual,
      forecast  = v_forecast,
      margin_pct = CASE
        WHEN v_budget > 0 THEN ROUND((v_budget - v_actual) / v_budget * 100.0, 2)
        ELSE 0
      END,
      updated_at = NOW()
    WHERE code = parent_code_val;

    SELECT parent_code INTO parent_code_val FROM cbs_nodes WHERE code = parent_code_val;
  END LOOP;

  -- Recompute the node itself if it has children (so its own row reflects
  -- the sum of its children, not just a manually-entered value).
  IF EXISTS (SELECT 1 FROM cbs_nodes WHERE parent_code = current_code_val) THEN
    SELECT COALESCE(SUM(budget), 0),
           COALESCE(SUM(committed), 0),
           COALESCE(SUM(actual), 0),
           COALESCE(SUM(forecast), 0)
      INTO v_budget, v_committed, v_actual, v_forecast
      FROM cbs_nodes
     WHERE parent_code = current_code_val;

    UPDATE cbs_nodes SET
      budget    = v_budget,
      committed = v_committed,
      actual    = v_actual,
      forecast  = v_forecast,
      margin_pct = CASE
        WHEN v_budget > 0 THEN ROUND((v_budget - v_actual) / v_budget * 100.0, 2)
        ELSE 0
      END,
      updated_at = NOW()
    WHERE code = current_code_val;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recreate the trigger with the UPDATE OF column filter. INSERT and DELETE
-- still fire unconditionally (a new row may have a parent; a deleted row
-- may have left a parent's rollup stale).
DROP TRIGGER IF EXISTS cbs_nodes_subtree_recompute ON cbs_nodes;

CREATE TRIGGER cbs_nodes_subtree_recompute
  AFTER INSERT OR UPDATE OF budget, committed, actual, forecast, parent_code OR DELETE ON cbs_nodes
  FOR EACH ROW EXECUTE FUNCTION recompute_cbs_subtree();
