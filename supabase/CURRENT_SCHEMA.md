-- ============================================================================
-- Omnisite — Current Schema Reference (CONSOLIDATED)
-- ============================================================================
--

-- PURPOSE
-- This file is a _documentation_ artifact, NOT a migration. It consolidates
-- the current canonical definitions of the security-critical Postgres
-- functions, RLS helpers, and triggers into a single readable file so a
-- reviewer doesn't have to replay 21 migration files to understand the
-- live schema. The source-of-truth remains the migration files in
-- `supabase/migrations/` — this file is regenerated/updated by hand
-- whenever a migration modifies one of the functions below.
--

-- To verify this file is in sync with the migrations, run:
-- supabase db dump --schema public > /tmp/dump.sql
-- and diff the function definitions.
--

-- HOW TO USE
-- - When adding a new migration that modifies any function below, ALSO
-- update the corresponding section in this file.
-- - When adding a brand-new function, add a section here.
-- - The CI lint in `scripts/check-current-schema.mjs` (TODO) should diff
-- this file against a live `supabase db dump` to catch drift.
--

-- ============================================================================

-- ─── 1. RLS helpers (source: 00000000000001_rls_policies.sql) ──────────────
-- These functions are called from RLS policies on every business-table read
-- and write. They resolve "does the current user have access to this project"
-- by joining user_projects → auth.uid().

-- Returns true if the current user has any role on project_uuid.
-- Used by SELECT policies on all business tables.
-- CREATE OR REPLACE FUNCTION user_has_project_access(project_uuid UUID)
-- RETURNS BOOLEAN
-- LANGUAGE sql
-- SECURITY DEFINER
-- SET search_path = public, pg_temp
-- AS $$
--     SELECT EXISTS (
--       SELECT 1 FROM user_projects
--       WHERE user_id = auth.uid()
--         AND project_id = project_uuid
--     )
--   $$;

-- Returns true if the current user is a PM on project_uuid.
-- Used by INSERT/UPDATE/DELETE policies on cbs_nodes, subcontractors, etc.
-- CREATE OR REPLACE FUNCTION user_has_pm_access(project_uuid UUID)
-- RETURNS BOOLEAN
-- LANGUAGE sql
-- SECURITY DEFINER
-- SET search_path = public, pg_temp
-- AS $$
--     SELECT EXISTS (
--       SELECT 1 FROM user_projects
--       WHERE user_id = auth.uid()
--         AND project_id = project_uuid
--         AND role = 'PM'
--     )
--   $$;

-- Returns true if the current user is a PM OR Site Engineer on project_uuid.
-- Added in migration 10 for vendor writes.
-- CREATE OR REPLACE FUNCTION user_has_pm_or_engineer_access(project_uuid UUID)
-- RETURNS BOOLEAN
-- LANGUAGE sql
-- SECURITY DEFINER
-- SET search_path = public, pg_temp
-- AS $$
--     SELECT EXISTS (
--       SELECT 1 FROM user_projects
--       WHERE user_id = auth.uid()
--         AND project_id = project_uuid
--         AND role IN ('PM', 'SITE_ENGINEER')
--     )
--   $$;

-- ─── 2. Audit functions (source: 00000000000013_drawing_annotations.sql) ───
-- upsert_with_audit() and delete_with_audit() are SECURITY DEFINER functions
-- callable ONLY by the service_role (Revoked from PUBLIC, anon, authenticated).
-- They perform the business write + the audit_log INSERT in a single Postgres
-- transaction, so the audit trail can never diverge from the data state.
--

-- LATEST VERSION: migration 13 (added 'drawing_annotations' to the allowlist)
-- PREVIOUS VERSIONS: migrations 7, 9, 11
--

-- Table allowlist (checked at the top of each function):
-- boq_items, tasks, dsr_entries, cbs_nodes, requisitions,
-- purchase_orders, drawings, letters, qs_items, equipment,
-- subcontractors, workers, chat_messages, projects,
-- user_projects, grns, stock_items,
-- vendors, project_locations, -- added in migration 11
-- drawing_annotations -- added in migration 13
--

