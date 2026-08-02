-- Adds the `advance_recovered` column to the `vendors` table.
--
-- Background (audit pass-4, M1):
--   The Vendor type (lib/types/vendor.ts) carries `advanceRecovered?: number`
--   — the cumulative advance amount already recovered across prior bills,
--   tracked so the running-bill tab's recovery tally isn't lost on reload.
--   Without a DB column the field never round-tripped through Supabase
--   (Zod stripped it on POST and the DB would have rejected it), so the
--   recovery tally silently reset to 0 after every reload in Supabase mode.
--
-- This migration adds the column; the matching schema entry in
-- src/lib/validation.ts (vendorSchema.advance_recovered) and the fieldMap
-- entry in vendors/index.tsx (advanceRecovered: 'advance_recovered') land
-- in the same pass.

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS advance_recovered NUMERIC DEFAULT 0;
