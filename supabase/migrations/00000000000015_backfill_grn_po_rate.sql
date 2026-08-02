-- Backfill grns.po_rate from the linked purchase_orders.rate
-- so existing GRNs don't falsely show as rate-mismatched.
--
-- Migration 00000000000014 added `grns.po_rate` with DEFAULT 0, which means
-- any GRN that existed before the column was added would have po_rate = 0 and
-- fail the 3-way match (rate check) even though the PO rate was correct at the
-- time the GRN was raised. This migration repairs that data.
UPDATE grns
SET po_rate = purchase_orders.rate
FROM purchase_orders
WHERE grns.po_id = purchase_orders.id
  AND (grns.po_rate IS NULL OR grns.po_rate = 0)
  AND purchase_orders.rate IS NOT NULL
  AND purchase_orders.rate > 0;

-- For GRNs with no matching PO, set po_rate = rate (assume invoice rate = PO rate)
UPDATE grns SET po_rate = rate WHERE (po_rate IS NULL OR po_rate = 0) AND rate > 0;
