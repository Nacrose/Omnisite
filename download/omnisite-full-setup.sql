-- ============================================================
-- OmniSite — Full Database Setup
-- ============================================================
-- This file contains everything needed to set up your Supabase
-- database from scratch:
--   1. Schema (all tables)
--   2. RLS policies (row-level security)
--   3. Seed data (demo project + BOQ + tasks + CBS + Q&S + equipment + workers)
--   4. Task dependencies (CPM links for real critical path)
--   5. CBS subtree recompute trigger (keeps parent rollups in sync)
--
-- HOW TO USE:
--   1. Go to your Supabase Dashboard → SQL Editor
--   2. Click "New query"
--   3. Paste this entire file
--   4. Click Run (Ctrl+Enter)
--
-- If you already have some of this set up, the IF NOT EXISTS and
-- ON CONFLICT clauses make it safe to re-run.
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  PART 1: SCHEMA                                          ║
-- ╚══════════════════════════════════════════════════════════╝


-- ============================================================
-- OmniSite — Database Schema for Supabase (fixed: no subquery in DEFAULT)
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Projects (multi-tenancy)
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  location TEXT,
  value NUMERIC DEFAULT 0,
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default projects (with fixed UUIDs that match the client-side PROJECTS array)
INSERT INTO projects (id, name, code, location, value, progress, status)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Kathmandu Ring Road Expansion — Package 3', 'KRR-P3', 'Kathmandu', 487400000, 62, 'active'),
  ('00000000-0000-0000-0000-000000000002', 'Melamchi Water Supply — Treatment Plant', 'MWS-TP', 'Sindhupalchok', 1200000000, 78, 'active'),
  ('00000000-0000-0000-0000-000000000003', 'Pokhara International Airport — Terminal', 'PIA-T', 'Pokhara', 640000000, 45, 'active'),
  ('00000000-0000-0000-0000-000000000004', 'Fast Track Expressway — Section 4', 'FT-E4', 'Makwanpur', 2100000000, 12, 'active'),
  ('00000000-0000-0000-0000-000000000005', 'Bharatpur Hospital — New Wing', 'BHR-NW', 'Chitwan', 320000000, 100, 'closed')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Business tables — project_id has NO subquery DEFAULT.
-- The app always passes project_id explicitly on every INSERT,
-- so no DEFAULT is needed.
-- ============================================================

