import { toast } from 'sonner'
import { exportToCsv } from '@/lib/csv-export'
import { DOR_PCT_ADD, DOR_OVERHEAD_RATE } from '@/lib/project-constants'
import type { BoqItem } from './types'

/**
 * Export a single BOQ item's Rate Analysis as a CSV file.
 *
 * Produces a uniform 7-column table:
 *   Section | Code | Description | UOM | Qty | Rate (NPR) | Amount (NPR)
 *
 * The first column disambiguates the row kind:
 *   - 'Item'      — the BOQ item being analyzed
 *   - 'Material'  — a material resource row
 *   - 'Labour'    — a labour resource row
 *   - 'Equipment' — an equipment resource row
 *   - 'Summary'   — a computed total row (Direct Cost, pctAdd, etc.)
 *
 * The 'Code' column carries the summary label on Summary rows so the file
 * stays a single, parser-friendly table — no mixed-shape sections.
 *
 * Delegates to `exportToCsv` so the file picks up the BOM (Excel UTF-8
 * compatibility) and CSV-injection mitigation that the hand-rolled writer
 * was missing.
 *
 * ⚠️ KNOWN DIVERGENCE: `exportRa` uses DoR default PCC coefficients (the
 * cement/sand/aggregate/labour/equipment constants below). These do NOT
 * reflect the RA Inspector's user-editable resource rows — the inspector
 * seeds each item with an EMPTY resource list and the user adds their own.
 * The export and the inspector will diverge until `exportRa` is wired to
 * read from the inspector's state (or from a persisted `ra_data` JSONB
 * column on `boq_items`). See `ra-inspector.tsx` for the inspector side.
 */
export function exportRa(item: BoqItem | undefined): void {
  if (!item) {
    toast.error('Cannot export RA', { description: 'No item selected.' })
    return
  }

  // Standard DoR resource rows (mirrors the INITIAL_* constants in
  // ra-inspector). Kept here so the export works even without the RA
  // inspector mounted.
  const materials = [
    { code: 'M-CEM-OPC', name: 'Cement OPC 53 Grade (Udauru)', uom: 'Bag', qty: 4.5, rate: 920 },
    { code: 'M-SAND-R', name: 'River Sand (Trishuli)', uom: 'cum', qty: 0.45, rate: 3850 },
    { code: 'M-AGG-20', name: 'Coarse Aggregate 20mm', uom: 'cum', qty: 0.9, rate: 2950 },
    { code: 'M-WAT', name: 'Water (tanker)', uom: 'ltr', qty: 180, rate: 0.45 },
  ]
  const labour = [
    { code: 'L-MASN', name: 'Mason (Skilled Cat. I)', uom: 'day', qty: 0.6, rate: 1450 },
    { code: 'L-HEL', name: 'Mazdoor (Unskilled)', uom: 'day', qty: 1.4, rate: 950 },
    { code: 'L-MIX', name: 'Mixer Operator', uom: 'day', qty: 0.2, rate: 1200 },
  ]
  const equipment = [
    { code: 'E-MIX', name: 'Concrete Mixer 0.4 cum', uom: 'hr', qty: 1.8, rate: 285 },
    { code: 'E-VIB', name: 'Needle Vibrator 60mm', uom: 'hr', qty: 1.2, rate: 95 },
  ]

  const directCost = [...materials, ...labour, ...equipment].reduce((s, r) => s + r.qty * r.rate, 0)
  // DoR default percentage additions on direct cost: 2.5% + 1.5% + 3.5% = 7.5%.
  // The RA Inspector allows user-editable percentage costs — those edits are
  // NOT reflected in this export. When the inspector's user-editable
  // coefficients become the source of truth, swap `DOR_PCT_ADD` for a lookup
  // against the selected item's coefficient overrides.
  const pctAdd = directCost * DOR_PCT_ADD
  const opCost = (directCost + pctAdd) * DOR_OVERHEAD_RATE
  const totalCost = directCost + pctAdd + opCost
  const contractRate = item.rate
  const margin = contractRate - totalCost
  const marginPct = contractRate > 0 ? (margin / contractRate) * 100 : 0

  const headers = ['Section', 'Code', 'Description', 'UOM', 'Qty', 'Rate (NPR)', 'Amount (NPR)']

  const rows: (string | number)[][] = [
    ['Item', item.code, item.desc, item.uom, item.qty, item.rate, item.qty * item.rate],
    ...materials.map((r) => [
      'Material',
      r.code,
      r.name,
      r.uom,
      r.qty,
      r.rate,
      (r.qty * r.rate).toFixed(2),
    ]),
    ...labour.map((r) => [
      'Labour',
      r.code,
      r.name,
      r.uom,
      r.qty,
      r.rate,
      (r.qty * r.rate).toFixed(2),
    ]),
    ...equipment.map((r) => [
      'Equipment',
      r.code,
      r.name,
      r.uom,
      r.qty,
      r.rate,
      (r.qty * r.rate).toFixed(2),
    ]),
    // Summary rows: label in the Code column, value in the Amount column.
    ['Summary', 'Direct Cost', '', '', '', '', directCost.toFixed(2)],
    ['Summary', 'Percentage Additions (7.5%)', '', '', '', '', pctAdd.toFixed(2)],
    ['Summary', 'Overhead (15%)', '', '', '', '', opCost.toFixed(2)],
    ['Summary', 'Total Cost', '', '', '', '', totalCost.toFixed(2)],
    ['Summary', 'Contract Rate', '', '', '', '', contractRate.toFixed(2)],
    ['Summary', 'Margin', '', '', '', '', margin.toFixed(2)],
    ['Summary', 'Margin %', '', '', '', '', marginPct.toFixed(2)],
  ]

  exportToCsv(`RA-${item.code.replace(/\./g, '-')}.csv`, headers, rows)

  // Warn the user that the export uses DoR default coefficients, NOT the
  // RA Inspector's user-editable rows. The inspector's state is local-only
  // (not persisted to the item), so exportRa can't read it. The export and
  // the inspector will diverge until RA data is persisted to a DB column
  // and exportRa is wired to read from it (audit B3-7).
  toast.success('RA exported', {
    description: `RA-${item.code.replace(/\./g, '-')}.csv downloaded · uses DoR default coefficients (not inspector edits)`,
  })
}
