-- ============================================================
-- OmniSite — Add location_id columns to tasks / dsr_entries / qs_items / boq_items
-- Migration: 00000000000012
-- Date: 2026-08-12
--
-- Each of these four business tables gains a nullable `location_id`
-- TEXT column referencing project_locations(id) with ON DELETE SET NULL
-- semantics, plus a B-tree index for the per-location list views the
-- field-team will use (e.g. "show me every open NCR at pier P-4").
--
-- The FK is intentionally nullable: legacy rows seeded in migration 06
-- pre-date project_locations, and many rows (e.g. overhead BOQ headings,
-- summary tasks) aren't tied to a physical work-face. SET NULL on delete
-- matches the pattern used by project_locations.assigned_vendor_id in
-- migration 10 — deleting a location un-links the row but never orphans it.
--
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- ============================================================

-- ─── 1. tasks.location_id ────────────────────────────────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS location_id TEXT REFERENCES project_locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tasks_location_id_idx ON tasks (location_id);

-- ─── 2. dsr_entries.location_id ──────────────────────────────────────────────
ALTER TABLE dsr_entries ADD COLUMN IF NOT EXISTS location_id TEXT REFERENCES project_locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS dsr_entries_location_id_idx ON dsr_entries (location_id);

-- ─── 3. qs_items.location_id ─────────────────────────────────────────────────
ALTER TABLE qs_items ADD COLUMN IF NOT EXISTS location_id TEXT REFERENCES project_locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS qs_items_location_id_idx ON qs_items (location_id);

-- ─── 4. boq_items.location_id ────────────────────────────────────────────────
ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS location_id TEXT REFERENCES project_locations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS boq_items_location_id_idx ON boq_items (location_id);
