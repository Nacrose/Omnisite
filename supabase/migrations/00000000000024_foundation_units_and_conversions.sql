-- Migration: Phase 1 — Foundation tables (units, unit conversions, material_units)
--
-- Implements the unit conversion engine from the Technical Execution Plan.
-- This is the foundation that procurement tolerance matching, material
-- reconciliation, and BOQ rate analysis all depend on.

-- ─── Units table ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  unit_type TEXT NOT NULL,
  is_base_unit BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  version INTEGER NOT NULL DEFAULT 1
);

-- ─── Material-Unit association ─────────────────────────────────────────────
-- Links materials to their valid units + rounding precision.
-- Uses a generic materials table reference — if the project doesn't have
-- a `materials` table, this FK is optional (nullable).
CREATE TABLE IF NOT EXISTS material_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_code TEXT NOT NULL,
  unit_id UUID NOT NULL REFERENCES units(id),
  is_base_unit BOOLEAN NOT NULL DEFAULT false,
  rounding_precision INTEGER NOT NULL DEFAULT 6,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE(material_code, unit_id)
);

-- ─── Unit conversions ──────────────────────────────────────────────────────
-- Conversion factors between units. Can be global (material_code IS NULL)
-- or material-specific (overrides global).
CREATE TABLE IF NOT EXISTS unit_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_unit_id UUID NOT NULL REFERENCES units(id),
  to_unit_id UUID NOT NULL REFERENCES units(id),
  material_code TEXT,
  factor NUMERIC NOT NULL CHECK (factor > 0),
  is_standard BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_unit_conversions_lookup
  ON unit_conversions(from_unit_id, to_unit_id, material_code);

-- ─── Seed standard construction units ──────────────────────────────────────
INSERT INTO units (code, name, unit_type, is_base_unit) VALUES
  ('BAG', 'Bag (50kg cement)', 'Weight', false),
  ('KG', 'Kilogram', 'Weight', true),
  ('TON', 'Metric Ton', 'Weight', false),
  ('CUM', 'Cubic Meter', 'Volume', true),
  ('CFT', 'Cubic Feet', 'Volume', false),
  ('LTR', 'Liter', 'Volume', false),
  ('SQM', 'Square Meter', 'Area', true),
  ('SQFT', 'Square Feet', 'Area', false),
  ('M', 'Meter', 'Length', true),
  ('FT', 'Feet', 'Length', false),
  ('NOS', 'Numbers', 'Count', true),
  ('SET', 'Set', 'Count', false),
  ('DAY', 'Day', 'Time', true),
  ('HR', 'Hour', 'Time', false),
  ('MONTH', 'Month', 'Time', false)
ON CONFLICT (code) DO NOTHING;

-- ─── Seed standard conversions ─────────────────────────────────────────────
INSERT INTO unit_conversions (from_unit_id, to_unit_id, factor)
SELECT f.id, t.id, factor FROM
  (SELECT id FROM units WHERE code = 'TON') f,
  (SELECT id FROM units WHERE code = 'KG') t,
  (VALUES (1000.0)) AS v(factor)
WHERE NOT EXISTS (SELECT 1 FROM unit_conversions WHERE from_unit_id = f.id AND to_unit_id = t.id AND material_code IS NULL)
UNION ALL
SELECT f.id, t.id, factor FROM
  (SELECT id FROM units WHERE code = 'BAG') f,
  (SELECT id FROM units WHERE code = 'KG') t,
  (VALUES (50.0)) AS v(factor)
WHERE NOT EXISTS (SELECT 1 FROM unit_conversions WHERE from_unit_id = f.id AND to_unit_id = t.id AND material_code IS NULL)
UNION ALL
SELECT f.id, t.id, factor FROM
  (SELECT id FROM units WHERE code = 'CFT') f,
  (SELECT id FROM units WHERE code = 'CUM') t,
  (VALUES (0.0283168)) AS v(factor)
WHERE NOT EXISTS (SELECT 1 FROM unit_conversions WHERE from_unit_id = f.id AND to_unit_id = t.id AND material_code IS NULL)
UNION ALL
SELECT f.id, t.id, factor FROM
  (SELECT id FROM units WHERE code = 'SQFT') f,
  (SELECT id FROM units WHERE code = 'SQM') t,
  (VALUES (0.092903)) AS v(factor)
WHERE NOT EXISTS (SELECT 1 FROM unit_conversions WHERE from_unit_id = f.id AND to_unit_id = t.id AND material_code IS NULL)
UNION ALL
SELECT f.id, t.id, factor FROM
  (SELECT id FROM units WHERE code = 'FT') f,
  (SELECT id FROM units WHERE code = 'M') t,
  (VALUES (0.3048)) AS v(factor)
WHERE NOT EXISTS (SELECT 1 FROM unit_conversions WHERE from_unit_id = f.id AND to_unit_id = t.id AND material_code IS NULL);

-- ─── Unit conversion function ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_convert_unit(
  p_material_code TEXT,
  p_from_unit_id UUID,
  p_to_unit_id UUID,
  p_quantity NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_factor NUMERIC := 1;
  v_precision INTEGER := 6;
BEGIN
  IF p_quantity IS NULL THEN
    RAISE EXCEPTION 'Quantity cannot be null';
  END IF;

  IF p_from_unit_id IS DISTINCT FROM p_to_unit_id THEN
    SELECT uc.factor
    INTO v_factor
    FROM unit_conversions uc
    WHERE uc.is_active = true
      AND uc.from_unit_id = p_from_unit_id
      AND uc.to_unit_id = p_to_unit_id
      AND (
        uc.material_code IS NULL
        OR uc.material_code = p_material_code
      )
    ORDER BY uc.material_code NULLS LAST
    LIMIT 1;

    IF v_factor IS NULL THEN
      RAISE EXCEPTION 'No unit conversion found from % to % for material %',
        p_from_unit_id, p_to_unit_id, p_material_code;
    END IF;
  END IF;

  SELECT COALESCE(mu.rounding_precision, 6)
  INTO v_precision
  FROM material_units mu
  WHERE mu.material_code = p_material_code
    AND mu.unit_id = p_to_unit_id;

  RETURN ROUND(p_quantity * v_factor, v_precision);
END;
$$;

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;

-- Units are reference data — all authenticated users can read
CREATE POLICY "units_read_all" ON units FOR SELECT TO authenticated USING (true);
CREATE POLICY "units_write_pm" ON units FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND role = 'PM'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND role = 'PM'));

CREATE POLICY "material_units_read_all" ON material_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "material_units_write_pm" ON material_units FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND role = 'PM'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND role = 'PM'));

CREATE POLICY "unit_conversions_read_all" ON unit_conversions FOR SELECT TO authenticated USING (true);
CREATE POLICY "unit_conversions_write_pm" ON unit_conversions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND role = 'PM'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_projects WHERE user_id = auth.uid() AND role = 'PM'));

-- ─── Realtime ───────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE units;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE unit_conversions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Add to audit allowlist ────────────────────────────────────────────────
-- These tables should be auditable via upsert_with_audit when modified.
