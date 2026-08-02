-- ============================================================
-- OmniSite — Unified vendors + project_locations tables
-- Migration: 00000000000010
-- Date: 2026-08-10
--
-- Introduces the UNIFIED vendor master table that supersedes:
--   • the static VENDORS array in src/data/seed/admin.ts (4 suppliers)
--   • the subcontractors table's per-row SC data (3 subcontractors)
--
-- Going forward, `vendors` holds all third-party counterparties for a
-- project: suppliers, subcontractors, consultants, and labour gangs.
-- The category column drives which fields are populated. The legacy
-- `subcontractors` table is left in place for backward compatibility
-- (the existing SC module still reads it); a future migration will
-- migrate its rows into `vendors` and drop the table.
--
-- Also adds `project_locations` — physical work-face / asset locations
-- scoped to a project (bridge piers, road chainage, site campus). Each
-- location can be assigned to a vendor (typically a subcontractor) for
-- filtering the SC module's daily-face view.
--
-- Safe to re-run: every statement uses IF NOT EXISTS / DROP IF EXISTS.
-- ============================================================

-- ─── 1. vendors table (UNIFIED vendor master) ──────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,                    -- 'V-001' for suppliers, 'SC-01' for subcontractors
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'supplier' CHECK (category IN ('supplier', 'subcontractor', 'consultant', 'labour')),
  name TEXT NOT NULL,
  trade_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'blacklisted')),
  rating TEXT DEFAULT 'A' CHECK (rating IN ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C', '—')),

  -- Legal & compliance
  pan TEXT,
  gst TEXT,
  vat_no TEXT,

  -- Contact
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,

  -- Banking
  bank_account_name TEXT,
  bank_account_no TEXT,
  bank_name TEXT,
  bank_branch TEXT,
  bank_ifsc TEXT,

  -- Payment terms
  credit_days INTEGER DEFAULT 30,
  advance_pct NUMERIC DEFAULT 0,
  retention_pct NUMERIC DEFAULT 0,
  tds_section TEXT,
  tds_rate NUMERIC DEFAULT 0,

  -- Compliance documents (JSONB array of {type, expiry_date, file_url, uploaded_at, notes})
  docs JSONB DEFAULT '[]',

  -- Supply catalog (for suppliers) — JSONB array of {code, name, brand, rate, uom}
  materials_supplied JSONB DEFAULT '[]',

  -- Work items (for subcontractors) — JSONB array of ScItem objects
  work_items JSONB DEFAULT '[]',

  -- SC-specific fields
  scope TEXT,
  agreement_value NUMERIC DEFAULT 0,
  advance_paid NUMERIC DEFAULT 0,
  rework_cost NUMERIC DEFAULT 0,
  is_tunneling BOOLEAN DEFAULT FALSE,

  -- SC operational data (JSONB arrays, same shape as the current subcontractors table)
  material_issues JSONB DEFAULT '[]',
  material_returns JSONB DEFAULT '[]',
  consumables JSONB DEFAULT '[]',
  custom_deductibles JSONB DEFAULT '[]',
  assigned_tasks JSONB DEFAULT '[]',
  ncr_count INTEGER DEFAULT 0,
  incidents INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes: filter vendors by project + category (supplier list vs SC list),
-- and by project + status (active vs closed/blacklisted).
CREATE INDEX IF NOT EXISTS idx_vendors_project_category ON vendors (project_id, category);
CREATE INDEX IF NOT EXISTS idx_vendors_project_status   ON vendors (project_id, status);

-- ─── 2. project_locations table ────────────────────────────────────────────
-- `assigned_vendor_id` FK is added AFTER vendors exists (see §4 below).
CREATE TABLE IF NOT EXISTS project_locations (
  id TEXT PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  group_name TEXT DEFAULT 'General',
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  assigned_vendor_id TEXT,               -- FK to vendors(id) added in §4
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes: list locations per project (active-only is the common filter),
-- and look up locations by assigned vendor (the SC daily-face view).
CREATE INDEX IF NOT EXISTS idx_project_locations_project_status ON project_locations (project_id, status);
CREATE INDEX IF NOT EXISTS idx_project_locations_vendor        ON project_locations (assigned_vendor_id);

-- ─── 3. project_id indexes (consistent with migration 09 pattern) ──────────
CREATE INDEX IF NOT EXISTS vendors_project_id_idx          ON vendors (project_id);
CREATE INDEX IF NOT EXISTS project_locations_project_id_idx ON project_locations (project_id);

-- ─── 4. FK: project_locations.assigned_vendor_id → vendors(id) ─────────────
-- ON DELETE SET NULL: deleting a vendor un-assigns the location but keeps
-- the location row (the location still exists physically; it just loses its
-- vendor binding until someone re-assigns).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'project_locations_vendor_fk'
      AND conrelid = 'project_locations'::regclass
  ) THEN
    ALTER TABLE project_locations
      ADD CONSTRAINT project_locations_vendor_fk
      FOREIGN KEY (assigned_vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'project_locations_vendor_fk skipped: %', SQLERRM;
END $$;

-- ─── 5. Enable RLS ─────────────────────────────────────────────────────────
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_locations ENABLE ROW LEVEL SECURITY;

-- ─── 6. Helper: PM or SITE_ENGINEER on the project ─────────────────────────
-- project_locations writes are allowed for PM + Site Engineer (field setup is
-- done by engineers on site, not just PMs). vendors writes are gated similarly
-- for suppliers; subcontractors stay PM-only.
CREATE OR REPLACE FUNCTION user_has_pm_or_engineer_access(project_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_projects
    WHERE user_id = auth.uid()
    AND project_id = project_uuid
    AND role IN ('PM', 'SITE_ENGINEER')
  );
END;
$$;

-- ─── 7. RLS policies — project_locations ───────────────────────────────────
DROP POLICY IF EXISTS "project_locations_select" ON project_locations;
CREATE POLICY "project_locations_select" ON project_locations
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "project_locations_insert" ON project_locations;
CREATE POLICY "project_locations_insert" ON project_locations
  FOR INSERT WITH CHECK (user_has_pm_or_engineer_access(project_id));

DROP POLICY IF EXISTS "project_locations_update" ON project_locations;
CREATE POLICY "project_locations_update" ON project_locations
  FOR UPDATE USING (user_has_pm_or_engineer_access(project_id))
  WITH CHECK (user_has_pm_or_engineer_access(project_id));

DROP POLICY IF EXISTS "project_locations_delete" ON project_locations;
CREATE POLICY "project_locations_delete" ON project_locations
  FOR DELETE USING (user_has_pm_or_engineer_access(project_id));

-- ─── 8. RLS policies — vendors ─────────────────────────────────────────────
-- SELECT: anyone with project access (engineers, storekeepers, foremen all
-- need to read the AVL and SC list).
DROP POLICY IF EXISTS "vendors_select" ON vendors;
CREATE POLICY "vendors_select" ON vendors
  FOR SELECT USING (user_has_project_access(project_id));

-- Writes are split by category:
--   • suppliers (category = 'supplier')   → PM or SITE_ENGINEER
--   • subcontractors (category = 'subcontractor') → PM only (financial commitment)
--   • consultants / labour                → PM only (default to strict)
--
-- The WITH CHECK clause enforces both the project-access gate AND the
-- category-specific role gate on every INSERT/UPDATE. The USING clause on
-- UPDATE/DELETE additionally requires the existing row to satisfy the gate
-- (so a SITE_ENGINEER can't escalate by editing a subcontractor row).
DROP POLICY IF EXISTS "vendors_insert" ON vendors;
CREATE POLICY "vendors_insert" ON vendors
  FOR INSERT WITH CHECK (
    user_has_project_access(project_id)
    AND (
      user_has_pm_access(project_id)
      OR (category = 'supplier' AND user_has_pm_or_engineer_access(project_id))
    )
  );

DROP POLICY IF EXISTS "vendors_update" ON vendors;
CREATE POLICY "vendors_update" ON vendors
  FOR UPDATE USING (
    user_has_project_access(project_id)
    AND (
      user_has_pm_access(project_id)
      OR (category = 'supplier' AND user_has_pm_or_engineer_access(project_id))
    )
  ) WITH CHECK (
    user_has_project_access(project_id)
    AND (
      user_has_pm_access(project_id)
      OR (category = 'supplier' AND user_has_pm_or_engineer_access(project_id))
    )
  );

DROP POLICY IF EXISTS "vendors_delete" ON vendors;
CREATE POLICY "vendors_delete" ON vendors
  FOR DELETE USING (
    user_has_project_access(project_id)
    AND (
      user_has_pm_access(project_id)
      OR (category = 'supplier' AND user_has_pm_or_engineer_access(project_id))
    )
  );

-- ─── 9. updated_at triggers ────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_vendors_updated_at ON vendors;
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_project_locations_updated_at ON project_locations;
CREATE TRIGGER update_project_locations_updated_at
  BEFORE UPDATE ON project_locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 10. Realtime ──────────────────────────────────────────────────────────
-- Both tables drive list views that should update live in the admin and
-- subcontractor modules.
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE vendors; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE project_locations; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ============================================================
-- TODO (follow-up migration):
--
--   Add 'vendors' and 'project_locations' to the p_table allowlist in
--   upsert_with_audit() and delete_with_audit() (migration 07 / 09).
--   The current allowlist is:
--
--     'boq_items', 'tasks', 'dsr_entries', 'cbs_nodes', 'requisitions',
--     'purchase_orders', 'drawings', 'letters', 'qs_items', 'equipment',
--     'subcontractors', 'workers', 'chat_messages', 'projects',
--     'user_projects', 'grns', 'stock_items'
--
--   After adding the two new tables, API routes for vendors /
--   project_locations can use the transactional upsert_with_audit path
--   (business write + audit entry in one transaction) instead of the
--   legacy fire-and-forget logAudit().
-- ============================================================