CREATE TABLE IF NOT EXISTS boq_items (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Priced',
  qty NUMERIC DEFAULT 0,
  uom TEXT,
  rate NUMERIC DEFAULT 0,
  has_ra BOOLEAN DEFAULT false,
  level INTEGER DEFAULT 0,
  parent_id TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Work',
  start_week INTEGER DEFAULT 0,
  duration INTEGER DEFAULT 1,
  progress INTEGER DEFAULT 0,
  baseline_start INTEGER DEFAULT 0,
  baseline_finish INTEGER DEFAULT 0,
  critical BOOLEAN DEFAULT false,
  constraints TEXT,
  parent_id TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Task dependency links for CPM (Critical Path Method) scheduling.
-- Each row represents a dependency: successor (task_id) depends on
-- predecessor (predecessor_id) with a given relationship type and lag.
--
-- Relationship types (standard CPM):
--   FS = Finish-to-Start (predecessor must finish before successor starts)
--   SS = Start-to-Start  (predecessor must start before successor starts)
--   FF = Finish-to-Finish (predecessor must finish before successor finishes)
--   SF = Start-to-Finish  (predecessor must start before successor finishes)
-- Lag is in weeks (can be negative for lead/acceleration).
CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  predecessor_id TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'FS' CHECK (link_type IN ('FS', 'SS', 'FF', 'SF')),
  lag_weeks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, predecessor_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_task_deps_successor ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_predecessor ON task_dependencies(predecessor_id);

CREATE TABLE IF NOT EXISTS dsr_entries (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  task TEXT NOT NULL,
  source TEXT DEFAULT 'Sched',
  chainage TEXT,
  planned NUMERIC DEFAULT 0,
  actual NUMERIC DEFAULT 0,
  uom TEXT,
  status TEXT DEFAULT 'in-progress',
  has_rfi BOOLEAN DEFAULT false,
  has_photos BOOLEAN DEFAULT false,
  remarks TEXT,
  date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cbs_nodes (
  code TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  budget NUMERIC DEFAULT 0,
  committed NUMERIC DEFAULT 0,
  actual NUMERIC DEFAULT 0,
  forecast NUMERIC DEFAULT 0,
  margin_pct NUMERIC DEFAULT 0,
  level INTEGER DEFAULT 0,
  parent_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requisitions (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  item TEXT NOT NULL,
  uom TEXT,
  qty NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Draft',
  source TEXT DEFAULT 'Sched',
  vendors JSONB DEFAULT '[]',
  override_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  vendor TEXT NOT NULL,
  date TEXT,
  value NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  items INTEGER DEFAULT 0,
  has_grn BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drawings (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  revision TEXT DEFAULT 'A',
  date TEXT,
  status TEXT DEFAULT 'Pending',
  size TEXT DEFAULT 'A2',
  discipline TEXT,
  links JSONB DEFAULT '[]',
  history JSONB DEFAULT '[]',
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS letters (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  number TEXT NOT NULL,
  date TEXT,
  type TEXT NOT NULL,
  from_party TEXT,
  to_party TEXT,
  subject TEXT,
  reply_by TEXT,
  reply_to TEXT,
  has_variation BOOLEAN DEFAULT false,
  body TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS qs_items (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  linked_boq TEXT,
  status TEXT DEFAULT 'Open',
  date TEXT,
  assignee TEXT,
  due_date TEXT,
  severity TEXT,
  billing_hold BOOLEAN DEFAULT false,
  cap JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  type TEXT,
  status TEXT DEFAULT 'idle',
  owned BOOLEAN DEFAULT false,
  operator TEXT,
  license_expiry TEXT,
  charge_rate NUMERIC DEFAULT 0,
  fuel_today NUMERIC DEFAULT 0,
  hours_today NUMERIC DEFAULT 0,
  burn_rate NUMERIC DEFAULT 0,
  burn_norm NUMERIC DEFAULT 0,
  rental JSONB,
  docs JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subcontractors (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  scope TEXT,
  agreement_value NUMERIC DEFAULT 0,
  advance_paid NUMERIC DEFAULT 0,
  advance_pct NUMERIC DEFAULT 10,
  retention_pct NUMERIC DEFAULT 5,
  rework_cost NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  pan TEXT,
  gst TEXT,
  insurance_expiry TEXT,
  labour_license_expiry TEXT,
  is_tunneling BOOLEAN DEFAULT false,
  items JSONB DEFAULT '[]',
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

CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  trade TEXT,
  phone TEXT,
  status TEXT DEFAULT 'off-site',
  clock_in TEXT,
  clock_out TEXT,
  geo_fence BOOLEAN DEFAULT true,
  today_hours NUMERIC DEFAULT 0,
  allocated JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_initials TEXT,
  sender_color TEXT,
  channel_id TEXT DEFAULT 'general',
  content TEXT,
  message_type TEXT DEFAULT 'text',
  media_url TEXT,
  reply_to UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Enable Row Level Security
-- ============================================================
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE boq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dsr_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cbs_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE qs_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Enable Realtime for live updates
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE boq_items;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE dsr_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE cbs_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- ============================================================
-- Updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_boq_items_updated_at BEFORE UPDATE ON boq_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_dsr_entries_updated_at BEFORE UPDATE ON dsr_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_cbs_nodes_updated_at BEFORE UPDATE ON cbs_nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_requisitions_updated_at BEFORE UPDATE ON requisitions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_drawings_updated_at BEFORE UPDATE ON drawings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_letters_updated_at BEFORE UPDATE ON letters FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_qs_items_updated_at BEFORE UPDATE ON qs_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_subcontractors_updated_at BEFORE UPDATE ON subcontractors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON workers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON chat_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── CBS subtree recompute trigger ─────────────────────────────────────────
-- After any INSERT/UPDATE/DELETE on cbs_nodes, walks UP the tree and
-- recomputes each ancestor's budget/committed/actual/forecast/margin_pct
-- from its children. Ensures rollups stay correct regardless of write path.
CREATE OR REPLACE FUNCTION recompute_cbs_subtree()
RETURNS TRIGGER AS $$
DECLARE
  parent_code_val TEXT;
  current_code_val TEXT;
BEGIN
  current_code_val := COALESCE(NEW.code, OLD.code);
  parent_code_val := COALESCE(NEW.parent_code, OLD.parent_code);

  WHILE parent_code_val IS NOT NULL LOOP
    UPDATE cbs_nodes SET
      budget = COALESCE((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = parent_code_val), 0),
      committed = COALESCE((SELECT SUM(committed) FROM cbs_nodes WHERE parent_code = parent_code_val), 0),
      actual = COALESCE((SELECT SUM(actual) FROM cbs_nodes WHERE parent_code = parent_code_val), 0),
      forecast = COALESCE((SELECT SUM(forecast) FROM cbs_nodes WHERE parent_code = parent_code_val), 0),
      margin_pct = CASE
        WHEN COALESCE((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = parent_code_val), 0) > 0
        THEN ROUND(
          ((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = parent_code_val) -
           (SELECT SUM(actual) FROM cbs_nodes WHERE parent_code = parent_code_val)) /
          (SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = parent_code_val) * 100.0,
          2
        )
        ELSE 0
      END,
      updated_at = NOW()
    WHERE code = parent_code_val;
    SELECT parent_code INTO parent_code_val FROM cbs_nodes WHERE code = parent_code_val;
  END LOOP;

  IF EXISTS (SELECT 1 FROM cbs_nodes WHERE parent_code = current_code_val) THEN
    UPDATE cbs_nodes SET
      budget = COALESCE((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = current_code_val), 0),
      committed = COALESCE((SELECT SUM(committed) FROM cbs_nodes WHERE parent_code = current_code_val), 0),
      actual = COALESCE((SELECT SUM(actual) FROM cbs_nodes WHERE parent_code = current_code_val), 0),
      forecast = COALESCE((SELECT SUM(forecast) FROM cbs_nodes WHERE parent_code = current_code_val), 0),
      margin_pct = CASE
        WHEN COALESCE((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = current_code_val), 0) > 0
        THEN ROUND(
          ((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = current_code_val) -
           (SELECT SUM(actual) FROM cbs_nodes WHERE parent_code = current_code_val)) /
          (SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = current_code_val) * 100.0,
          2
        )
        ELSE 0
      END,
      updated_at = NOW()
    WHERE code = current_code_val;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER cbs_nodes_subtree_recompute
  AFTER INSERT OR UPDATE OR DELETE ON cbs_nodes
  FOR EACH ROW EXECUTE FUNCTION recompute_cbs_subtree();


-- ╔══════════════════════════════════════════════════════════╗
-- ║  PART 2: RLS POLICIES                                   ║
-- ╚══════════════════════════════════════════════════════════╝


-- ============================================================
-- OmniSite — Row Level Security (RLS) Policies
-- ============================================================
-- Run this in Supabase SQL Editor AFTER running supabase-schema.sql.
--
-- This replaces the "Allow all for development" policies with real
-- per-user, per-project policies that enforce:
--   1. Users can only see data for projects they're assigned to.
--   2. Users can only write data for projects they're assigned to.
--   3. PMs have full access to all projects.
--   4. The service_role (used for audit logging) bypasses RLS entirely.
--
-- ASSUMPTION: A `user_projects` table exists (or will be created below)
-- that maps auth.users(id) → projects(id) with a role column.
-- ============================================================

-- ─── 1. Create user_projects junction table ────────────────────────────────
-- Maps users to projects with their role on each project.
CREATE TABLE IF NOT EXISTS user_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'SITE_ENGINEER', -- PM, SITE_ENGINEER, STOREKEEPER, FOREMAN
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;

-- Users can read their own project assignments.
-- PMs can read all assignments.
DROP POLICY IF EXISTS "users_read_own_assignments" ON user_projects;
CREATE POLICY "users_read_own_assignments" ON user_projects
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.role = 'PM'
    )
  );

-- Users can be assigned to projects only by PMs.
DROP POLICY IF EXISTS "pms_insert_assignments" ON user_projects;
CREATE POLICY "pms_insert_assignments" ON user_projects
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.role = 'PM'
    )
  );

-- Only PMs can delete assignments.
DROP POLICY IF EXISTS "pms_delete_assignments" ON user_projects;
CREATE POLICY "pms_delete_assignments" ON user_projects
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.role = 'PM'
    )
  );

-- PMs can update assignments (e.g. change a user's role on a project).
DROP POLICY IF EXISTS "pms_update_assignments" ON user_projects;
CREATE POLICY "pms_update_assignments" ON user_projects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.role = 'PM'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.role = 'PM'
    )
  );

-- ─── 2. Helper function: check if user has access to a project ─────────────
-- Returns true if the user is assigned to the project (any role) or is a PM.
CREATE OR REPLACE FUNCTION user_has_project_access(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_projects
    WHERE user_id = auth.uid()
    AND (project_id = project_uuid OR role = 'PM')
  );
END;
$$ LANGUAGE plpgsql;

-- ─── 3. Drop the "Allow all for development" policies ──────────────────────
DROP POLICY IF EXISTS "Allow all for development" ON projects;
DROP POLICY IF EXISTS "Allow all for development" ON boq_items;
DROP POLICY IF EXISTS "Allow all for development" ON tasks;
DROP POLICY IF EXISTS "Allow all for development" ON dsr_entries;
DROP POLICY IF EXISTS "Allow all for development" ON cbs_nodes;
DROP POLICY IF EXISTS "Allow all for development" ON requisitions;
DROP POLICY IF EXISTS "Allow all for development" ON purchase_orders;
DROP POLICY IF EXISTS "Allow all for development" ON drawings;
DROP POLICY IF EXISTS "Allow all for development" ON letters;
DROP POLICY IF EXISTS "Allow all for development" ON qs_items;
DROP POLICY IF EXISTS "Allow all for development" ON equipment;
DROP POLICY IF EXISTS "Allow all for development" ON subcontractors;
DROP POLICY IF EXISTS "Allow all for development" ON workers;
DROP POLICY IF EXISTS "Allow all for development" ON chat_messages;

-- ─── 4. Projects table policies ────────────────────────────────────────────
-- Users can see projects they're assigned to. PMs see all.
DROP POLICY IF EXISTS "projects_select_assigned" ON projects;
CREATE POLICY "projects_select_assigned" ON projects
  FOR SELECT USING (
    user_has_project_access(id)
  );

-- Only PMs can create/update/delete projects.
DROP POLICY IF EXISTS "projects_pms_write" ON projects;
CREATE POLICY "projects_pms_write" ON projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.role = 'PM'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.role = 'PM'
    )
  );

