-- ============================================================
-- OmniSite — Seed Data
-- Run this AFTER the schema SQL in Supabase SQL Editor
-- ============================================================

-- Get the default project ID
DO $$
DECLARE
  proj_id UUID;
BEGIN
  SELECT id INTO proj_id FROM projects LIMIT 1;

  -- ─── BOQ Items ──────────────────────────────────────────────
  INSERT INTO boq_items (id, project_id, code, description, type, qty, uom, rate, has_ra, level, parent_id) VALUES
    ('1', proj_id, '1', 'Bridge over Bagmati River', 'Heading', 0, '', 0, false, 0, NULL),
    ('1.1', proj_id, '1.1', 'Foundation Works', 'Heading', 0, '', 0, false, 1, '1'),
    ('1.1.1', proj_id, '1.1.1', 'Excavation in ordinary soil', 'Priced', 1240, 'cum', 485, true, 2, '1.1'),
    ('1.1.2', proj_id, '1.1.2', 'Stone soling 150mm thick', 'Priced', 320, 'cum', 4250, true, 2, '1.1'),
    ('1.1.3', proj_id, '1.1.3', 'PCC M15 (1:2:4) below footing', 'Priced', 145, 'cum', 9800, true, 2, '1.1'),
    ('1.1.4', proj_id, '1.1.4', 'PCC M20 grade concrete', 'Priced', 145, 'cum', 12400, true, 2, '1.1'),
    ('1.2', proj_id, '1.2', 'Substructure', 'Heading', 0, '', 0, false, 1, '1'),
    ('1.2.1', proj_id, '1.2.1', 'Reinforcement steel Fe500 (TMT)', 'Priced', 18.5, 'MT', 118000, true, 2, '1.2'),
    ('1.2.2', proj_id, '1.2.2', 'Shuttering ply waterproof', 'Priced', 420, 'sqm', 980, true, 2, '1.2'),
    ('1.2.3', proj_id, '1.2.3', 'Dewatering provision', 'Provisional Sum', 1, 'lot', 250000, false, 2, '1.2'),
    ('2', proj_id, '2', 'Road Works', 'Heading', 0, '', 0, false, 0, NULL),
    ('2.1', proj_id, '2.1', 'Earthwork', 'Heading', 0, '', 0, false, 1, '2'),
    ('2.1.1', proj_id, '2.1.1', 'Excavation for road formation', 'Priced', 18500, 'cum', 412, true, 2, '2.1'),
    ('2.1.2', proj_id, '2.1.2', 'Embankment fill (compacted)', 'Priced', 8200, 'cum', 385, true, 2, '2.1'),
    ('2.2', proj_id, '2.2', 'Pavement', 'Heading', 0, '', 0, false, 1, '2'),
    ('2.2.1', proj_id, '2.2.1', 'DBM 50mm thick bituminous layer', 'Priced', 14200, 'sqm', 1450, true, 2, '2.2'),
    ('2.2.2', proj_id, '2.2.2', 'BC 40mm wearing course', 'Priced', 14200, 'sqm', 1680, true, 2, '2.2'),
    ('2.2.3', proj_id, '2.2.3', 'Prime coat application', 'Daywork', 1, 'lot', 0, false, 2, '2.2'),
    ('3', proj_id, '3', 'Drainage & Cross Drainage', 'Heading', 0, '', 0, false, 0, NULL),
    ('3.1', proj_id, '3.1', 'Hume pipe NP3 600mm dia', 'Priced', 84, 'rmt', 6800, true, 1, '3'),
    ('3.2', proj_id, '3.2', 'Box culvert 2x2m precast', 'Priced', 6, 'no', 285000, true, 1, '3')
  ON CONFLICT (id) DO NOTHING;

  -- ─── Schedule Tasks ─────────────────────────────────────────
  INSERT INTO tasks (id, project_id, name, type, start_week, duration, progress, baseline_start, baseline_finish, critical, constraints, parent_id) VALUES
    ('T-100', proj_id, 'Site Mobilization', 'Summary', 0, 6, 100, 0, 6, false, NULL, NULL),
    ('T-101', proj_id, 'Setup site office & storage', 'Work', 0, 3, 100, 0, 3, false, 'ASAP', 'T-100'),
    ('T-102', proj_id, 'Plant & machinery deployment', 'Work', 2, 4, 100, 2, 6, false, NULL, 'T-100'),
    ('T-103', proj_id, 'Mobilization milestone', 'Milestone', 6, 0, 100, 6, 6, false, 'FNLT', 'T-100'),
    ('T-200', proj_id, 'Foundation Works', 'Summary', 5, 14, 72, 4, 18, false, NULL, NULL),
    ('T-201', proj_id, 'Excavation ch. 0+000 to 1+200', 'Work', 5, 5, 100, 4, 9, false, 'SNET', 'T-200'),
    ('T-202', proj_id, 'Stone soling layer', 'Work', 9, 3, 88, 9, 12, false, NULL, 'T-200'),
    ('T-203', proj_id, 'PCC M15 pouring', 'Work', 11, 4, 62, 12, 16, true, NULL, 'T-200'),
    ('T-204', proj_id, 'PCC curing period', 'Work', 14, 5, 25, 15, 20, false, 'FS+5', 'T-200'),
    ('T-300', proj_id, 'Box Culvert Construction', 'Summary', 14, 20, 35, 13, 33, false, NULL, NULL),
    ('T-301', proj_id, 'Hammock — Tunneling uncertain', 'Hammock', 14, 18, 35, 13, 31, true, 'Must Finish On: Wk 32', 'T-300'),
    ('T-302', proj_id, 'Base slab concrete', 'Work', 14, 5, 70, 14, 19, false, NULL, 'T-300'),
    ('T-303', proj_id, 'Wall & slab rebar', 'Work', 18, 8, 12, 18, 26, true, NULL, 'T-300'),
    ('T-400', proj_id, 'Pavement Works', 'Summary', 30, 18, 8, 30, 48, false, NULL, NULL),
    ('T-401', proj_id, 'Subgrade preparation', 'Work', 30, 6, 25, 30, 36, false, NULL, 'T-400'),
    ('T-402', proj_id, 'DBM 50mm layer', 'Work', 35, 8, 0, 36, 44, false, NULL, 'T-400'),
    ('T-403', proj_id, 'BC wearing course', 'Work', 42, 6, 0, 44, 50, false, NULL, 'T-400'),
    ('T-404', proj_id, 'Road opening milestone', 'Milestone', 48, 0, 0, 50, 50, false, 'MFO: Wk 48', 'T-400')
  ON CONFLICT (id) DO NOTHING;

  -- ─── CBS Nodes (Financials) ─────────────────────────────────
  INSERT INTO cbs_nodes (code, project_id, name, budget, committed, actual, forecast, margin_pct, level, parent_code) VALUES
    ('1', proj_id, 'Bridge Works', 285000000, 268000000, 142500000, 278000000, 2.4, 0, NULL),
    ('1.1', proj_id, 'Foundation', 84000000, 82000000, 48300000, 80500000, 4.2, 1, '1'),
    ('1.2', proj_id, 'Substructure', 112000000, 108000000, 64200000, 110800000, 1.1, 1, '1'),
    ('1.3', proj_id, 'Superstructure', 89000000, 78000000, 30000000, 86700000, 2.6, 1, '1'),
    ('2', proj_id, 'Road Works', 145000000, 138000000, 82300000, 142500000, 1.7, 0, NULL),
    ('2.1', proj_id, 'Earthwork', 38000000, 36500000, 28400000, 37200000, 2.1, 1, '2'),
    ('2.2', proj_id, 'Pavement', 89000000, 84500000, 48700000, 87800000, 1.3, 1, '2'),
    ('2.3', proj_id, 'Signage & Markings', 18000000, 17000000, 5200000, 17500000, 2.8, 1, '2'),
    ('3', proj_id, 'Drainage', 57400000, 54200000, 18400000, 56800000, 1.0, 0, NULL)
  ON CONFLICT (code) DO NOTHING;

  -- ─── Q&S Items ──────────────────────────────────────────────
  INSERT INTO qs_items (id, project_id, type, title, linked_boq, status, date, assignee, due_date, severity, billing_hold) VALUES
    ('ITR-042', proj_id, 'ITR', 'PCC M15 — footing at ch. 4+200 to 4+350', '1.1.3', 'Submitted', '30 Jul 2026', 'Er. Suresh (Consultant)', NULL, NULL, false),
    ('ITR-041', proj_id, 'ITR', 'Stone soling at pier P-4', '1.1.2', 'Approved', '29 Jul 2026', NULL, NULL, NULL, false),
    ('NCR-034', proj_id, 'NCR', 'Rebar cover < 40mm at box culvert base slab', '3.2', 'Open', '28 Jul 2026', 'Bikash Rai', '05 Aug 2026', 'high', true),
    ('NCR-033', proj_id, 'NCR', 'Honeycombing in PCC at ch. 4+050', '1.1.4', 'Closed', '20 Jul 2026', NULL, NULL, NULL, false),
    ('PCH-018', proj_id, 'Punch', 'Smooth edges at expansion joint', NULL, 'Open', '27 Jul 2026', 'Foreman Ram', '15 Aug 2026', 'low', false),
    ('PCH-017', proj_id, 'Punch', 'Clean debris from drainage outlet', NULL, 'Closed', '22 Jul 2026', NULL, NULL, NULL, false),
    ('INC-005', proj_id, 'Incident', 'Worker minor cut at rebar yard', NULL, 'Closed', '25 Jul 2026', NULL, NULL, 'low', false),
    ('NM-012', proj_id, 'Near-Miss', 'Tipper reversing without spotter', NULL, 'Open', '28 Jul 2026', NULL, NULL, 'medium', false)
  ON CONFLICT (id) DO NOTHING;

  -- ─── Equipment ──────────────────────────────────────────────
  INSERT INTO equipment (id, project_id, name, type, status, owned, operator, license_expiry, charge_rate, fuel_today, hours_today, burn_rate, burn_norm) VALUES
    ('E-001', proj_id, 'JCB 3DX Excavator', 'Excavator', 'active', false, 'Hari Bahadur', '2026-12-15', 1850, 32, 8, 4.0, 3.5),
    ('E-002', proj_id, 'Tata 1109 Tipper', 'Tipper Truck', 'active', false, 'Suresh Tamang', '2027-02-20', 1200, 18, 9, 2.0, 2.5),
    ('E-003', proj_id, 'Concrete Mixer 0.4 cum', 'Mixer', 'active', true, NULL, NULL, 285, 12, 6, 2.0, 2.0),
    ('E-004', proj_id, 'Needle Vibrator 60mm', 'Vibrator', 'idle', true, NULL, NULL, 95, NULL, NULL, NULL, NULL),
    ('E-005', proj_id, 'Batching Plant 30 cum/hr', 'Plant', 'breakdown', false, 'Ram Lal', '2026-10-12', 4200, NULL, NULL, NULL, NULL)
  ON CONFLICT (id) DO NOTHING;

  -- ─── Workers ────────────────────────────────────────────────
  INSERT INTO workers (id, project_id, name, trade, phone, status, clock_in, clock_out, geo_fence, today_hours, allocated) VALUES
    ('W-001', proj_id, 'Ram Bahadur Thapa', 'Mason (Skilled)', '+977-98XXXXXXXX', 'on-site', '07:42', NULL, true, 8, '[{"task":"T-203 PCC M15","hours":4},{"task":"T-301 Base slab","hours":4}]'),
    ('W-002', proj_id, 'Sita Gurung', 'Mazdoor (Unskilled)', '+977-98XXXXXXXX', 'on-site', '07:55', NULL, true, 8, '[{"task":"T-203 PCC M15","hours":8}]'),
    ('W-003', proj_id, 'Hari Karki', 'Bar bender', '+977-98XXXXXXXX', 'on-site', '08:10', NULL, true, 7.5, '[{"task":"T-303 Wall & slab rebar","hours":6},{"task":"T-301 Base slab","hours":1.5}]'),
    ('W-004', proj_id, 'Bikas Tamang', 'Mazdoor (Unskilled)', '+977-98XXXXXXXX', 'off-site', '07:48', '11:30', false, 3.5, '[{"task":"T-201 Excavation","hours":3.5}]'),
    ('W-005', proj_id, 'Gopal Shrestha', 'Operator', '+977-98XXXXXXXX', 'on-site', '07:30', NULL, true, 9, '[{"task":"T-201 Excavation","hours":8},{"task":"T-202 Stone soling","hours":1}]'),
    ('W-006', proj_id, 'Anita Lama', 'Helper', '+977-98XXXXXXXX', 'break', '08:00', NULL, true, 4, '[{"task":"T-204 Curing","hours":4}]')
  ON CONFLICT (id) DO NOTHING;

END $$;