-- Security invariants:
-- - SECURITY DEFINER (runs with the function owner's privileges, not the
-- caller's) — this is what allows the service_role to write to tables
-- that RLS would otherwise block.
-- - SET search_path = public, pg_temp — closes the CVE-2018-1058-style
-- search_path injection where a malicious caller could shadow a function.
-- - REVOKE EXECUTE FROM PUBLIC, anon, authenticated — only the service_role
-- (which has bypassrls) can invoke these.
-- - p_table is checked against an allowlist before any EXECUTE — prevents
-- arbitrary-table writes via dynamic SQL.
--

-- See migration 13 for the full function bodies.

-- ─── 3. PII masking (source: 00000000000011_add_vendors_locations_to_audit_allowlist.sql) ──
-- mask_pii() redacts sensitive fields before they land in audit_log.
-- Applied to:
-- workers.phone
-- subcontractors.pan
-- subcontractors.gst
-- Returns '_**REDACTED**_' for redacted fields, otherwise the value verbatim.
--

-- LATEST VERSION: migration 11 (recreated to add vendors/locations to allowlist)
-- PREVIOUS VERSION: migration 9 (original)

-- ─── 4. CBS rollup trigger (source: 00000000000009_audit_project_id_indexes_constraints.sql) ──
-- recompute_cbs_subtree() walks up the CBS tree on every INSERT/UPDATE/DELETE
-- on cbs_nodes and recomputes parent totals (budget, committed, actual,
-- forecast) from children. Has a re-entrancy guard via pg_trigger_depth() to
-- prevent infinite recursion when a parent update fires the trigger again.
--

-- LATEST VERSION: migration 9 (consolidated to a single SELECT per ancestor)
-- PREVIOUS VERSION: migration 4 (5 SUM subqueries per ancestor — N+1 query)
--

-- The trigger is attached via:
-- CREATE TRIGGER cbs_subtree_trigger
-- AFTER INSERT OR UPDATE OR DELETE ON cbs_nodes
-- FOR EACH ROW EXECUTE FUNCTION recompute_cbs_subtree();

-- ─── 5. updated_at trigger (source: 00000000000000_schema.sql) ─────────────
-- update_updated_at() is a generic trigger that sets updated_at = NOW() on
-- every UPDATE. Attached to all business tables that have an updated_at column.

-- ─── 6. Audit log (source: migrations 2, 8, 9) ─────────────────────────────
-- audit_log is append-only:
-- - service_role: full INSERT (via upsert_with_audit/delete_with_audit)
-- - authenticated PMs: SELECT for their projects only
-- - No UPDATE or DELETE policies — RLS denies by default
--

-- Columns (current as of migration 9):
-- id UUID PRIMARY KEY
-- table_name TEXT NOT NULL
-- record_id TEXT NOT NULL
-- action TEXT NOT NULL -- INSERT | UPDATE | DELETE
-- changed_by TEXT NOT NULL -- user_id from auth
-- changed_fields JSONB -- {field: {old, new}} — diff
-- old_values JSONB -- added in migration 8
-- new_values JSONB -- added in migration 8
-- project_id UUID -- added in migration 9 (denormalized for
-- -- fast per-project audit queries)
-- timestamp TIMESTAMPTZ DEFAULT NOW()
--

-- Indexes (added in migration 9):
-- audit_log(table_name, record_id) — point lookups
-- audit_log(changed_by) — per-user activity
-- audit_log(timestamp DESC) — recent-first queries
-- audit_log(project_id) — per-project scoping

-- ============================================================================
-- MIGRATION HISTORY (chronological)
-- ============================================================================
--

-- 00 schema — all tables + triggers
-- 01 rls_policies — RLS + user_has_project_access/pm_access
-- 02 audit_log — audit_log table
-- 03 task_dependencies — CPM dependency links
-- 04 cbs_subtree_trigger — DB-level CBS rollup (N+1 version)
-- 05 procurement_grns_stock — GRN + stock tables
-- 06 seed_data — demo project + BOQ + tasks + CBS
-- 07 transactional_audit — upsert_with_audit/delete_with_audit
-- 08 audit_log_old_new_values — old_values/new_values columns
-- 09 audit_project_id_indexes — project_id, 16 indexes, CHECKs, FKs,
-- PII masking, search_path hardening,
-- consolidated recompute_cbs_subtree
-- 10 vendors_and_locations — unified vendors + project_locations
-- 11 add_vendors_locations_audit — add vendors/locations to audit allowlist
-- 12 add_location_id_columns — location_id on tasks/dsr/qs/boq
-- 13 drawing_annotations — annotations table + audit allowlist
-- 14 add_po_rate_to_grns — po_rate column on grns
-- 15 backfill_grn_po_rate — backfill po_rate from purchase_orders
-- 16 add_dependencies_to_tasks — dependencies JSONB column on tasks
-- 17 add_qs_date_columns — date columns on qs_items
-- 18 add_resources_to_tasks — resources JSONB column on tasks
-- 19 add_advance_recovered — advance_recovered on subcontractors
-- 20 add_wage_fields_to_workers — wage fields on workers
--

-- ============================================================================
-- END OF FILE
-- ============================================================================
