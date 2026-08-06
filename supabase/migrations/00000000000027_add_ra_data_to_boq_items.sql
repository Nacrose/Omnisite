-- Migration: Add ra_data JSONB column to boq_items
--
-- Persists Rate Analysis data per BOQ item. Previously RA data was stored
-- only in localStorage (keyed per item) — now it round-trips through
-- Supabase and is shared across users/devices.

ALTER TABLE boq_items ADD COLUMN IF NOT EXISTS ra_data JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN boq_items.ra_data IS
  'Rate Analysis data (materials, labour, equipment, pctCosts, customPctCosts, opPct) as JSONB. Enables RA persistence across users and devices.';
