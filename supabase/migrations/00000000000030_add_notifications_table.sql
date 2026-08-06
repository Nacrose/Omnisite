-- Migration: Add `notifications` table + per-user RLS + audit allowlist
--
-- Closes P1-17 in gap analysis. Previously, the notifications bell
-- hard-coded NOTIFICATIONS = [] + NOTIFICATIONS_DISPATCH_ENABLED = false,
-- and no notifications table existed — the README + .env.example claimed
-- "overdue RFI / NCR / PO alerts are sent via email (Resend) / SMS (Twilio)"
-- but nothing was wired.
--
-- This migration adds the table + RLS + audit allowlist. The client-side
-- NotificationsBell switches to useSyncedState to read/unread, the
-- /api/notifications route exposes GET / POST / DELETE, and the
-- /api/cron/notifications-scan route periodically scans for overdue RFIs
-- and inserts notification rows (the actual "send email/SMS if env vars
-- are configured" stays in src/lib/notifications.ts — already implemented,
-- just needed callers).

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The user this notification is for. NULL = broadcast to all project
  -- members (e.g. "Project start date moved") — resolved via the
  -- project_id + RLS at read time.
  user_id UUID REFERENCES auth.users(id),
  project_id UUID NOT NULL REFERENCES projects(id),
  -- Maps to src/lib/notifications.ts NotificationType
  type TEXT NOT NULL CHECK (type IN (
    'rfi_overdue', 'ncr_hold', 'po_approval', 'dsr_review',
    'variation_threshold'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  -- Optional deep-link target so the bell can route on click.
  module TEXT,
  -- Optional context object for the notification (e.g. rfiId, daysLate).
  -- JSONB so we can store structured data without a schema migration.
  context JSONB,
  -- NULL until the user marks it read. Indexed so "unread count" is fast.
  read_at TIMESTAMPTZ,
  -- When the notification was created (used for sorting + retention).
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Tracks whether the email/SMS dispatch succeeded. NULL = not attempted
  -- (no env vars configured); 'sent' = at least one channel succeeded;
  -- 'failed' = all configured channels failed. Updated by the cron route.
  dispatch_status TEXT CHECK (dispatch_status IN ('pending', 'sent', 'failed', 'skipped')),
  dispatch_channels TEXT[], -- e.g. ['console', 'email'] — what actually fired
  version INTEGER NOT NULL DEFAULT 1
);

-- Indexes for the common read paths:
--   1. List unread for a user (the bell's badge count + dropdown list).
--   2. List all for a user (the "all" filter).
--   3. List by project + type (the cron scan dedup check).
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read_at, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_project_type
  ON notifications(project_id, type, created_at DESC);

-- updated_at trigger (no updated_at column on this table — notifications
-- are append-only except for the read_at update). Skipping the trigger.

-- ─── Row-Level Security ─────────────────────────────────────────────────────
-- A user can only see notifications addressed to them (user_id = auth.uid())
-- OR broadcast notifications on a project they're a member of (user_id
-- IS NULL + project_id matches a user_projects row).
--
-- Write: only the cron route (service-role) inserts. Users can update
-- read_at on their own rows. Deletes are PM-only (admin cleanup).

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT TO authenticated
  USING (
    -- Addressed directly to this user
    user_id = auth.uid()
    OR (
      -- Broadcast to a project the user is a member of
      user_id IS NULL
      AND EXISTS (
        SELECT 1 FROM user_projects
        WHERE user_id = auth.uid()
          AND project_id = notifications.project_id
      )
    )
  );

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No INSERT / DELETE policy for authenticated users — only the service
-- role (used by /api/cron/notifications-scan) can insert. PMs can delete
-- via the service role through /api/notifications DELETE (which uses
-- upsertWithAudit / deleteWithAudit — gated by api-auth.ts).

-- ─── Add `notifications` to the audit allowlist ────────────────────────────
-- Same pattern as migrations 28 and 29.

CREATE OR REPLACE FUNCTION upsert_with_audit(
  p_table TEXT,
  p_row JSONB,
  p_pk TEXT,
  p_user_id TEXT,
  p_action TEXT,
  p_old_values JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record_id TEXT;
  v_diff      JSONB;
  v_result    JSONB;
  v_update_cols TEXT;
  v_project_id  UUID;
BEGIN
  IF p_table NOT IN (
    'boq_items', 'tasks', 'dsr_entries', 'cbs_nodes', 'requisitions',
    'purchase_orders', 'drawings', 'letters', 'qs_items', 'equipment',
    'subcontractors', 'workers', 'chat_messages', 'projects',
    'user_projects', 'grns', 'stock_items',
    'vendors', 'project_locations',
    'drawing_annotations',
    'rfis',
    'material_issue_notes',
    -- Added in migration 30 — notifications (PM mark-read cleanup, cron inserts)
    'notifications'
  ) THEN
    RAISE EXCEPTION 'upsert_with_audit: table % not in allowlist', p_table
      USING ERRCODE = 'check_violation';
  END IF;

  v_record_id := p_row->>p_pk;

  IF p_old_values IS NOT NULL THEN
    SELECT COALESCE(jsonb_object_agg(
      key,
      jsonb_build_object(
        'old', mask_pii(p_table, key, p_old_values->key),
        'new', mask_pii(p_table, key, p_row->key)
      )
    ) FILTER (WHERE p_old_values->key IS DISTINCT FROM p_row->key), '{}'::jsonb)
    INTO v_diff
    FROM jsonb_object_keys(p_row) AS key;
  END IF;

  SELECT string_agg(quote_ident(col) || ' = EXCLUDED.' || quote_ident(col), ', ')
  INTO v_update_cols
  FROM jsonb_object_keys(p_row) AS col
  WHERE col <> p_pk;

  EXECUTE format(
    'WITH ins AS (
       INSERT INTO %I SELECT * FROM jsonb_populate_record(NULL::%I, $1)
       ON CONFLICT (%I) DO UPDATE SET %s
       RETURNING *
     )
     SELECT to_jsonb(ins) FROM ins',
    p_table, p_table, p_pk, COALESCE(v_update_cols, 'updated_at = NOW()')
  ) INTO v_result
  USING p_row;

  BEGIN
    v_project_id := NULLIF(p_row->>'project_id', '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_project_id := NULL;
  END;

  INSERT INTO audit_log (table_name, record_id, action, changed_by, changed_fields, old_values, new_values, project_id)
  VALUES (
    p_table,
    COALESCE(v_record_id, ''),
    p_action::TEXT,
    p_user_id,
    v_diff,
    p_old_values,
    p_row,
    v_project_id
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION upsert_with_audit(TEXT, JSONB, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_with_audit(TEXT, JSONB, TEXT, TEXT, TEXT, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION delete_with_audit(
  p_table TEXT,
  p_record_id TEXT,
  p_pk TEXT,
  p_user_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old       JSONB;
  v_project_id UUID;
BEGIN
  IF p_table NOT IN (
    'boq_items', 'tasks', 'dsr_entries', 'cbs_nodes', 'requisitions',
    'purchase_orders', 'drawings', 'letters', 'qs_items', 'equipment',
    'subcontractors', 'workers', 'chat_messages', 'projects',
    'user_projects', 'grns', 'stock_items',
    'vendors', 'project_locations',
    'drawing_annotations',
    'rfis',
    'material_issue_notes',
    -- Added in migration 30
    'notifications'
  ) THEN
    RAISE EXCEPTION 'delete_with_audit: table % not in allowlist', p_table
      USING ERRCODE = 'check_violation';
  END IF;

  EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE %I = $1', p_table, p_pk)
    INTO v_old
    USING p_record_id;

  IF v_old IS NULL THEN
    RETURN false;
  END IF;

  EXECUTE format('DELETE FROM %I WHERE %I = $1', p_table, p_pk)
    USING p_record_id;

  BEGIN
    v_project_id := NULLIF(v_old->>'project_id', '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_project_id := NULL;
  END;

  INSERT INTO audit_log (table_name, record_id, action, changed_by, changed_fields, old_values, new_values, project_id)
  VALUES (
    p_table,
    p_record_id,
    'DELETE',
    p_user_id,
    NULL,
    v_old,
    NULL,
    v_project_id
  );

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION delete_with_audit(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_with_audit(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ─── Realtime ──────────────────────────────────────────────────────────────
-- Notifications are pushed in realtime so the bell updates without a
-- refresh when the cron route inserts a new row.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
