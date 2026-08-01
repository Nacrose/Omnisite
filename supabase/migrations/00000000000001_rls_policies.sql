-- ============================================================
-- OmniSite — Row Level Security (RLS) Policies
-- ============================================================
-- Run this in Supabase SQL Editor AFTER running supabase-schema.sql.
--
-- This replaces the "Allow all for development" policies with real
-- per-user, per-project policies that enforce:
--   1. Users can only see data for projects they're assigned to.
--   2. Users can only write data for projects they're assigned to.
--   3. PMs have full access to all projects.
--   4. The service_role (used for audit logging) bypasses RLS entirely.
--
-- ASSUMPTION: A `user_projects` table exists (or will be created below)
-- that maps auth.users(id) → projects(id) with a role column.
-- ============================================================

-- ─── 1. Create user_projects junction table ────────────────────────────────
-- Maps users to projects with their role on each project.
CREATE TABLE IF NOT EXISTS user_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'SITE_ENGINEER', -- PM, SITE_ENGINEER, STOREKEEPER, FOREMAN
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, project_id)
);

ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;

-- Users can read their own project assignments.
-- PMs can read all assignments.
DROP POLICY IF EXISTS "users_read_own_assignments" ON user_projects;
CREATE POLICY "users_read_own_assignments" ON user_projects
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.role = 'PM'
    )
  );

-- Users can be assigned to projects only by PMs.
DROP POLICY IF EXISTS "pms_insert_assignments" ON user_projects;
CREATE POLICY "pms_insert_assignments" ON user_projects
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.role = 'PM'
    )
  );

-- Only PMs can delete assignments.
DROP POLICY IF EXISTS "pms_delete_assignments" ON user_projects;
CREATE POLICY "pms_delete_assignments" ON user_projects
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.role = 'PM'
    )
  );

-- PMs can update assignments (e.g. change a user's role on a project).
DROP POLICY IF EXISTS "pms_update_assignments" ON user_projects;
CREATE POLICY "pms_update_assignments" ON user_projects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.role = 'PM'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.role = 'PM'
    )
  );

-- ─── 2. Helper function: check if user has access to a project ─────────────
-- Returns true if the user is assigned to the project (any role) or is a PM.
CREATE OR REPLACE FUNCTION user_has_project_access(project_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_projects
    WHERE user_id = auth.uid()
    AND (project_id = project_uuid OR role = 'PM')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 3. Drop the "Allow all for development" policies ──────────────────────
DROP POLICY IF EXISTS "Allow all for development" ON projects;
DROP POLICY IF EXISTS "Allow all for development" ON boq_items;
DROP POLICY IF EXISTS "Allow all for development" ON tasks;
DROP POLICY IF EXISTS "Allow all for development" ON dsr_entries;
DROP POLICY IF EXISTS "Allow all for development" ON cbs_nodes;
DROP POLICY IF EXISTS "Allow all for development" ON requisitions;
DROP POLICY IF EXISTS "Allow all for development" ON purchase_orders;
DROP POLICY IF EXISTS "Allow all for development" ON drawings;
DROP POLICY IF EXISTS "Allow all for development" ON letters;
DROP POLICY IF EXISTS "Allow all for development" ON qs_items;
DROP POLICY IF EXISTS "Allow all for development" ON equipment;
DROP POLICY IF EXISTS "Allow all for development" ON subcontractors;
DROP POLICY IF EXISTS "Allow all for development" ON workers;
DROP POLICY IF EXISTS "Allow all for development" ON chat_messages;

-- ─── 4. Projects table policies ────────────────────────────────────────────
-- Users can see projects they're assigned to. PMs see all.
DROP POLICY IF EXISTS "projects_select_assigned" ON projects;
CREATE POLICY "projects_select_assigned" ON projects
  FOR SELECT USING (
    user_has_project_access(id)
  );

-- Only PMs can create/update/delete projects.
DROP POLICY IF EXISTS "projects_pms_write" ON projects;
CREATE POLICY "projects_pms_write" ON projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.role = 'PM'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.role = 'PM'
    )
  );

-- ─── 5. Business table policies (repeated pattern) ────────────────────────
-- For each business table: SELECT/INSERT/UPDATE/DELETE are allowed only if
-- the user has access to the row's project_id.

