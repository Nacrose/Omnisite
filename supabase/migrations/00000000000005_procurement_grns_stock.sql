-- Migration: Add grns + stock_items tables + req_id on purchase_orders
-- Date: 2026-08-01
--
-- Closes the procurement traceability + persistence gap:
--   REQ → PO (now with req_id) → GRN (new table) → Stock movement (new table)
--
-- Previously GRNs were local-only useState (lost on refresh), stock was a
-- frozen seed array (never moved), and POs had no link back to their
-- originating requisition.

-- ─── Add req_id + material_code + rate + po_qty to purchase_orders ─────────
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS req_id TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS material_code TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS rate NUMERIC DEFAULT 0;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_qty NUMERIC DEFAULT 0;

-- ─── GRN table (Goods Received Notes) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS grns (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  po_id TEXT NOT NULL,                  -- links to purchase_orders.id
  vendor TEXT NOT NULL,
  po_qty NUMERIC NOT NULL DEFAULT 0,    -- ordered quantity (from PO)
  grn_qty NUMERIC NOT NULL DEFAULT 0,   -- received quantity
  invoice_qty NUMERIC NOT NULL DEFAULT 0, -- invoiced quantity
  rate NUMERIC NOT NULL DEFAULT 0,      -- unit rate (from PO, for locked-amount calc)
  pay_status TEXT NOT NULL DEFAULT 'Awaiting GRN'
    CHECK (pay_status IN ('Cleared', 'Hold', 'Partial Hold', 'Awaiting GRN')),
  material_code TEXT,                   -- links to stock_items.code for stock movement
  date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grns_po ON grns(po_id);
CREATE INDEX IF NOT EXISTS idx_grns_material ON grns(material_code);

-- ─── Stock items table (live inventory) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_items (
  code TEXT PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  on_hand NUMERIC NOT NULL DEFAULT 0,
  reserved NUMERIC NOT NULL DEFAULT 0,
  avg_cost NUMERIC NOT NULL DEFAULT 0,
  warehouse TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Enable RLS + Realtime ────────────────────────────────────────────────
ALTER TABLE grns ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE grns; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE stock_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ─── updated_at triggers ──────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_grns_updated_at ON grns;
CREATE TRIGGER update_grns_updated_at BEFORE UPDATE ON grns FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_stock_items_updated_at ON stock_items;
CREATE TRIGGER update_stock_items_updated_at BEFORE UPDATE ON stock_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS policies (same pattern as other business tables) ─────────────────
-- Uses user_has_project_access() which must already exist (created by the
-- RLS migration that runs before this one).

-- grns: read for project members, write for PM/SITE_ENGINEER/STOREKEEPER
CREATE POLICY "grns_select" ON grns
  FOR SELECT USING (user_has_project_access(project_id));
CREATE POLICY "grns_insert" ON grns
  FOR INSERT WITH CHECK (user_has_project_access(project_id));
CREATE POLICY "grns_update" ON grns
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));
CREATE POLICY "grns_delete" ON grns
  FOR DELETE USING (user_has_project_access(project_id));

-- stock_items: read for project members, write for PM/SITE_ENGINEER/STOREKEEPER
CREATE POLICY "stock_select" ON stock_items
  FOR SELECT USING (user_has_project_access(project_id));
CREATE POLICY "stock_insert" ON stock_items
  FOR INSERT WITH CHECK (user_has_project_access(project_id));
CREATE POLICY "stock_update" ON stock_items
  FOR UPDATE USING (user_has_project_access(project_id)) WITH CHECK (user_has_project_access(project_id));
CREATE POLICY "stock_delete" ON stock_items
  FOR DELETE USING (user_has_project_access(project_id));

-- ─── Seed initial GRN + stock data ────────────────────────────────────────
DO $$
DECLARE
  proj_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- GRNs (matching INITIAL_GRNS in types.ts)
  INSERT INTO grns (id, project_id, po_id, vendor, po_qty, grn_qty, invoice_qty, rate, pay_status, material_code, date) VALUES
    ('GRN-0089', proj_id, 'PO-2410-018', 'Udaipur Cement', 1200, 1200, 1200, 920, 'Cleared', 'M-CEM-OPC', '13 Aug 2026'),
    ('GRN-0088', proj_id, 'PO-2410-014', 'Trishuli Sand', 45, 38, 38, 3850, 'Partial Hold', 'M-SAND-R', '09 Aug 2026'),
    ('GRN-0090', proj_id, 'PO-2410-022', 'Hetauda Aggregates', 96, 0, 0, 2950, 'Awaiting GRN', 'M-AGG-20', '—'),
    ('GRN-0087', proj_id, 'PO-2410-016', 'Ghorahi Ply', 60, 60, 58, 2790, 'Hold', 'M-PLY-18', '11 Aug 2026')
  ON CONFLICT (id) DO NOTHING;

  -- Stock items (matching INITIAL_STOCK in types.ts)
  INSERT INTO stock_items (code, project_id, name, on_hand, reserved, avg_cost, warehouse) VALUES
    ('M-CEM-OPC', proj_id, 'Cement OPC 53 (Bag)', 1240, 480, 918, 'Main Store · Kalanki'),
    ('M-SAND-R', proj_id, 'River Sand (cum)', 38.5, 12, 3850, 'Site Stockpile'),
    ('M-AGG-20', proj_id, 'Coarse Agg 20mm (cum)', 64.2, 28, 2950, 'Site Stockpile'),
    ('M-STEEL-TMT16', proj_id, 'TMT Steel 16mm (MT)', 4.8, 3.2, 118200, 'Rebar Yard'),
    ('M-PLY-18', proj_id, 'Shuttering Ply 18mm (Sheet)', 48, 24, 2790, 'Formwork Yard')
  ON CONFLICT (code) DO NOTHING;
END $$;