-- ─── 5. Business table policies (repeated pattern) ────────────────────────
-- For each business table: SELECT/INSERT/UPDATE/DELETE are allowed only if
-- the user has access to the row's project_id.

-- ─── boq_items ──
DROP POLICY IF EXISTS "boq_items_select" ON boq_items;
CREATE POLICY "boq_items_select" ON boq_items
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "boq_items_insert" ON boq_items;
CREATE POLICY "boq_items_insert" ON boq_items
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "boq_items_update" ON boq_items;
CREATE POLICY "boq_items_update" ON boq_items
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "boq_items_delete" ON boq_items;
CREATE POLICY "boq_items_delete" ON boq_items
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── tasks ──
DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── dsr_entries ──
DROP POLICY IF EXISTS "dsr_select" ON dsr_entries;
CREATE POLICY "dsr_select" ON dsr_entries
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "dsr_insert" ON dsr_entries;
CREATE POLICY "dsr_insert" ON dsr_entries
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "dsr_update" ON dsr_entries;
CREATE POLICY "dsr_update" ON dsr_entries
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "dsr_delete" ON dsr_entries;
CREATE POLICY "dsr_delete" ON dsr_entries
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── cbs_nodes ──
DROP POLICY IF EXISTS "cbs_select" ON cbs_nodes;
CREATE POLICY "cbs_select" ON cbs_nodes
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "cbs_insert" ON cbs_nodes;
CREATE POLICY "cbs_insert" ON cbs_nodes
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "cbs_update" ON cbs_nodes;
CREATE POLICY "cbs_update" ON cbs_nodes
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "cbs_delete" ON cbs_nodes;
CREATE POLICY "cbs_delete" ON cbs_nodes
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── requisitions ──
DROP POLICY IF EXISTS "req_select" ON requisitions;
CREATE POLICY "req_select" ON requisitions
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "req_insert" ON requisitions;
CREATE POLICY "req_insert" ON requisitions
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "req_update" ON requisitions;
CREATE POLICY "req_update" ON requisitions
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "req_delete" ON requisitions;
CREATE POLICY "req_delete" ON requisitions
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── purchase_orders ──
DROP POLICY IF EXISTS "po_select" ON purchase_orders;
CREATE POLICY "po_select" ON purchase_orders
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "po_insert" ON purchase_orders;
CREATE POLICY "po_insert" ON purchase_orders
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "po_update" ON purchase_orders;
CREATE POLICY "po_update" ON purchase_orders
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "po_delete" ON purchase_orders;
CREATE POLICY "po_delete" ON purchase_orders
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── drawings ──
DROP POLICY IF EXISTS "dwg_select" ON drawings;
CREATE POLICY "dwg_select" ON drawings
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "dwg_insert" ON drawings;
CREATE POLICY "dwg_insert" ON drawings
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "dwg_update" ON drawings;
CREATE POLICY "dwg_update" ON drawings
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "dwg_delete" ON drawings;
CREATE POLICY "dwg_delete" ON drawings
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── letters ──
DROP POLICY IF EXISTS "letters_select" ON letters;
CREATE POLICY "letters_select" ON letters
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "letters_insert" ON letters;
CREATE POLICY "letters_insert" ON letters
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "letters_update" ON letters;
CREATE POLICY "letters_update" ON letters
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "letters_delete" ON letters;
CREATE POLICY "letters_delete" ON letters
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── qs_items ──
DROP POLICY IF EXISTS "qs_select" ON qs_items;
CREATE POLICY "qs_select" ON qs_items
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "qs_insert" ON qs_items;
CREATE POLICY "qs_insert" ON qs_items
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "qs_update" ON qs_items;
CREATE POLICY "qs_update" ON qs_items
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "qs_delete" ON qs_items;
CREATE POLICY "qs_delete" ON qs_items
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── equipment ──
DROP POLICY IF EXISTS "equip_select" ON equipment;
CREATE POLICY "equip_select" ON equipment
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "equip_insert" ON equipment;
CREATE POLICY "equip_insert" ON equipment
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "equip_update" ON equipment;
CREATE POLICY "equip_update" ON equipment
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "equip_delete" ON equipment;
CREATE POLICY "equip_delete" ON equipment
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── subcontractors ──
DROP POLICY IF EXISTS "sc_select" ON subcontractors;
CREATE POLICY "sc_select" ON subcontractors
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "sc_insert" ON subcontractors;
CREATE POLICY "sc_insert" ON subcontractors
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "sc_update" ON subcontractors;
CREATE POLICY "sc_update" ON subcontractors
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "sc_delete" ON subcontractors;
CREATE POLICY "sc_delete" ON subcontractors
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── workers ──
DROP POLICY IF EXISTS "workers_select" ON workers;
CREATE POLICY "workers_select" ON workers
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "workers_insert" ON workers;
CREATE POLICY "workers_insert" ON workers
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "workers_update" ON workers;
CREATE POLICY "workers_update" ON workers
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "workers_delete" ON workers;
CREATE POLICY "workers_delete" ON workers
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── chat_messages ──
DROP POLICY IF EXISTS "chat_select" ON chat_messages;
CREATE POLICY "chat_select" ON chat_messages
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "chat_insert" ON chat_messages;
CREATE POLICY "chat_insert" ON chat_messages
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "chat_update" ON chat_messages;
CREATE POLICY "chat_update" ON chat_messages
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "chat_delete" ON chat_messages;
CREATE POLICY "chat_delete" ON chat_messages
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── 6. Audit log policies ─────────────────────────────────────────────────
-- Only the service_role can INSERT audit entries (API routes use it for logging).
-- Users can read audit entries for projects they have access to.
-- No one can UPDATE or DELETE audit entries (immutable trail).
DROP POLICY IF EXISTS "dev" ON audit_log;

