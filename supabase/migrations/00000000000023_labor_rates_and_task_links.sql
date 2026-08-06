-- Migration: Add labor/workforce rate library + link requisitions to tasks
--
-- 1. New table: labor_rates — workforce rate library (trades + categories)
--    Used by the Scheduler's resource assignment to compute labor costs
--    per task, and by the RA Builder's Labour section for rate lookup.
--
-- 2. Add task_id to requisitions — links a material requisition to a
--    specific scheduler task. Enables the Task Inspector's "Material
--    Lead-Time Check" tab to show pending requisitions/POs per task.
--
-- 3. Add boq_item_id to tasks — formalizes the BOQ→Task link (currently
--    stored in localStorage only). When set, EVM can compute BCWS from
--    the linked BOQ item's rate × allocated qty.

-- ─── 1. Labor rate library ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS labor_rates (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Skilled',
  uom TEXT NOT NULL DEFAULT 'day',
  rate NUMERIC DEFAULT 0,
  ot_rate NUMERIC DEFAULT 0,
  source TEXT DEFAULT 'DoR Norm 2075',
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labor_rates_project_id ON labor_rates(project_id);
CREATE INDEX IF NOT EXISTS idx_labor_rates_code ON labor_rates(code);

-- Seed standard DoR labor rates
INSERT INTO labor_rates (id, project_id, code, name, category, uom, rate, ot_rate, source)
VALUES
  ('LR-MASN-S1', '00000000-0000-0000-0000-000000000001', 'L-MASN', 'Mason (Skilled Cat. I)', 'Skilled', 'day', 1450, 2175, 'DoR Norm 2075'),
  ('LR-MASN-S2', '00000000-0000-0000-0000-000000000001', 'L-MASN2', 'Mason (Skilled Cat. II)', 'Skilled', 'day', 1300, 1950, 'DoR Norm 2075'),
  ('LR-HEL', '00000000-0000-0000-0000-000000000001', 'L-HEL', 'Mazdoor (Unskilled)', 'Unskilled', 'day', 950, 1425, 'DoR Norm 2075'),
  ('LR-MIX', '00000000-0000-0000-0000-000000000001', 'L-MIX', 'Mixer Operator', 'Skilled', 'day', 1200, 1800, 'DoR Norm 2075'),
  ('LR-BARP', '00000000-0000-0000-0000-000000000001', 'L-BARP', 'Bar Bender & Cutter', 'Skilled', 'day', 1350, 2025, 'DoR Norm 2075'),
  ('LR-CARP', '00000000-0000-0000-0000-000000000001', 'L-CARP', 'Carpenter', 'Skilled', 'day', 1400, 2100, 'DoR Norm 2075'),
  ('LR-WELD', '00000000-0000-0000-0000-000000000001', 'L-WELD', 'Welder', 'Skilled', 'day', 1500, 2250, 'DoR Norm 2075'),
  ('LR-DRIV', '00000000-0000-0000-0000-000000000001', 'L-DRIV', 'Driver (Heavy Vehicle)', 'Skilled', 'day', 1100, 1650, 'DoR Norm 2075'),
  ('LR-SURV', '00000000-0000-0000-0000-000000000001', 'L-SURV', 'Surveyor', 'Skilled', 'day', 2000, 3000, 'DoR Norm 2075'),
  ('LR-FORE', '00000000-0000-0000-0000-000000000001', 'L-FORE', 'Foreman', 'Supervisor', 'day', 1800, 2700, 'DoR Norm 2075')
ON CONFLICT (id) DO NOTHING;

-- Add to realtime publication
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE labor_rates; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ─── 2. Link requisitions to tasks ─────────────────────────────────────────
ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS task_id TEXT;

-- ─── 3. Formalize BOQ→Task link ────────────────────────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS boq_item_id TEXT;

COMMENT ON COLUMN tasks.boq_item_id IS 'Linked BOQ item ID (e.g. "1.1.1"). When set, EVM can compute BCWS from the BOQ item rate × task qty.';
COMMENT ON COLUMN requisitions.task_id IS 'Linked scheduler task ID. Enables material lead-time checks per task.';
