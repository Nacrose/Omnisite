-- Adds wage fields to the `workers` table.
--
-- Background (audit pass-4, M2):
--   The Worker type (time-attendance/index.tsx) carries `wageRate`,
--   `otMultiplier`, and `standardHours` — used by the payroll calculator
--   (computeDailyPayroll in time-attendance/payroll-calc.ts) to derive
--   regular vs overtime pay. Without DB columns the fields never
--   round-tripped through Supabase (Zod stripped them on POST and the DB
--   would have rejected them), so admin edits to a worker's wage silently
--   vanished on reload in Supabase mode and the financials labour-cost
--   roll-up went back to its default rate of 0.
--
-- This migration adds the three columns; the matching schema entries in
-- src/lib/validation.ts (workerSchema.wage_rate / ot_multiplier /
-- standard_hours) and the fieldMap entries in time-attendance/index.tsx
-- (wageRate / otMultiplier / standardHours) land in the same pass.

ALTER TABLE workers ADD COLUMN IF NOT EXISTS wage_rate NUMERIC DEFAULT 0;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS ot_multiplier NUMERIC DEFAULT 1.5;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS standard_hours NUMERIC DEFAULT 8;
