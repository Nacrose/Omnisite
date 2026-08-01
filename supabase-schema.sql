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
  task_id TEXT NOT NULL,          -- successor task
  predecessor_id TEXT NOT NULL,   -- predecessor task
  link_type TEXT NOT NULL DEFAULT 'FS' CHECK (link_type IN ('FS', 'SS', 'FF', 'SF')),
  lag_weeks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, predecessor_id, link_type),
  -- Soft FK (no hard FK because tasks use TEXT ids and may be cross-project)
  FOREIGN KEY (task_id, project_id) REFERENCES tasks(id, project_id) ON DELETE CASCADE
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
