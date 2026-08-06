ALTER TABLE user_projects ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;
COMMENT ON COLUMN user_projects.permissions IS 'Granular per-user permission overrides (JSONB). Keys are dotted strings like "boq.viewRates". Absent keys use defaults from permissions-config.ts.';
