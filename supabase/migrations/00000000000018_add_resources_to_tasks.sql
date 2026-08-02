-- Adds the `resources` JSONB column to the `tasks` table.
--
-- Background (audit pass-4, H4):
--   The Task app type (scheduler/types.ts) has `resources: string[]` and the
--   scheduler's leveling pass (leveling.ts) reads `t.resources.length` to
--   compute weekly resource load. Without a DB column the field never
--   round-tripped through Supabase: Zod stripped it on POST (no schema
--   entry) and even if it had landed it would have been rejected as an
--   unknown column. As a result every task loaded from Supabase mode came
--   back with `resources === undefined`, and clicking the "Level" button
--   crashed with "Cannot read properties of undefined (reading 'length')".
--
-- This migration adds the column; the matching schema entry in
-- src/lib/validation.ts (taskSchema.resources) and the fieldMap entry in
-- scheduler/index.tsx (resources: 'resources') land in the same pass.
-- Default '[]' so existing rows (pre-migration) read back as an empty
-- array instead of NULL — though leveling.ts now also null-guards the
-- access for defense-in-depth.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS resources JSONB DEFAULT '[]';
