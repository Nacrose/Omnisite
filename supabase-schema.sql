-- ============================================================
-- OmniSite — Database Schema for Supabase
-- Run this in Supabase SQL Editor (Dashboard → SQL → New Query)
-- ============================================================

-- Enable UUID extension
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

-- Insert default project
INSERT INTO projects (name, code, location, value, progress, status)
VALUES ('Kathmandu Ring Road Expansion — Package 3', 'KRR-P3', 'Kathmandu', 487400000, 62, 'active')
ON CONFLICT DO NOTHING;

-- ============================================================
-- BOQ Items
-- ============================================================
CREATE TABLE IF NOT EXISTS boq_items (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id) DEFAULT (SELECT id FROM projects LIMIT 1),
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Priced', -- Priced, Provisional Sum, Daywork, Heading
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

-- ============================================================
-- Schedule Tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id) DEFAULT (SELECT id FROM projects LIMIT 1),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Work', -- Work, Milestone, Hammock, Summary
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

-- ============================================================
-- DSR (Daily Site Report) Entries
-- ============================================================
CREATE TABLE IF NOT EXISTS dsr_entries (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id) DEFAULT (SELECT id FROM projects LIMIT 1),
  task TEXT NOT NULL,
  source TEXT DEFAULT 'Sched', -- Sched, Backlog, RFI, Manual
  chainage TEXT,
  planned NUMERIC DEFAULT 0,
  actual NUMERIC DEFAULT 0,
  uom TEXT,
  status TEXT DEFAULT 'in-progress', -- in-progress, completed, blocked, pending
  has_rfi BOOLEAN DEFAULT false,
  has_photos BOOLEAN DEFAULT false,
  remarks TEXT,
  date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CBS (Cost Breakdown Structure) Nodes — Financials
-- ============================================================
CREATE TABLE IF NOT EXISTS cbs_nodes (
  code TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id) DEFAULT (SELECT id FROM projects LIMIT 1),
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

-- ============================================================
-- Procurement — Requisitions
-- ============================================================
CREATE TABLE IF NOT EXISTS requisitions (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id) DEFAULT (SELECT id FROM projects LIMIT 1),
  item TEXT NOT NULL,
  uom TEXT,
  qty NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Draft', -- Draft, Approved, Partially PO'd, Fully PO'd
  source TEXT DEFAULT 'Sched',
  vendors JSONB DEFAULT '[]', -- [{name, rate, selected}]
  override_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Procurement — Purchase Orders
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id) DEFAULT (SELECT id FROM projects LIMIT 1),
  vendor TEXT NOT NULL,
  date TEXT,
  value NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Pending', -- Pending, Partial, Delivered
  items INTEGER DEFAULT 0,
  has_grn BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Drawings
-- ============================================================
CREATE TABLE IF NOT EXISTS drawings (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id) DEFAULT (SELECT id FROM projects LIMIT 1),
  number TEXT NOT NULL,
  title TEXT NOT NULL,
  revision TEXT DEFAULT 'A',
  date TEXT,
  status TEXT DEFAULT 'Pending', -- Approved for Construction, Pending, Superseded, Rejected
  size TEXT DEFAULT 'A2',
  discipline TEXT,
  links JSONB DEFAULT '[]',
  history JSONB DEFAULT '[]',
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Correspondence (Letters)
-- ============================================================
CREATE TABLE IF NOT EXISTS letters (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id) DEFAULT (SELECT id FROM projects LIMIT 1),
  number TEXT NOT NULL,
  date TEXT,
  type TEXT NOT NULL, -- Incoming, Outgoing, Site Instruction
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

-- ============================================================
-- Q&S Items (ITRs, NCRs, Punch List, Incidents)
-- ============================================================
CREATE TABLE IF NOT EXISTS qs_items (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id) DEFAULT (SELECT id FROM projects LIMIT 1),
  type TEXT NOT NULL, -- ITR, NCR, Punch, Incident, Near-Miss
  title TEXT NOT NULL,
  linked_boq TEXT,
  status TEXT DEFAULT 'Open', -- Open, CAP Submitted, Consultant Sign-off, Closed, Approved, Rejected
  date TEXT,
  assignee TEXT,
  due_date TEXT,
  severity TEXT, -- low, medium, high
  billing_hold BOOLEAN DEFAULT false,
  cap JSONB, -- {rootCause, action, assignee, dueDate}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Equipment
-- ============================================================
CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id) DEFAULT (SELECT id FROM projects LIMIT 1),
  name TEXT NOT NULL,
  type TEXT,
  status TEXT DEFAULT 'idle', -- active, breakdown, idle
  owned BOOLEAN DEFAULT false,
  operator TEXT,
  license_expiry TEXT,
  charge_rate NUMERIC DEFAULT 0,
  fuel_today NUMERIC DEFAULT 0,
  hours_today NUMERIC DEFAULT 0,
  burn_rate NUMERIC DEFAULT 0,
  burn_norm NUMERIC DEFAULT 0,
  rental JSONB, -- {vendor, rate, terms[]}
  docs JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Subcontractors
-- ============================================================
CREATE TABLE IF NOT EXISTS subcontractors (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id) DEFAULT (SELECT id FROM projects LIMIT 1),
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

-- ============================================================
-- Workers (Time & Attendance)
-- ============================================================
CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id) DEFAULT (SELECT id FROM projects LIMIT 1),
  name TEXT NOT NULL,
  trade TEXT,
  phone TEXT,
  status TEXT DEFAULT 'off-site', -- on-site, off-site, break
  clock_in TEXT,
  clock_out TEXT,
  geo_fence BOOLEAN DEFAULT true,
  today_hours NUMERIC DEFAULT 0,
  allocated JSONB DEFAULT '[]', -- [{task, hours}]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Chat Messages (future WhatsApp-like messaging)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) DEFAULT (SELECT id FROM projects LIMIT 1),
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_initials TEXT,
  sender_color TEXT,
  channel_id TEXT DEFAULT 'general', -- general, site, management, etc.
  content TEXT,
  message_type TEXT DEFAULT 'text', -- text, image, file, voice
  media_url TEXT,
  reply_to UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Enable Row Level Security (multi-tenancy)
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

-- For development phase: allow all access (no auth yet)
-- In production, replace with proper RLS policies per user role
CREATE POLICY "Allow all for development" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON boq_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON dsr_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON cbs_nodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON requisitions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON purchase_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON drawings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON letters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON qs_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON equipment FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON subcontractors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON workers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for development" ON chat_messages FOR ALL USING (true) WITH CHECK (true);

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
