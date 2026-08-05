'use client'

import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Save, FolderOpen, Edit3, CheckCircle2, History, Link2, Layers, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import type { BoqItem } from './types'
import { LocationPicker } from '@/components/ui/location-picker'
import { usePersistentState } from '@/lib/use-persistent-state'
import type { RaRow, PctCosts, CustomPctCost } from './ra-types'
import { computeRaCosts } from './ra-cost-calc'
import { RaSection } from './ra-section'
import { PctCostsSection, OpSection } from './ra-cost-sections'
import { RaFinancialSummary } from './ra-financial-summary'

// Re-export the PCC template constants + RaRow type so existing imports
// from './ra-inspector' keep working. New code should import from
// './ra-types' directly.
export { PCC_TEMPLATE_MATERIALS, PCC_TEMPLATE_LABOUR, PCC_TEMPLATE_EQUIPMENT } from './ra-types'
export type { RaRow } from './ra-types'

export function RaInspector({
  item,
  onUpdateLocation,
}: {
  item: BoqItem
  /**
   * Fired when the user picks (or clears) a work location in the
   * LocationPicker. The parent uses this to mutate its synced boqRows state
   * so the link persists to Supabase and is visible across modules — the
   * inspector can't do that itself because it only owns a local mirror.
   */
  onUpdateLocation?: (locationId: string | null) => void
}) {
  // NOTE: RA state (materials/labour/equipment/pctCosts) is local useState
  // seeded from empty arrays. It is NOT persisted to the database — switching
  // BOQ items or reloading discards all edits. This is a known limitation.
  // The state IS scoped per BOQ item via key={selectedLeaf.id} on the
  // RaInspector mount (index.tsx), so switching items resets the arrays.
  // Persistence requires adding an ra_data JSONB column to boq_items and
  // wiring the local state through useSyncedState.

  const locationId = item.locationId

  // RA state is persisted to localStorage keyed by BOQ item ID so it
  // survives tab switches and page reloads. Previously this was pure
  // useState — users could build a complete rate analysis and lose it
  // by clicking a different BOQ item. Now each item has its own RA
  // slot in localStorage. This is a stopgap — the proper solution is
  // an ra_data JSONB column on boq_items + useSyncedState wiring.
  const raKey = `omnisite-boq-ra-${item.id}`
  const [materials, setMaterials] = usePersistentState<RaRow[]>(
    `${raKey}-materials`,
    () => [] as RaRow[]
  )
  const [labour, setLabour] = usePersistentState<RaRow[]>(`${raKey}-labour`, () => [] as RaRow[])
  const [equipment, setEquipment] = usePersistentState<RaRow[]>(
    `${raKey}-equipment`,
    () => [] as RaRow[]
  )
  const [pctCosts, setPctCosts] = usePersistentState<PctCosts>(`${raKey}-pctCosts`, () => ({
    labour: { on: true, pct: 2.5 },
    material: { on: true, pct: 1.5 },
    equipment: { on: true, pct: 3.5 },
    tp: { on: false, pct: 0 },
  }))
  const [customPctCosts, setCustomPctCosts] = usePersistentState<CustomPctCost[]>(
    `${raKey}-customPctCosts`,
    () => []
  )
  const [opOnDirect, setOpOnDirect] = usePersistentState(`${raKey}-opOnDirect`, true)
  const [opOnPct, setOpOnPct] = usePersistentState(`${raKey}-opOnPct`, true)
  const [opPct, setOpPct] = usePersistentState(`${raKey}-opPct`, 15)

  // Helper to update a single row's field. Field is any keyof RaRow so the
  // inline-editable inputs (code/name/uom) on user-added rows can write back
  // through the same code path as qty/rate.
  const updateRow = (
    setter: React.Dispatch<React.SetStateAction<RaRow[]>>,
    index: number,
    field: keyof RaRow,
    value: string | number
  ) => {
    setter((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }

  // Delete a row from a resource section by index.
  const deleteRow = (setter: React.Dispatch<React.SetStateAction<RaRow[]>>, index: number) => {
    setter((prev) => prev.filter((_, i) => i !== index))
  }

  // Blank row template for the "Add" button. `source: 'Manual'` makes it
  // clear in the UI that this row came from the user, not from a rate library.
  const blankRaRow = (): RaRow => ({
    id: crypto.randomUUID(),
    code: '',
    name: '',
    uom: '',
    qty: 0,
    rate: 0,
    source: 'Manual',
  })

  // Compute the full cost breakdown via the extracted pure function.
  const costs = computeRaCosts({
    materials,
    labour,
    equipment,
    pctCosts,
    customPctCosts,
    opOnDirect,
    opOnPct,
    opPct,
    contractRate: item.rate,
  })

  return (
    <>
      <PaneHeader title={`RA Inspector · ${item.code}`} />
      <PaneBody>
        {/* Item header + Location picker */}
        <div className="border-b border-[var(--pane-divider)] p-4">
          <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Item
          </div>
          <div className="mt-1 text-sm leading-snug font-semibold">{item.desc}</div>
          <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
            <span>
              {item.qty.toLocaleString()} {item.uom}
            </span>
            <span>·</span>
            <span>Rate: NPR {item.rate.toLocaleString()}</span>
          </div>
          {/* Location picker — optional FK to project_locations.id */}
          <div className="mt-2">
            <label className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase">
              <MapPin className="h-3 w-3" />
              Work Location
            </label>
            <LocationPicker
              value={locationId}
              onChange={(locId) => {
                onUpdateLocation?.(locId)
                toast.success('Location linked to BOQ item', {
                  description: locId
                    ? `${item.code} → ${locId}`
                    : `Cleared location on ${item.code}`,
                })
              }}
              allowClear
              placeholder="Link to a project location…"
              className="mt-1"
            />
          </div>
        </div>

        <Tabs defaultValue="builder" className="w-full">
          <div className="px-3 pt-2">
            <TabsList className="grid h-8 grid-cols-3 text-xs">
              <TabsTrigger value="builder" className="text-xs">
                RA Builder
              </TabsTrigger>
              <TabsTrigger value="trace" className="text-xs">
                Traceability
              </TabsTrigger>
              <TabsTrigger value="audit" className="text-xs">
                Audit Log
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="builder" className="mt-0">
            <RaSection
              title="Materials"
              icon={<Layers className="h-3.5 w-3.5" />}
              rows={materials}
              itemUom={item.uom}
              onUpdate={(i, f, v) => updateRow(setMaterials, i, f, v)}
              onAdd={() => setMaterials((prev) => [...prev, blankRaRow()])}
              onDelete={(i) => deleteRow(setMaterials, i)}
            />
            <RaSection
              title="Labour"
              icon={<Layers className="h-3.5 w-3.5" />}
              rows={labour}
              itemUom={item.uom}
              onUpdate={(i, f, v) => updateRow(setLabour, i, f, v)}
              onAdd={() => setLabour((prev) => [...prev, blankRaRow()])}
              onDelete={(i) => deleteRow(setLabour, i)}
            />
            <RaSection
              title="Equipment"
              icon={<Layers className="h-3.5 w-3.5" />}
              rows={equipment}
              itemUom={item.uom}
              onUpdate={(i, f, v) => updateRow(setEquipment, i, f, v)}
              onAdd={() => setEquipment((prev) => [...prev, blankRaRow()])}
              onDelete={(i) => deleteRow(setEquipment, i)}
            />

            <PctCostsSection
              pctCosts={pctCosts}
              setPctCosts={setPctCosts}
              customPctCosts={customPctCosts}
              setCustomPctCosts={setCustomPctCosts}
              directCost={costs.directCost}
              labourCost={costs.labourCost}
              materialCost={costs.materialCost}
              equipCost={costs.equipCost}
              pctCostBase={costs.pctCostBase}
            />

            <OpSection
              opOnDirect={opOnDirect}
              setOpOnDirect={setOpOnDirect}
              opOnPct={opOnPct}
              setOpOnPct={setOpOnPct}
              opPct={opPct}
              setOpPct={setOpPct}
              directCost={costs.directCost}
              pctCostBase={costs.pctCostBase}
              overheadAmount={costs.overheadAmount}
            />

            <RaFinancialSummary costs={costs} contractRate={item.rate} itemUom={item.uom} />
          </TabsContent>

          <TabsContent value="trace" className="mt-0 space-y-3 px-4 py-3">
            <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
              Traceability Matrix
            </div>
            {/* Honest placeholder — the real traceability rows are not wired
                into the inspector yet. Showing fabricated data would mislead
                users. The grid context menu's "View audit log" opens the
                real audit trail; this tab will be populated once the BOQ ↔
                DSR/PO/GRN/RA foreign keys are linked per item. */}
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--pane-divider)] py-8 text-center">
              <Link2 className="text-muted-foreground h-6 w-6 opacity-50" />
              <div className="text-xs font-medium">No traceability data linked yet</div>
              <p className="text-muted-foreground max-w-sm text-[11px] leading-relaxed">
                Traceability data will appear here when DSR entries, POs, GRNs, and RA Bills are
                linked to this BOQ item.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="audit" className="mt-0 space-y-3 px-4 py-3">
            <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
              <History className="h-3.5 w-3.5" />
              Audit Log
            </div>
            {/* The AuditLogViewer component opens as a modal. Embedding it
                inline here would require restructuring it into a non-modal
                variant — out of scope for this fix. Point users to the
                existing affordance so they get the real, server-backed
                audit trail rather than hardcoded fake entries. */}
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--pane-divider)] py-8 text-center">
              <History className="text-muted-foreground h-6 w-6 opacity-50" />
              <div className="text-xs font-medium">Audit log opens from the grid</div>
              <p className="text-muted-foreground max-w-sm text-[11px] leading-relaxed">
                Right-click the BOQ item in the grid → &lsquo;View audit log&rsquo; to see the full
                audit trail.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Preset bar */}
        <div className="bg-secondary/20 flex items-center gap-2 border-t border-[var(--pane-divider)] p-3">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() =>
              toast.info('RA preset saving coming soon', {
                description: 'Presets are managed in Admin → RA Presets.',
              })
            }
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Load Preset
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() =>
              toast.info('RA preset saving coming soon', {
                description: 'Presets are managed in Admin → RA Presets.',
              })
            }
          >
            <Save className="h-3.5 w-3.5" />
            Save Preset
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() =>
              toast.info('Rate Analysis saving coming soon', {
                description:
                  'RA data is currently session-only and lost on item switch. This will be persisted to the boq_items table in a future update.',
              })
            }
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Save RA
          </Button>
        </div>
      </PaneBody>
    </>
  )
}

export function NonPricedInspector({ item }: { item: BoqItem }) {
  return (
    <>
      <PaneHeader title={`Inspector · ${item.code}`} />
      <PaneBody>
        <div className="border-b border-[var(--pane-divider)] p-4">
          <Badge variant="secondary" className="text-xs">
            {item.type}
          </Badge>
          <div className="mt-2 text-sm leading-snug font-semibold">{item.desc}</div>
        </div>
        <div className="text-muted-foreground p-4 text-center text-xs">
          <Edit3 className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <div className="text-foreground font-medium">{item.type} item</div>
          <p className="mt-1 leading-relaxed">
            {item.type === 'Provisional Sum'
              ? 'Lump-sum provision. Rate Analysis is hidden — amount is governed by the Engineer per Clause 13.5 of FIDIC Red Book.'
              : item.type === 'Daywork'
                ? 'Daywork rates apply. Quantities are measured on-site and valued at the Daywork Schedule rates included in the Contract.'
                : 'Heading items do not carry rates or RA buildup.'}
          </p>
        </div>
      </PaneBody>
    </>
  )
}
