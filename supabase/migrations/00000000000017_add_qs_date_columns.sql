-- Migration: Add cap_submitted_date / closed_date columns to qs_items
-- Date: 2026-08-01
--
-- The Q&S client type (`QsItem`) has had `cap_submitted_date` and
-- `closed_date` for a while (used by the NCR/ITR lifecycle UI to show
-- when a Corrective Action Plan was sent to the consultant and when
-- the item was closed), but neither column existed in the `qs_items`
-- table. In Supabase mode this caused silent data loss:
--   - The Zod schema on the API route stripped the unknown fields
--     before INSERT (validation.ts `qsItemSchema` did not list them).
--   - Even if validation had passed, PostgREST would have rejected the
--     INSERT with a 4xx for the unknown columns.
--
-- This adds the columns (TEXT — the client uses ISO date strings, same
-- as the existing `date` / `due_date` columns on this table) and the
-- matching entries were added to `qsItemSchema` in src/lib/validation.ts.

ALTER TABLE qs_items ADD COLUMN IF NOT EXISTS cap_submitted_date TEXT;
ALTER TABLE qs_items ADD COLUMN IF NOT EXISTS closed_date TEXT;
