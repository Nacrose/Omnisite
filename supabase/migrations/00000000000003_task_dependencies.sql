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