-- ─── boq_items ──
DROP POLICY IF EXISTS "boq_items_select" ON boq_items;
CREATE POLICY "boq_items_select" ON boq_items
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "boq_items_insert" ON boq_items;
CREATE POLICY "boq_items_insert" ON boq_items
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "boq_items_update" ON boq_items;
CREATE POLICY "boq_items_update" ON boq_items
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "boq_items_delete" ON boq_items;
CREATE POLICY "boq_items_delete" ON boq_items
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── tasks ──
DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── dsr_entries ──
DROP POLICY IF EXISTS "dsr_select" ON dsr_entries;
CREATE POLICY "dsr_select" ON dsr_entries
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "dsr_insert" ON dsr_entries;
CREATE POLICY "dsr_insert" ON dsr_entries
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "dsr_update" ON dsr_entries;
CREATE POLICY "dsr_update" ON dsr_entries
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "dsr_delete" ON dsr_entries;
CREATE POLICY "dsr_delete" ON dsr_entries
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── cbs_nodes ──
DROP POLICY IF EXISTS "cbs_select" ON cbs_nodes;
CREATE POLICY "cbs_select" ON cbs_nodes
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "cbs_insert" ON cbs_nodes;
CREATE POLICY "cbs_insert" ON cbs_nodes
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "cbs_update" ON cbs_nodes;
CREATE POLICY "cbs_update" ON cbs_nodes
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "cbs_delete" ON cbs_nodes;
CREATE POLICY "cbs_delete" ON cbs_nodes
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── requisitions ──
DROP POLICY IF EXISTS "req_select" ON requisitions;
CREATE POLICY "req_select" ON requisitions
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "req_insert" ON requisitions;
CREATE POLICY "req_insert" ON requisitions
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "req_update" ON requisitions;
CREATE POLICY "req_update" ON requisitions
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "req_delete" ON requisitions;
CREATE POLICY "req_delete" ON requisitions
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── purchase_orders ──
DROP POLICY IF EXISTS "po_select" ON purchase_orders;
CREATE POLICY "po_select" ON purchase_orders
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "po_insert" ON purchase_orders;
CREATE POLICY "po_insert" ON purchase_orders
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "po_update" ON purchase_orders;
CREATE POLICY "po_update" ON purchase_orders
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "po_delete" ON purchase_orders;
CREATE POLICY "po_delete" ON purchase_orders
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── drawings ──
DROP POLICY IF EXISTS "dwg_select" ON drawings;
CREATE POLICY "dwg_select" ON drawings
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "dwg_insert" ON drawings;
CREATE POLICY "dwg_insert" ON drawings
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "dwg_update" ON drawings;
CREATE POLICY "dwg_update" ON drawings
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "dwg_delete" ON drawings;
CREATE POLICY "dwg_delete" ON drawings
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── letters ──
DROP POLICY IF EXISTS "letters_select" ON letters;
CREATE POLICY "letters_select" ON letters
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "letters_insert" ON letters;
CREATE POLICY "letters_insert" ON letters
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "letters_update" ON letters;
CREATE POLICY "letters_update" ON letters
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "letters_delete" ON letters;
CREATE POLICY "letters_delete" ON letters
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── qs_items ──
DROP POLICY IF EXISTS "qs_select" ON qs_items;
CREATE POLICY "qs_select" ON qs_items
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "qs_insert" ON qs_items;
CREATE POLICY "qs_insert" ON qs_items
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "qs_update" ON qs_items;
CREATE POLICY "qs_update" ON qs_items
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "qs_delete" ON qs_items;
CREATE POLICY "qs_delete" ON qs_items
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── equipment ──
DROP POLICY IF EXISTS "equip_select" ON equipment;
CREATE POLICY "equip_select" ON equipment
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "equip_insert" ON equipment;
CREATE POLICY "equip_insert" ON equipment
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "equip_update" ON equipment;
CREATE POLICY "equip_update" ON equipment
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "equip_delete" ON equipment;
CREATE POLICY "equip_delete" ON equipment
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── subcontractors ──
DROP POLICY IF EXISTS "sc_select" ON subcontractors;
CREATE POLICY "sc_select" ON subcontractors
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "sc_insert" ON subcontractors;
CREATE POLICY "sc_insert" ON subcontractors
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "sc_update" ON subcontractors;
CREATE POLICY "sc_update" ON subcontractors
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "sc_delete" ON subcontractors;
CREATE POLICY "sc_delete" ON subcontractors
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── workers ──
DROP POLICY IF EXISTS "workers_select" ON workers;
CREATE POLICY "workers_select" ON workers
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "workers_insert" ON workers;
CREATE POLICY "workers_insert" ON workers
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "workers_update" ON workers;
CREATE POLICY "workers_update" ON workers
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "workers_delete" ON workers;
CREATE POLICY "workers_delete" ON workers
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── chat_messages ──
DROP POLICY IF EXISTS "chat_select" ON chat_messages;
CREATE POLICY "chat_select" ON chat_messages
  FOR SELECT USING (user_has_project_access(project_id));

DROP POLICY IF EXISTS "chat_insert" ON chat_messages;
CREATE POLICY "chat_insert" ON chat_messages
  FOR INSERT WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "chat_update" ON chat_messages;
CREATE POLICY "chat_update" ON chat_messages
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));

DROP POLICY IF EXISTS "chat_delete" ON chat_messages;
CREATE POLICY "chat_delete" ON chat_messages
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── 6. Audit log policies ─────────────────────────────────────────────────
-- Only the service_role can INSERT audit entries (API routes use it for logging).
-- Users can read audit entries for projects they have access to.
-- No one can UPDATE or DELETE audit entries (immutable trail).
DROP POLICY IF EXISTS "dev" ON audit_log;

DROP POLICY IF EXISTS "audit_service_insert" ON audit_log;
CREATE POLICY "audit_service_insert" ON audit_log
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "audit_select_assigned" ON audit_log;
CREATE POLICY "audit_select_assigned" ON audit_log
  FOR SELECT USING (
    -- PMs can read all audit entries
    EXISTS (
      SELECT 1 FROM user_projects up
      WHERE up.user_id = auth.uid() AND up.role = 'PM'
    )
  );

-- No UPDATE or DELETE policies → audit_log is immutable for non-service roles.

-- ============================================================
-- DONE. To assign a user to a project:
--   INSERT INTO user_projects (user_id, project_id, role)
--   VALUES ('<auth.users.id>', '<projects.id>', 'PM');
-- ============================================================
