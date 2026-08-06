-- Migration: Add `rfis` table — moves RFI register from localStorage to DB
--
-- Closes the P1-14 stopgap documented in src/components/modules/daily-ops/rfi-store.ts:
-- RFIs were previously stored in localStorage via usePersistentState, which
-- meant an RFI created by an engineer on their laptop didn't appear on the
-- PM's desktop. This migration adds the `rfis` table + RLS + audit-allowlist
-- entry so the existing rfi-store.ts can switch to useSyncedState (the same
-- hybrid Supabase/localStorage hook every other module uses).
--
-- The table mirrors the Rfi TypeScript interface (rfi-store.ts:5) — every
-- app-level field maps to a DB column. The seed rows from INITIAL_RFIS are
-- included so the demo project shows realistic data on first run.

-- ─── 1. rfis table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfis (
  id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  number TEXT NOT NULL,
  date TEXT NOT NULL,
  subject TEXT NOT NULL,
  question TEXT NOT NULL,
  background TEXT NOT NULL DEFAULT '',
  impact TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Replied', 'Closed')),
  reply_by TEXT NOT NULL DEFAULT '',
  reply TEXT,
  replied_date TEXT,
  linked_dsr TEXT,
  cost_impact TEXT,
  schedule_impact TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  location_id UUID REFERENCES project_locations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_rfis_project_id ON rfis(project_id);
CREATE INDEX IF NOT EXISTS idx_rfis_status ON rfis(status);
CREATE INDEX IF NOT EXISTS idx_rfis_number ON rfis(number);

-- updated_at trigger — reuse the existing update_updated_at() function
-- defined in migration 00000000000000.
DROP TRIGGER IF EXISTS set_updated_at_rfis ON rfis;
CREATE TRIGGER set_updated_at_rfis
  BEFORE UPDATE ON rfis FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 2. Row-Level Security ─────────────────────────────────────────────────
-- Matches the pattern in migration 01 + 10/11: users see rows in projects
-- they're assigned to; PM + Site Engineer can write (RFIs are typically
-- raised by site engineers and answered/approved by PMs); Storekeeper
-- and Foreman are read-only (they need visibility but don't author RFIs).
ALTER TABLE rfis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rfis_select" ON rfis;
CREATE POLICY "rfis_select" ON rfis
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_projects
      WHERE user_id = auth.uid()
        AND project_id = rfis.project_id
    )
  );

DROP POLICY IF EXISTS "rfis_insert" ON rfis;
CREATE POLICY "rfis_insert" ON rfis
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_projects
      WHERE user_id = auth.uid()
        AND project_id = rfis.project_id
        AND role IN ('PM', 'SITE_ENGINEER')
    )
  );

DROP POLICY IF EXISTS "rfis_update" ON rfis;
CREATE POLICY "rfis_update" ON rfis
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_projects
      WHERE user_id = auth.uid()
        AND project_id = rfis.project_id
        AND role IN ('PM', 'SITE_ENGINEER')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_projects
      WHERE user_id = auth.uid()
        AND project_id = rfis.project_id
        AND role IN ('PM', 'SITE_ENGINEER')
    )
  );

DROP POLICY IF EXISTS "rfis_delete" ON rfis;
CREATE POLICY "rfis_delete" ON rfis
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_projects
      WHERE user_id = auth.uid()
        AND project_id = rfis.project_id
        AND role = 'PM'
    )
  );

-- ─── 3. Add rfis to the audit allowlist ───────────────────────────────────
-- Recreate upsert_with_audit() and delete_with_audit() with 'rfis' added
-- to the table allowlist so /api/rfis gets the same transactional audit
-- guarantee as every other table. All migration-09 hardening preserved.
-- Safe to re-run: CREATE OR REPLACE FUNCTION is idempotent.

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
    -- Added in migration 28 — RFI register (was localStorage-only before)
    'rfis'
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
    -- Added in migration 28
    'rfis'
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

