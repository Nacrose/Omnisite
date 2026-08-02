-- Migration: Add po_rate column to grns table
-- The 3-way match now checks rate in addition to quantity.

ALTER TABLE grns ADD COLUMN IF NOT EXISTS po_rate NUMERIC DEFAULT 0 CHECK (po_rate >= 0);
