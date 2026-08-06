/**
 * Labor rate library seed data.
 *
 * Standard DoR (Department of Roads) labor rates for Nepal.
 * Used by:
 *   - Admin → Labor tab (CRUD)
 *   - Scheduler Task Inspector → resource assignment (rate lookup)
 *   - RA Builder → Labour section (library lookup)
 */

export interface LaborRate {
  id: string
  code: string
  name: string
  category: 'Skilled' | 'Unskilled' | 'Supervisor'
  uom: string
  rate: number
  otRate: number
  source: string
  archived?: boolean
}

export const LABOR_RATES: LaborRate[] = [
  { id: 'LR-MASN-S1', code: 'L-MASN', name: 'Mason (Skilled Cat. I)', category: 'Skilled', uom: 'day', rate: 1450, otRate: 2175, source: 'DoR Norm 2075' },
  { id: 'LR-MASN-S2', code: 'L-MASN2', name: 'Mason (Skilled Cat. II)', category: 'Skilled', uom: 'day', rate: 1300, otRate: 1950, source: 'DoR Norm 2075' },
  { id: 'LR-HEL', code: 'L-HEL', name: 'Mazdoor (Unskilled)', category: 'Unskilled', uom: 'day', rate: 950, otRate: 1425, source: 'DoR Norm 2075' },
  { id: 'LR-MIX', code: 'L-MIX', name: 'Mixer Operator', category: 'Skilled', uom: 'day', rate: 1200, otRate: 1800, source: 'DoR Norm 2075' },
  { id: 'LR-BARP', code: 'L-BARP', name: 'Bar Bender & Cutter', category: 'Skilled', uom: 'day', rate: 1350, otRate: 2025, source: 'DoR Norm 2075' },
  { id: 'LR-CARP', code: 'L-CARP', name: 'Carpenter', category: 'Skilled', uom: 'day', rate: 1400, otRate: 2100, source: 'DoR Norm 2075' },
  { id: 'LR-WELD', code: 'L-WELD', name: 'Welder', category: 'Skilled', uom: 'day', rate: 1500, otRate: 2250, source: 'DoR Norm 2075' },
  { id: 'LR-DRIV', code: 'L-DRIV', name: 'Driver (Heavy Vehicle)', category: 'Skilled', uom: 'day', rate: 1100, otRate: 1650, source: 'DoR Norm 2075' },
  { id: 'LR-SURV', code: 'L-SURV', name: 'Surveyor', category: 'Skilled', uom: 'day', rate: 2000, otRate: 3000, source: 'DoR Norm 2075' },
  { id: 'LR-FORE', code: 'L-FORE', name: 'Foreman', category: 'Supervisor', uom: 'day', rate: 1800, otRate: 2700, source: 'DoR Norm 2075' },
]
