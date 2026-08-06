-- Add start_date to projects (drives the Gantt "today" line per-project).
-- Replaces the hardcoded PROJECT_EPOCH constant.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS start_date DATE;
COMMENT ON COLUMN projects.start_date IS 'Project start date — drives the Gantt chart today line and S-curve baseline.';

-- Backfill existing seeded projects with approximate start dates.
UPDATE projects SET start_date = '2026-04-01'::date WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE projects SET start_date = '2025-09-15'::date WHERE id = '00000000-0000-0000-0000-000000000002';
UPDATE projects SET start_date = '2026-01-12'::date WHERE id = '00000000-0000-0000-0000-000000000003';
UPDATE projects SET start_date = '2026-06-01'::date WHERE id = '00000000-0000-0000-0000-000000000004';
UPDATE projects SET start_date = '2024-08-01'::date WHERE id = '00000000-0000-0000-0000-000000000005';
