-- Migration: Phases 9-11 — Ingestion queue, commercial impact, productivity
--
-- Implements:
--   Phase 9 (Phase 15 in doc): Ingestion/validation queue
--   Phase 10 (Phase 16 in doc): Correspondence/drawing impact assessment
--   Phase 11 (Phase 17 in doc): Resource productivity variance

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 9: INGESTION / VALIDATION QUEUE
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ingestion_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  source_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_by UUID REFERENCES auth.users(id),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT chk_ingestion_batches_status CHECK (status IN ('RECEIVED', 'PARSING', 'READY', 'FAILED', 'COMPLETED'))
);

CREATE TABLE IF NOT EXISTS ingestion_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  batch_id UUID REFERENCES ingestion_batches(id),
  draft_type TEXT NOT NULL,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score NUMERIC,
  validation_status TEXT NOT NULL DEFAULT 'PENDING_VALIDATION',
  assigned_to UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  converted_entity_type TEXT,
  converted_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT chk_ingestion_drafts_status CHECK (validation_status IN ('PENDING_VALIDATION', 'VALIDATED', 'REJECTED', 'CONVERTED'))
);

CREATE INDEX IF NOT EXISTS idx_ingestion_batches_project ON ingestion_batches(project_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_drafts_batch ON ingestion_drafts(batch_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_drafts_status ON ingestion_drafts(validation_status);

ALTER TABLE ingestion_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ingestion_batches_read" ON ingestion_batches FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = ingestion_batches.project_id));
CREATE POLICY "ingestion_batches_write" ON ingestion_batches FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = ingestion_batches.project_id));

CREATE POLICY "ingestion_drafts_read" ON ingestion_drafts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = ingestion_drafts.project_id));
CREATE POLICY "ingestion_drafts_write" ON ingestion_drafts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = ingestion_drafts.project_id));

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE ingestion_batches; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE ingestion_drafts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 10: CORRESPONDENCE / DRAWING IMPACT ASSESSMENT
-- ═══════════════════════════════════════════════════════════════════════════

-- Add impact assessment columns to letters (correspondence) table
ALTER TABLE letters
  ADD COLUMN IF NOT EXISTS affects_boq_quantity BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS affects_critical_path BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS affects_cost BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS affects_time BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimated_cost_impact NUMERIC,
  ADD COLUMN IF NOT EXISTS estimated_time_impact_days INTEGER;

-- Commercial impacts table
CREATE TABLE IF NOT EXISTS commercial_impacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  impact_type TEXT NOT NULL CHECK (impact_type IN ('VARIATION', 'EOT', 'RATE_REVISION', 'QUANTITY_REVISION')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ASSESSED', 'DRAFTED', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  estimated_cost NUMERIC,
  estimated_days INTEGER,
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_commercial_impacts_source ON commercial_impacts(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_commercial_impacts_status ON commercial_impacts(status);

ALTER TABLE commercial_impacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commercial_impacts_read" ON commercial_impacts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = commercial_impacts.project_id));
CREATE POLICY "commercial_impacts_write_pm" ON commercial_impacts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = commercial_impacts.project_id AND role = 'PM'));

-- Add commercial_status to boq_items
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS commercial_status TEXT NOT NULL DEFAULT 'BASELINE';
DO $$ BEGIN
  ALTER TABLE boq_items ADD CONSTRAINT chk_boq_items_commercial_status
    CHECK (commercial_status IN ('BASELINE', 'SUBJECT_TO_REVISION', 'DISPUTED', 'VARIATION_PENDING', 'APPROVED_VARIATION', 'SUPERSEDED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE commercial_impacts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 11: RESOURCE PRODUCTIVITY VARIANCE
-- ═══════════════════════════════════════════════════════════════════════════

-- Task allocations (worker → task, planned vs actual hours)
CREATE TABLE IF NOT EXISTS task_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  worker_id TEXT REFERENCES workers(id),
  trade TEXT,
  allocation_date DATE NOT NULL,
  planned_hours NUMERIC NOT NULL DEFAULT 0,
  actual_hours NUMERIC NOT NULL DEFAULT 0,
  ot_hours NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  version INTEGER NOT NULL DEFAULT 1
);

-- Equipment allocations
CREATE TABLE IF NOT EXISTS equipment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  equipment_id TEXT NOT NULL REFERENCES equipment(id),
  allocation_date DATE NOT NULL,
  planned_hours NUMERIC NOT NULL DEFAULT 0,
  actual_hours NUMERIC NOT NULL DEFAULT 0,
  idle_hours NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  version INTEGER NOT NULL DEFAULT 1
);

-- Productivity results (computed variance)
CREATE TABLE IF NOT EXISTS productivity_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  task_id TEXT NOT NULL REFERENCES tasks(id),
  boq_item_id TEXT,
  calculation_date DATE NOT NULL,
  planned_manhours NUMERIC NOT NULL DEFAULT 0,
  actual_manhours NUMERIC NOT NULL DEFAULT 0,
  variance_manhours NUMERIC NOT NULL DEFAULT 0,
  variance_percent NUMERIC,
  productivity_ratio NUMERIC,
  root_cause_code TEXT CHECK (root_cause_code IN ('WEATHER', 'MATERIAL_DELAY', 'DRAWING_DELAY', 'REWORK', 'LOW_SKILL', 'EQUIPMENT_BREAKDOWN', 'SITE_ACCESS', 'SUPERVISION', 'OTHER')),
  status TEXT NOT NULL DEFAULT 'OK' CHECK (status IN ('OK', 'ROOT_CAUSE_REQUIRED', 'ROOT_CAUSE_LOGGED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_task_allocations_task ON task_allocations(task_id);
CREATE INDEX IF NOT EXISTS idx_equipment_allocations_task ON equipment_allocations(task_id);
CREATE INDEX IF NOT EXISTS idx_productivity_results_task ON productivity_results(task_id);

ALTER TABLE task_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE productivity_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_allocations_rw" ON task_allocations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = task_allocations.project_id));
CREATE POLICY "equipment_allocations_rw" ON equipment_allocations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = equipment_allocations.project_id));
CREATE POLICY "productivity_results_rw" ON productivity_results FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND project_id = productivity_results.project_id));

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE productivity_results; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
