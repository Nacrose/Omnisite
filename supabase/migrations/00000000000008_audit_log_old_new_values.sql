-- Migration: Add old_values + new_values columns to audit_log
-- Date: 2026-08-02
--
-- The upsert_with_audit() function (migration 07) writes to old_values and
-- new_values columns that did not exist in the original audit_log schema
-- (migration 02). Without this migration, every call to upsert_with_audit()
-- throws: column "old_values" of relation "audit_log" does not exist.
--
-- This migration is safe to re-run (IF NOT EXISTS).

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS old_values JSONB;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS new_values JSONB;

-- Index new_values for forensic queries (e.g. "show me every state of record X").
CREATE INDEX IF NOT EXISTS audit_log_record_timestamp_idx
  ON audit_log (record_id, timestamp DESC);