DROP POLICY IF EXISTS "audit_service_insert" ON audit_log;
CREATE POLICY "audit_service_insert" ON audit_log
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "audit_select_assigned" ON audit_log;
CREATE POLICY "audit_select_assigned" ON audit_log
  FOR SELECT USING (
    -- PMs can read all audit entries
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.role = 'PM'
    )
  );

-- No UPDATE or DELETE policies → audit_log is immutable for non-service roles.

-- ============================================================
-- DONE. To assign a user to a project:
--   INSERT INTO user_projects (user_id, project_id, role)
--   VALUES ('<auth.users.id>', '<projects.id>', 'PM');
-- ============================================================

-- Add CHECK constraint on user_projects.role
ALTER TABLE user_projects DROP CONSTRAINT IF EXISTS valid_role;
ALTER TABLE user_projects ADD CONSTRAINT valid_role 
  CHECK (role IN ('PM', 'SITE_ENGINEER', 'STOREKEEPER', 'FOREMAN'));


-- ╔══════════════════════════════════════════════════════════╗
-- ║  PART 3: SEED DATA                                       ║
-- ║  Creates a demo project + all sample data                ║
-- ╚══════════════════════════════════════════════════════════╝

-- First, ensure a project exists (the seed references it)
INSERT INTO projects (id, name, code, status, client, contract_value, start_date, end_date)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Kathmandu Ring Road Expansion — Package 3',
  'KRR-P3',
  'active',
  'Department of Roads, Nepal',
  487200000,
  '2026-01-15',
  '2027-06-30'
)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- OmniSite — Seed Data
-- Run this AFTER the schema SQL in Supabase SQL Editor
-- ============================================================

