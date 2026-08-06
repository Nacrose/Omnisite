-- Migration: Phase 2 — Versioning, optimistic locking, approval engine, snapshots
--
-- Adds version columns to critical tables, creates the approval engine
-- and snapshot mechanism from the Technical Execution Plan.

-- ─── 1. Add version columns to critical tables ─────────────────────────────
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'purchase_orders', 'grns', 'boq_items', 'qs_items',
    'tasks', 'drawings', 'letters', 'equipment',
    'subcontractors', 'vendors', 'requisitions', 'stock_items'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id)', t);
  END LOOP;
END $$;

-- ─── 2. Updated_at trigger (already exists as update_updated_at, reuse) ────
-- The existing update_updated_at() function from migration 00000000000000
-- handles updated_at. We just need to apply it to new tables.
DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'units', 'material_units', 'unit_conversions',
    'labor_rates', 'project_locations'
  ] LOOP
    BEGIN
      EXECUTE format('CREATE TRIGGER set_updated_at_%s BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- ─── 3. Approval engine ────────────────────────────────────────────────────
-- Tracks approval requests for POs, GRNs, NCRs, RA Bills, etc.
--
-- SECURITY: both the USING and WITH CHECK clauses require role = 'PM'.
-- The previous WITH CHECK omitted the role predicate, which would have let
-- any project member (incl. FOREMAN) self-approve a change once the
-- approvals UI is wired up. Both clauses must agree — USING gates
-- existing rows, WITH CHECK gates new/updated rows.
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT')),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_project ON approval_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_record ON approval_requests(table_name, record_id);

ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approval_requests_read" ON approval_requests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = approval_requests.project_id));
CREATE POLICY "approval_requests_write_pm" ON approval_requests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = approval_requests.project_id AND role = 'PM'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = approval_requests.project_id AND role = 'PM'));

-- ─── 4. Snapshot mechanism ─────────────────────────────────────────────────
-- Captures point-in-time state of a record for audit/rollback.
CREATE TABLE IF NOT EXISTS record_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  snapshot_data JSONB NOT NULL,
  snapshot_reason TEXT NOT NULL DEFAULT 'MANUAL',
  snapshot_by UUID NOT NULL REFERENCES auth.users(id),
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_snapshots_record ON record_snapshots(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_project ON record_snapshots(project_id);

ALTER TABLE record_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshots_read" ON record_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = record_snapshots.project_id));
CREATE POLICY "snapshots_write_pm" ON record_snapshots FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = record_snapshots.project_id AND role = 'PM'));

-- ─── 5. Tolerance rules ────────────────────────────────────────────────────
-- Configurable tolerance for procurement 3-way matching.
CREATE TABLE IF NOT EXISTS tolerance_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('QTY', 'RATE', 'AMOUNT')),
  field_name TEXT NOT NULL,
  tolerance_pct NUMERIC NOT NULL DEFAULT 0 CHECK (tolerance_pct >= 0 AND tolerance_pct <= 100),
  tolerance_absolute NUMERIC DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE tolerance_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tolerance_read" ON tolerance_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "tolerance_write_pm" ON tolerance_rules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND role = 'PM'));

-- Seed default tolerance rules (5% qty, 2% rate)
INSERT INTO tolerance_rules (rule_type, field_name, tolerance_pct)
VALUES
  ('QTY', 'quantity', 5.0),
  ('RATE', 'rate', 2.0),
  ('AMOUNT', 'amount', 3.0)
ON CONFLICT DO NOTHING;

-- ─── 6. Match results (3-way match) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  po_id TEXT REFERENCES purchase_orders(id),
  grn_id TEXT REFERENCES grns(id),
  match_type TEXT NOT NULL CHECK (match_type IN ('TWO_WAY', 'THREE_WAY')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'MATCHED', 'VARIANCE', 'EXCEPTION', 'OVERRIDDEN')),
  qty_variance NUMERIC DEFAULT 0,
  rate_variance NUMERIC DEFAULT 0,
  amount_variance NUMERIC DEFAULT 0,
  override_reason TEXT,
  overridden_by UUID REFERENCES auth.users(id),
  overridden_at TIMESTAMPTZ,
  match_data JSONB,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_results_po ON match_results(po_id);
CREATE INDEX IF NOT EXISTS idx_match_results_grn ON match_results(grn_id);
CREATE INDEX IF NOT EXISTS idx_match_results_status ON match_results(status);

ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_results_read" ON match_results FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = match_results.project_id));
CREATE POLICY "match_results_write_pm" ON match_results FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = match_results.project_id AND role = 'PM'));

-- ─── 7. Billing holds (NCR → payment hold) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS billing_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  ncr_id TEXT REFERENCES qs_items(id),
  vendor_id TEXT,
  hold_type TEXT NOT NULL CHECK (hold_type IN ('NCR', 'GRN', 'MANUAL')),
  hold_reason TEXT NOT NULL,
  hold_amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RELEASED', 'PARTIAL')),
  released_by UUID REFERENCES auth.users(id),
  released_at TIMESTAMPTZ,
  release_notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_holds_ncr ON billing_holds(ncr_id);
CREATE INDEX IF NOT EXISTS idx_billing_holds_status ON billing_holds(status);

ALTER TABLE billing_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_holds_read" ON billing_holds FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = billing_holds.project_id));
CREATE POLICY "billing_holds_write_pm" ON billing_holds FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = billing_holds.project_id AND role = 'PM'));

-- ─── 8. Realtime ────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE approval_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE match_results;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE billing_holds;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
