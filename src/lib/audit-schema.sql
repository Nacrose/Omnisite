-- ─── OmniSite — audit_log table ──────────────────────────────────────────────
-- Tracks every INSERT / UPDATE / DELETE on business tables for FIDIC contract
-- compliance and dispute resolution. Populated server-side from API routes
-- (see src/lib/audit.ts → logAudit()).
--
-- Run this against your Supabase project's Postgres:
--   supabase db execute --file src/lib/audit-schema.sql
-- or paste into the SQL Editor in the Supabase dashboard.

-- uuid_generate_v4() lives in the pgcrypto extension. Enable it first if you
-- haven't already (Supabase enables this by default on new projects).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,                       -- 'INSERT' | 'UPDATE' | 'DELETE'
  changed_by TEXT NOT NULL,                   -- user id or name
  changed_fields JSONB,                       -- { field: { old, new }, ... }
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Helpful indexes for common audit queries
CREATE INDEX IF NOT EXISTS audit_log_table_record_idx
  ON audit_log (table_name, record_id);
CREATE INDEX IF NOT EXISTS audit_log_changed_by_idx
  ON audit_log (changed_by);
CREATE INDEX IF NOT EXISTS audit_log_timestamp_idx
  ON audit_log (timestamp DESC);

-- Row Level Security — restricts who can read/modify audit rows.
-- The "dev" policy below is wide-open so the anon key works during development.
-- In production, replace this with role-based policies (e.g. only PMs and
-- auditors can SELECT; only the service_role can INSERT; no UPDATE/DELETE).
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev" ON audit_log;
CREATE POLICY "dev" ON audit_log
  FOR ALL
  USING (true)
  WITH CHECK (true);