-- Get the default project ID
DO $$
DECLARE
  proj_id UUID;
BEGIN
  SELECT id INTO proj_id FROM projects LIMIT 1;

  -- ─── BOQ Items ──────────────────────────────────────────────
  INSERT INTO boq_items (id, project_id, code, description, type, qty, uom, rate, has_ra, level, parent_id) VALUES
    ('1', proj_id, '1', 'Bridge over Bagmati River', 'Heading', 0, '', 0, false, 0, NULL),
    ('1.1', proj_id, '1.1', 'Foundation Works', 'Heading', 0, '', 0, false, 1, '1'),
    ('1.1.1', proj_id, '1.1.1', 'Excavation in ordinary soil', 'Priced', 1240, 'cum', 485, true, 2, '1.1'),
    ('1.1.2', proj_id, '1.1.2', 'Stone soling 150mm thick', 'Priced', 320, 'cum', 4250, true, 2, '1.1'),
    ('1.1.3', proj_id, '1.1.3', 'PCC M15 (1:2:4) below footing', 'Priced', 145, 'cum', 9800, true, 2, '1.1'),
    ('1.1.4', proj_id, '1.1.4', 'PCC M20 grade concrete', 'Priced', 145, 'cum', 12400, true, 2, '1.1'),
    ('1.2', proj_id, '1.2', 'Substructure', 'Heading', 0, '', 0, false, 1, '1'),
    ('1.2.1', proj_id, '1.2.1', 'Reinforcement steel Fe500 (TMT)', 'Priced', 18.5, 'MT', 118000, true, 2, '1.2'),
    ('1.2.2', proj_id, '1.2.2', 'Shuttering ply waterproof', 'Priced', 420, 'sqm', 980, true, 2, '1.2'),
    ('1.2.3', proj_id, '1.2.3', 'Dewatering provision', 'Provisional Sum', 1, 'lot', 250000, false, 2, '1.2'),
    ('2', proj_id, '2', 'Road Works', 'Heading', 0, '', 0, false, 0, NULL),
    ('2.1', proj_id, '2.1', 'Earthwork', 'Heading', 0, '', 0, false, 1, '2'),
    ('2.1.1', proj_id, '2.1.1', 'Excavation for road formation', 'Priced', 18500, 'cum', 412, true, 2, '2.1'),
    ('2.1.2', proj_id, '2.1.2', 'Embankment fill (compacted)', 'Priced', 8200, 'cum', 385, true, 2, '2.1'),
    ('2.2', proj_id, '2.2', 'Pavement', 'Heading', 0, '', 0, false, 1, '2'),
    ('2.2.1', proj_id, '2.2.1', 'DBM 50mm thick bituminous layer', 'Priced', 14200, 'sqm', 1450, true, 2, '2.2'),
    ('2.2.2', proj_id, '2.2.2', 'BC 40mm wearing course', 'Priced', 14200, 'sqm', 1680, true, 2, '2.2'),
    ('2.2.3', proj_id, '2.2.3', 'Prime coat application', 'Daywork', 1, 'lot', 0, false, 2, '2.2'),
    ('3', proj_id, '3', 'Drainage & Cross Drainage', 'Heading', 0, '', 0, false, 0, NULL),
    ('3.1', proj_id, '3.1', 'Hume pipe NP3 600mm dia', 'Priced', 84, 'rmt', 6800, true, 1, '3'),
    ('3.2', proj_id, '3.2', 'Box culvert 2x2m precast', 'Priced', 6, 'no', 285000, true, 1, '3')
  ON CONFLICT (id) DO NOTHING;

  -- ─── Schedule Tasks ─────────────────────────────────────────
  INSERT INTO tasks (id, project_id, name, type, start_week, duration, progress, baseline_start, baseline_finish, critical, constraints, parent_id) VALUES
    ('T-100', proj_id, 'Site Mobilization', 'Summary', 0, 6, 100, 0, 6, false, NULL, NULL),
    ('T-101', proj_id, 'Setup site office & storage', 'Work', 0, 3, 100, 0, 3, false, 'ASAP', 'T-100'),
    ('T-102', proj_id, 'Plant & machinery deployment', 'Work', 2, 4, 100, 2, 6, false, NULL, 'T-100'),
    ('T-103', proj_id, 'Mobilization milestone', 'Milestone', 6, 0, 100, 6, 6, false, 'FNLT', 'T-100'),
    ('T-200', proj_id, 'Foundation Works', 'Summary', 5, 14, 72, 4, 18, false, NULL, NULL),
    ('T-201', proj_id, 'Excavation ch. 0+000 to 1+200', 'Work', 5, 5, 100, 4, 9, false, 'SNET', 'T-200'),
    ('T-202', proj_id, 'Stone soling layer', 'Work', 9, 3, 88, 9, 12, false, NULL, 'T-200'),
    ('T-203', proj_id, 'PCC M15 pouring', 'Work', 11, 4, 62, 12, 16, true, NULL, 'T-200'),
    ('T-204', proj_id, 'PCC curing period', 'Work', 14, 5, 25, 15, 20, false, 'FS+5', 'T-200'),
    ('T-300', proj_id, 'Box Culvert Construction', 'Summary', 14, 20, 35, 13, 33, false, NULL, NULL),
    ('T-301', proj_id, 'Hammock — Tunneling uncertain', 'Hammock', 14, 18, 35, 13, 31, true, 'Must Finish On: Wk 32', 'T-300'),
    ('T-302', proj_id, 'Base slab concrete', 'Work', 14, 5, 70, 14, 19, false, NULL, 'T-300'),
    ('T-303', proj_id, 'Wall & slab rebar', 'Work', 18, 8, 12, 18, 26, true, NULL, 'T-300'),
    ('T-400', proj_id, 'Pavement Works', 'Summary', 30, 18, 8, 30, 48, false, NULL, NULL),
    ('T-401', proj_id, 'Subgrade preparation', 'Work', 30, 6, 25, 30, 36, false, NULL, 'T-400'),
    ('T-402', proj_id, 'DBM 50mm layer', 'Work', 35, 8, 0, 36, 44, false, NULL, 'T-400'),
    ('T-403', proj_id, 'BC wearing course', 'Work', 42, 6, 0, 44, 50, false, NULL, 'T-400'),
    ('T-404', proj_id, 'Road opening milestone', 'Milestone', 48, 0, 0, 50, 50, false, 'MFO: Wk 48', 'T-400')
  ON CONFLICT (id) DO NOTHING;

  -- ─── CBS Nodes (Financials) ─────────────────────────────────
  INSERT INTO cbs_nodes (code, project_id, name, budget, committed, actual, forecast, margin_pct, level, parent_code) VALUES
    ('1', proj_id, 'Bridge Works', 285000000, 268000000, 142500000, 278000000, 2.4, 0, NULL),
    ('1.1', proj_id, 'Foundation', 84000000, 82000000, 48300000, 80500000, 4.2, 1, '1'),
    ('1.2', proj_id, 'Substructure', 112000000, 108000000, 64200000, 110800000, 1.1, 1, '1'),
    ('1.3', proj_id, 'Superstructure', 89000000, 78000000, 30000000, 86700000, 2.6, 1, '1'),
    ('2', proj_id, 'Road Works', 145000000, 138000000, 82300000, 142500000, 1.7, 0, NULL),
    ('2.1', proj_id, 'Earthwork', 38000000, 36500000, 28400000, 37200000, 2.1, 1, '2'),
    ('2.2', proj_id, 'Pavement', 89000000, 84500000, 48700000, 87800000, 1.3, 1, '2'),
    ('2.3', proj_id, 'Signage & Markings', 18000000, 17000000, 5200000, 17500000, 2.8, 1, '2'),
    ('3', proj_id, 'Drainage', 57400000, 54200000, 18400000, 56800000, 1.0, 0, NULL)
  ON CONFLICT (code) DO NOTHING;

  -- ─── Q&S Items ──────────────────────────────────────────────
  INSERT INTO qs_items (id, project_id, type, title, linked_boq, status, date, assignee, due_date, severity, billing_hold) VALUES
    ('ITR-042', proj_id, 'ITR', 'PCC M15 — footing at ch. 4+200 to 4+350', '1.1.3', 'Submitted', '30 Jul 2026', 'Er. Suresh (Consultant)', NULL, NULL, false),
    ('ITR-041', proj_id, 'ITR', 'Stone soling at pier P-4', '1.1.2', 'Approved', '29 Jul 2026', NULL, NULL, NULL, false),
    ('NCR-034', proj_id, 'NCR', 'Rebar cover < 40mm at box culvert base slab', '3.2', 'Open', '28 Jul 2026', 'Bikash Rai', '05 Aug 2026', 'high', true),
    ('NCR-033', proj_id, 'NCR', 'Honeycombing in PCC at ch. 4+050', '1.1.4', 'Closed', '20 Jul 2026', NULL, NULL, NULL, false),
    ('PCH-018', proj_id, 'Punch', 'Smooth edges at expansion joint', NULL, 'Open', '27 Jul 2026', 'Foreman Ram', '15 Aug 2026', 'low', false),
    ('PCH-017', proj_id, 'Punch', 'Clean debris from drainage outlet', NULL, 'Closed', '22 Jul 2026', NULL, NULL, NULL, false),
    ('INC-005', proj_id, 'Incident', 'Worker minor cut at rebar yard', NULL, 'Closed', '25 Jul 2026', NULL, NULL, 'low', false),
    ('NM-012', proj_id, 'Near-Miss', 'Tipper reversing without spotter', NULL, 'Open', '28 Jul 2026', NULL, NULL, 'medium', false)
  ON CONFLICT (id) DO NOTHING;

  -- ─── Equipment ──────────────────────────────────────────────
  INSERT INTO equipment (id, project_id, name, type, status, owned, operator, license_expiry, charge_rate, fuel_today, hours_today, burn_rate, burn_norm) VALUES
    ('E-001', proj_id, 'JCB 3DX Excavator', 'Excavator', 'active', false, 'Hari Bahadur', '2026-12-15', 1850, 32, 8, 4.0, 3.5),
    ('E-002', proj_id, 'Tata 1109 Tipper', 'Tipper Truck', 'active', false, 'Suresh Tamang', '2027-02-20', 1200, 18, 9, 2.0, 2.5),
    ('E-003', proj_id, 'Concrete Mixer 0.4 cum', 'Mixer', 'active', true, NULL, NULL, 285, 12, 6, 2.0, 2.0),
    ('E-004', proj_id, 'Needle Vibrator 60mm', 'Vibrator', 'idle', true, NULL, NULL, 95, NULL, NULL, NULL, NULL),
    ('E-005', proj_id, 'Batching Plant 30 cum/hr', 'Plant', 'breakdown', false, 'Ram Lal', '2026-10-12', 4200, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO NOTHING;

  -- ─── Workers ────────────────────────────────────────────────
  INSERT INTO workers (id, project_id, name, trade, phone, status, clock_in, clock_out, geo_fence, today_hours, allocated) VALUES
    ('W-001', proj_id, 'Ram Bahadur Thapa', 'Mason (Skilled)', '+977-98XXXXXXXX', 'on-site', '07:42', NULL, true, 8, '[{"task":"T-203 PCC M15","hours":4},{"task":"T-301 Base slab","hours":4}]'),
    ('W-002', proj_id, 'Sita Gurung', 'Mazdoor (Unskilled)', '+977-98XXXXXXXX', 'on-site', '07:55', NULL, true, 8, '[{"task":"T-203 PCC M15","hours":8}]'),
    ('W-003', proj_id, 'Hari Karki', 'Bar bender', '+977-98XXXXXXXX', 'on-site', '08:10', NULL, true, 7.5, '[{"task":"T-303 Wall & slab rebar","hours":6},{"task":"T-301 Base slab","hours":1.5}]'),
    ('W-004', proj_id, 'Bikas Tamang', 'Mazdoor (Unskilled)', '+977-98XXXXXXXX', 'off-site', '07:48', '11:30', false, 3.5, '[{"task":"T-201 Excavation","hours":3.5}]'),
    ('W-005', proj_id, 'Gopal Shrestha', 'Operator', '+977-98XXXXXXXX', 'on-site', '07:30', NULL, true, 9, '[{"task":"T-201 Excavation","hours":8},{"task":"T-202 Stone soling","hours":1}]'),
    ('W-006', proj_id, 'Anita Lama', 'Helper', '+977-98XXXXXXXX', 'break', '08:00', NULL, true, 4, '[{"task":"T-204 Curing","hours":4}]')
  ON CONFLICT (id) DO NOTHING;

END $$;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  PART 4: TASK DEPENDENCIES (CPM links)                  ║
-- ║  Real dependency links for the critical path calculation ║
-- ╚══════════════════════════════════════════════════════════╝


-- Migration: Add task_dependencies table for real CPM scheduling
-- Date: 2026-08-01
--
-- Adds a task_dependencies table to support Finish-to-Start (FS),
-- Start-to-Start (SS), Finish-to-Finish (FF), and Start-to-Finish (SF)
-- dependency links between tasks, with optional lag in weeks.
--
-- This replaces the previous fake "critical path" (which flagged the
-- longest single task) with a real dependency-driven CPM calculation.

CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  predecessor_id TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'FS' CHECK (link_type IN ('FS', 'SS', 'FF', 'SF')),
  lag_weeks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, predecessor_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_task_deps_successor ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_predecessor ON task_dependencies(predecessor_id);

-- RLS policies: users can only see/edit dependencies for projects they belong to.
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read task deps for their projects"
  ON task_dependencies FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM user_projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "PMs and Site Engineers can insert task deps"
  ON task_dependencies FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM user_projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "PMs and Site Engineers can update task deps"
  ON task_dependencies FOR UPDATE
  USING (
    project_id IN (
      SELECT project_id FROM user_projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "PMs and Site Engineers can delete task deps"
  ON task_dependencies FOR DELETE
  USING (
    project_id IN (
      SELECT project_id FROM user_projects WHERE user_id = auth.uid()
    )
  );

-- Seed real dependencies for the existing 14 tasks (project p1).
-- These reflect the actual construction sequence shown in the Gantt.
INSERT INTO task_dependencies (project_id, task_id, predecessor_id, link_type, lag_weeks) VALUES
  ('00000000-0000-0000-0000-000000000001', 'T-101', 'T-100', 'SS', 0),  -- Setup starts after mobilization starts
  ('00000000-0000-0000-0000-000000000001', 'T-102', 'T-101', 'SS', 2),  -- Plant dep after setup + 2w
  ('00000000-0000-0000-0000-000000000001', 'T-103', 'T-102', 'FS', 0),  -- Mobilization milestone after plant
  ('00000000-0000-0000-0000-000000000001', 'T-201', 'T-103', 'FS', 0),  -- Excavation after mobilization
  ('00000000-0000-0000-0000-000000000001', 'T-202', 'T-201', 'FS', 0),  -- Soling after excavation
  ('00000000-0000-0000-0000-000000000001', 'T-203', 'T-202', 'FS', 0),  -- PCC after soling
  ('00000000-0000-0000-0000-000000000001', 'T-204', 'T-203', 'FS', 0),  -- Curing after PCC
  ('00000000-0000-0000-0000-000000000001', 'T-301', 'T-103', 'FS', 0),  -- Hammock starts after mobilization
  ('00000000-0000-0000-0000-000000000001', 'T-302', 'T-301', 'SS', 0),  -- Base slab after hammock starts
  ('00000000-0000-0000-0000-000000000001', 'T-303', 'T-302', 'FS', 0),  -- Rebar after base slab
  ('00000000-0000-0000-0000-000000000001', 'T-401', 'T-204', 'FS', 0),  -- Subgrade after curing
  ('00000000-0000-0000-0000-000000000001', 'T-402', 'T-401', 'FS', 0),  -- DBM after subgrade
  ('00000000-0000-0000-0000-000000000001', 'T-403', 'T-402', 'FS', 0),  -- BC after DBM
  ('00000000-0000-0000-0000-000000000001', 'T-404', 'T-403', 'FS', 0)   -- Road opening after BC
ON CONFLICT (task_id, predecessor_id, link_type) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════╗
-- ║  PART 5: CBS SUBTREE RECOMPUTE TRIGGER                  ║
-- ║  Keeps parent budget rollups in sync at the DB level     ║
-- ╚══════════════════════════════════════════════════════════╝


-- Migration: Add DB trigger for CBS node subtree budget recompute
-- Date: 2026-08-01
--
-- When a CBS node's budget/committed/actual/forecast is updated, this
-- trigger walks UP the tree and recomputes each ancestor's aggregated
-- values from its children. This ensures the rollup stays correct
-- regardless of the write path (API, direct SQL, another client) —
-- closing the gap where only the client-side updateNode hook kept
-- parents in sync.
--
-- margin_pct is recomputed as (budget - actual) / budget * 100, guarded
-- against divide-by-zero.

CREATE OR REPLACE FUNCTION recompute_cbs_subtree()
RETURNS TRIGGER AS $$
DECLARE
  parent_code_val TEXT;
  current_code_val TEXT;
BEGIN
  -- After an INSERT/UPDATE on cbs_nodes, recompute the node's parent
  -- (and recursively up to the root) from its children.
  current_code_val := COALESCE(NEW.code, OLD.code);
  parent_code_val := COALESCE(NEW.parent_code, OLD.parent_code);

  -- Walk up the tree, recomputing each ancestor from its children.
  WHILE parent_code_val IS NOT NULL LOOP
    UPDATE cbs_nodes SET
      budget = COALESCE((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = parent_code_val), 0),
      committed = COALESCE((SELECT SUM(committed) FROM cbs_nodes WHERE parent_code = parent_code_val), 0),
      actual = COALESCE((SELECT SUM(actual) FROM cbs_nodes WHERE parent_code = parent_code_val), 0),
      forecast = COALESCE((SELECT SUM(forecast) FROM cbs_nodes WHERE parent_code = parent_code_val), 0),
      margin_pct = CASE
        WHEN COALESCE((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = parent_code_val), 0) > 0
        THEN ROUND(
          ((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = parent_code_val) -
           (SELECT SUM(actual) FROM cbs_nodes WHERE parent_code = parent_code_val)) /
          (SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = parent_code_val) * 100.0,
          2
        )
        ELSE 0
      END,
      updated_at = NOW()
    WHERE code = parent_code_val;

    -- Move up to the next ancestor.
    SELECT parent_code INTO parent_code_val FROM cbs_nodes WHERE code = parent_code_val;
  END LOOP;

  -- Also recompute the node itself if it has children (so its own row
  -- reflects the sum of its children, not just a manually-entered value).
  IF EXISTS (SELECT 1 FROM cbs_nodes WHERE parent_code = current_code_val) THEN
    UPDATE cbs_nodes SET
      budget = COALESCE((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = current_code_val), 0),
      committed = COALESCE((SELECT SUM(committed) FROM cbs_nodes WHERE parent_code = current_code_val), 0),
      actual = COALESCE((SELECT SUM(actual) FROM cbs_nodes WHERE parent_code = current_code_val), 0),
      forecast = COALESCE((SELECT SUM(forecast) FROM cbs_nodes WHERE parent_code = current_code_val), 0),
      margin_pct = CASE
        WHEN COALESCE((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = current_code_val), 0) > 0
        THEN ROUND(
          ((SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = current_code_val) -
           (SELECT SUM(actual) FROM cbs_nodes WHERE parent_code = current_code_val)) /
          (SELECT SUM(budget) FROM cbs_nodes WHERE parent_code = current_code_val) * 100.0,
          2
        )
        ELSE 0
      END,
      updated_at = NOW()
    WHERE code = current_code_val;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists (idempotent migration), then create.
DROP TRIGGER IF EXISTS cbs_nodes_subtree_recompute ON cbs_nodes;

CREATE TRIGGER cbs_nodes_subtree_recompute
  AFTER INSERT OR UPDATE OR DELETE ON cbs_nodes
  FOR EACH ROW EXECUTE FUNCTION recompute_cbs_subtree();

-- ============================================================
-- End of file — all done!
-- ============================================================