-- ─── 4. Seed the demo project with the four RFIs that previously lived in
-- localStorage-only seed data. ON CONFLICT DO NOTHING so re-running the
-- migration is safe and doesn't overwrite edits made via the UI.
INSERT INTO rfis (
  id, project_id, number, date, subject, question, background, impact,
  status, reply_by, reply, replied_date, linked_dsr, cost_impact,
  schedule_impact, severity
) VALUES
  (
    'r1', '00000000-0000-0000-0000-000000000001', 'RFI-067', '22 Jul 2026',
    'Rebar detailing at expansion joint — chainage 4+200',
    'The contract drawings show lap splices of 40φ at the expansion joint, but the special detailing note on Sheet KRR-P3-DR-DR-008 Rev A calls for mechanical couplers in this zone. Please clarify which applies — and if couplers, what type (Type 1 vs Type 2 per ASTM A1035).',
    'DSR Entry D-087 — Foundation PCC at chainage 4+200 to 4+350. Rebar fabrication is scheduled to start 02 Aug 2026. The rebar shop drawings cannot be finalized until this is resolved.',
    'Schedule: ~3 days of float on T-203 (Foundation). If delayed beyond 02 Aug, the critical path slips and the Substructure milestone (T-404, Wk 48) is at risk. Cost: couplers add ~NPR 850/ea × ~120 locations = NPR 102,000 if required.',
    'Open', '26 Jul 2026', NULL, NULL, 'D-087',
    'NPR 102,000 (potential)', '3 days float on T-203', 'high'
  ),
  (
    'r2', '00000000-0000-0000-0000-000000000001', 'RFI-066', '20 Jul 2026',
    'Concrete cover for pile caps in aggressive soil zone',
    'The geotechnical report flags sulphate exposure (Class 2) at chainage 3+100 to 3+400. The BOQ specifies 50mm cover for pile caps, but IS 456:2000 Table 4 recommends 75mm for Class 2 exposure. Which applies?',
    'Pile cap pour for Section 2 is scheduled for 05 Aug 2026. ~42 pile caps affected across the chainage range.',
    'Cost: +25mm cover × 42 caps × nominal rebar increase ≈ NPR 145,000. No schedule impact — rebar already on site can be adjusted.',
    'Replied', '24 Jul 2026',
    'Engineer confirms 75mm cover required per IS 456:2000 for Class 2 sulphate exposure. Additional cost treated as a Variation Order per FIDIC Clause 13. Please submit BOQ adjustment via the Variation Order module.',
    '24 Jul 2026', 'D-085',
    'NPR 145,000 (confirmed → VO)', 'None', 'medium'
  ),
  (
    'r3', '00000000-0000-0000-0000-000000000001', 'RFI-065', '15 Jul 2026',
    'Drainage outlet invert levels at chainage 2+100',
    'The road profile drawing (KRR-P3-RD-PR-003) and the drainage drawing (KRR-P3-DR-DN-012) show conflicting invert levels for the outlet at ch. 2+100 (RL 1184.50 vs RL 1184.20). Which is correct?',
    'Drainage works at ch. 2+050 to 2+200 are underway. The excavation was paused at the outlet location pending clarification.',
    'Schedule: 1 day of rework if the wrong invert is cast. Cost: ~NPR 18,000 for rework if needed.',
    'Closed', '18 Jul 2026',
    'Engineer confirms RL 1184.20 (drainage drawing governs). Road profile will be revised in Rev B. No rework required as excavation was paused.',
    '17 Jul 2026', 'D-079',
    'None', '1 day saved (no rework)', 'low'
  ),
  (
    'r4', '00000000-0000-0000-0000-000000000001', 'RFI-068', '29 Jul 2026',
    'Shotcrete thickness tolerance for tunnel support',
    'The tunnel support drawing specifies 50mm nominal shotcrete with a +10/-0mm tolerance. At chainage 0+380 the rock face is irregular by up to 25mm. Do we apply min 50mm over the highest point, or over the nominal line?',
    'Tunnel face advance at ch. 0+380. The geological face log shows rock class III with local overbreak. Shotcrete application is scheduled for today.',
    'Quantity: +15% shotcrete consumption if applying over the highest point = ~0.4 cum extra per linear meter × ~12m affected = NPR 21,000. No schedule impact.',
    'Open', '31 Jul 2026', NULL, NULL, 'D-092',
    'NPR 21,000 (potential)', 'None', 'medium'
  )
ON CONFLICT (id) DO NOTHING;

-- ─── 5. Realtime ──────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE rfis;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
