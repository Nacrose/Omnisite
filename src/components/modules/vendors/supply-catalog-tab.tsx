'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Package, Plus, Pencil, Check, X, Trash2, ShoppingCart, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { MATERIALS } from '@/data/seed/admin'
import type { Vendor, SuppliedMaterial } from '@/lib/types/vendor'

// ─── Supply Catalog Tab (supplier-only) ──────────────────────────────────────
//
// Per-vendor rate catalog: each row is a material this supplier sells with
// their quoted rate, brand, and UOM. Rates are inline-editable; new rows are
// added from the MATERIALS master so material codes stay in sync with the
// Org / Project material master.
//
// State model
// -----------
// The tab is fully controlled by the parent — every edit calls `onChange` with
// a patched `materialsSupplied` array. Local state is only used for the
// inline-edit row pointer + the "add material" form draft (which only commits
// to the parent on save).

interface SupplyCatalogTabProps {
  vendor: Vendor
  onChange: (updated: Vendor) => void
}

export function SupplyCatalogTab({ vendor, onChange }: SupplyCatalogTabProps) {
  const materials = vendor.materialsSupplied ?? []

  // Inline rate-edit pointer: code of the row currently being edited + draft
  // rate string. Using a string for the input value lets the user type "920."
  // or clear the field without the Number coercion bouncing back to 0.
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [draftRate, setDraftRate] = useState('')

  // "Add Material" form draft. The form is hidden until the user clicks the
  // "+ Add Material" button. `selectedCode` drives an autofill of brand /
  // rate / uom from the MATERIALS master so the user only adjusts if needed.
  const [showAddForm, setShowAddForm] = useState(false)
  const [addCode, setAddCode] = useState('')
  const [addBrand, setAddBrand] = useState('')
  const [addRate, setAddRate] = useState('')
  const [addUom, setAddUom] = useState('')

  // ─── Helpers ────────────────────────────────────────────────────────────

  const patchMaterials = (next: SuppliedMaterial[]) => {
    onChange({ ...vendor, materialsSupplied: next })
  }

  const updateMaterial = (code: string, p: Partial<SuppliedMaterial>) => {
    patchMaterials(materials.map((m) => (m.code === code ? { ...m, ...p } : m)))
  }

  const removeMaterial = (code: string) => {
    patchMaterials(materials.filter((m) => m.code !== code))
    toast.success('Material removed', { description: `${code} removed from catalog` })
  }

  const startEdit = (m: SuppliedMaterial) => {
    setEditingCode(m.code)
    setDraftRate(String(m.rate))
  }

  const cancelEdit = () => {
    setEditingCode(null)
    setDraftRate('')
  }

  const commitEdit = (code: string) => {
    const rate = Number(draftRate)
    if (!Number.isFinite(rate) || rate < 0) {
      toast.error('Invalid rate', { description: 'Rate must be a non-negative number.' })
      return
    }
    updateMaterial(code, { rate, lastUpdated: todayISO() })
    cancelEdit()
    toast.success('Rate updated', { description: `${code} → NPR ${rate.toLocaleString()}` })
  }

  const onAddCodeChange = (code: string) => {
    setAddCode(code)
    // Autofill rate + uom from the MATERIALS master so the user only has to
    // override if the supplier quoted differently. Brand is left blank for
    // the user to fill in (the master doesn't carry brand info).
    const m = MATERIALS.find((x) => x.code === code)
    if (m) {
      setAddUom(m.uom)
      setAddRate(String(m.projectRate ?? m.rate))
    }
  }

  const commitAdd = () => {
    if (!addCode) {
      toast.error('Material required', { description: 'Pick a material from the master list.' })
      return
    }
    if (materials.some((m) => m.code === addCode)) {
      toast.error('Already in catalog', {
        description:
          'This material is already in the supplier catalog. Edit the existing row instead.',
      })
      return
    }
    const master = MATERIALS.find((x) => x.code === addCode)
    const rate = Number(addRate)
    if (!Number.isFinite(rate) || rate < 0) {
      toast.error('Invalid rate', { description: 'Rate must be a non-negative number.' })
      return
    }
    const entry: SuppliedMaterial = {
      code: addCode,
      name: master?.name ?? addCode,
      brand: addBrand.trim() || undefined,
      rate,
      uom: addUom.trim() || master?.uom || '',
      lastUpdated: todayISO(),
    }
    patchMaterials([...materials, entry])
    toast.success('Material added', { description: `${addCode} added to catalog` })
    // Reset the form
    setAddCode('')
    setAddBrand('')
    setAddRate('')
    setAddUom('')
    setShowAddForm(false)
  }

  const cancelAdd = () => {
    setAddCode('')
    setAddBrand('')
    setAddRate('')
    setAddUom('')
    setShowAddForm(false)
  }

  // Catalog totals — sum of rates and the count of materials.
  // The task mentions "sum of (rate × typical qty) or just a count" — we don't
  // have a typical-qty field per SuppliedMaterial, so we show the count plus a
  // rate-card average to give the user a sense of the supplier's positioning.
  const rateCardSum = materials.reduce((s, m) => s + (Number.isFinite(m.rate) ? m.rate : 0), 0)
  const rateCardAvg = materials.length > 0 ? Math.round(rateCardSum / materials.length) : 0

  // MATERIALS rows available for the Add dropdown — exclude codes already in
  // this vendor's catalog and exclude archived rows (the dropdown shouldn't
  // offer materials the org has retired).
  const availableForAdd = MATERIALS.filter(
    (m) => !m.archived && !materials.some((s) => s.code === m.code)
  )

  return (
    <div className="space-y-4 p-4 text-xs">
      {/* ─── Summary strip ─────────────────────────────────────────────── */}
      <section>
        <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
          <Package className="h-3 w-3" /> Supply Catalog
        </div>
        <div className="grid grid-cols-3 gap-2">
          <SummaryCard label="Materials" value={String(materials.length)} />
          <SummaryCard label="Rate-card sum" value={`NPR ${rateCardSum.toLocaleString('en-IN')}`} />
          <SummaryCard label="Avg rate" value={`NPR ${rateCardAvg.toLocaleString('en-IN')}`} />
        </div>
      </section>

      <Separator />

      {/* ─── Catalog table ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Materials Supplied
          </div>
          {!showAddForm && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-[11px]"
              onClick={() => setShowAddForm(true)}
              disabled={availableForAdd.length === 0}
              title={
                availableForAdd.length === 0
                  ? 'No more materials to add'
                  : 'Add material to catalog'
              }
            >
              <Plus className="h-3 w-3" />
              Add Material
            </Button>
          )}
        </div>

        {/* Add-material form — collapses inline above the table */}
        {showAddForm && (
          <div className="mb-2 rounded-md border border-sky-500/30 bg-sky-500/5 p-2.5">
            <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
              New Catalog Entry
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FieldRow label="Material (from master)">
                <select
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-md border px-2 text-xs outline-none focus-visible:ring-[3px]"
                  value={addCode}
                  onChange={(e) => onAddCodeChange(e.target.value)}
                  autoFocus
                >
                  <option value="">Select material…</option>
                  {availableForAdd.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.code} · {m.name}
                    </option>
                  ))}
                </select>
              </FieldRow>
              <FieldRow label="Brand">
                <Input
                  className="h-8 text-xs"
                  placeholder="e.g. Udaipur OPC 53"
                  value={addBrand}
                  onChange={(e) => setAddBrand(e.target.value)}
                />
              </FieldRow>
              <FieldRow label="Rate (NPR)">
                <Input
                  type="number"
                  min={0}
                  className="h-8 font-mono text-xs"
                  value={addRate}
                  onChange={(e) => setAddRate(e.target.value)}
                />
              </FieldRow>
              <FieldRow label="UOM">
                <Input
                  className="h-8 text-xs"
                  placeholder="Bag / cum / MT…"
                  value={addUom}
                  onChange={(e) => setAddUom(e.target.value)}
                />
              </FieldRow>
            </div>
            <div className="mt-2 flex justify-end gap-1.5">
              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={cancelAdd}>
                <X className="h-3 w-3" />
                Cancel
              </Button>
              <Button size="sm" className="h-7 gap-1 text-[11px]" onClick={commitAdd}>
                <Check className="h-3 w-3" />
                Add to Catalog
              </Button>
            </div>
          </div>
        )}

        {/* Header row */}
        <div className="overflow-hidden rounded-md border border-[var(--pane-divider)]">
          <div className="bg-secondary/40 text-muted-foreground flex items-center border-b border-[var(--pane-divider)] px-2 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
            <div className="w-24 px-1">Code</div>
            <div className="min-w-0 flex-1 px-1">Material</div>
            <div className="w-20 px-1">Brand</div>
            <div className="w-24 px-1 text-right">Rate (NPR)</div>
            <div className="w-14 px-1 text-right">UOM</div>
            <div className="w-24 px-1">Last Updated</div>
            <div className="w-20 px-1 text-right">Actions</div>
          </div>

          {/* Body */}
          {materials.length === 0 ? (
            <div className="text-muted-foreground p-4 text-center text-[11px]">
              No materials in this catalog yet. Click “Add Material” to start.
            </div>
          ) : (
            materials.map((m) => {
              const isEditing = editingCode === m.code
              return (
                <div
                  key={m.code}
                  className="flex items-center border-b border-[var(--pane-divider)] px-2 py-1.5 last:border-b-0"
                >
                  {/* Code */}
                  <div className="text-muted-foreground w-24 truncate px-1 font-mono text-[11px]">
                    {m.code}
                  </div>
                  {/* Name */}
                  <div className="min-w-0 flex-1 px-1">
                    <div className="truncate text-[11px] font-medium">{m.name}</div>
                  </div>
                  {/* Brand */}
                  <div className="text-muted-foreground w-20 truncate px-1 text-[11px]">
                    {m.brand || '—'}
                  </div>
                  {/* Rate */}
                  <div className="w-24 px-1 text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        min={0}
                        autoFocus
                        className="h-7 text-right font-mono text-xs"
                        value={draftRate}
                        onChange={(e) => setDraftRate(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit(m.code)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(m)}
                        className="group inline-flex items-center gap-1 font-mono text-[11px]"
                        title="Click to edit rate"
                      >
                        <span>{m.rate.toLocaleString('en-IN')}</span>
                        <Pencil className="text-muted-foreground/50 h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    )}
                  </div>
                  {/* UOM */}
                  <div className="text-muted-foreground w-14 truncate px-1 text-right text-[11px]">
                    {m.uom || '—'}
                  </div>
                  {/* Last updated */}
                  <div className="text-muted-foreground w-24 px-1 text-[10px]">
                    {m.lastUpdated ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" />
                        {fmtDate(m.lastUpdated)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex w-20 justify-end gap-1 px-1">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => commitEdit(m.code)}
                          className="rounded p-1 text-emerald-600 hover:bg-emerald-500/15"
                          title="Save rate"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="hover:bg-accent text-muted-foreground rounded p-1"
                          title="Cancel"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(m)}
                          className="hover:bg-accent text-muted-foreground rounded p-1"
                          title="Edit rate"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeMaterial(m.code)}
                          className="rounded p-1 text-red-600 hover:bg-red-500/15"
                          title="Remove from catalog"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
        {materials.length > 0 && (
          <div className="text-muted-foreground mt-2 flex items-center gap-1.5 text-[10px]">
            <ShoppingCart className="h-3 w-3" />
            Click a rate to edit inline. Edits update the parent vendor record immediately.
          </div>
        )}
      </section>

      <Separator />

      {/* ─── Catalog total ─────────────────────────────────────────────── */}
      <section>
        <div className="bg-secondary/40 flex items-center justify-between rounded-md p-2.5">
          <div>
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Catalog Total
            </div>
            <div className="mt-0.5 text-[11px]">
              <span className="font-mono font-semibold">{materials.length}</span>{' '}
              <span className="text-muted-foreground">materials supplied</span>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {vendor.id}
          </Badge>
        </div>
      </section>
    </div>
  )
}

// ─── Small presentational helpers ────────────────────────────────────────────

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary/40 rounded-md p-2">
      <div className="text-muted-foreground text-[9px] font-semibold tracking-wider uppercase">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[12px] font-semibold">{value}</div>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wider uppercase">
        {label}
      </label>
      {children}
    </div>
  )
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function todayISO(): string {
  // Local date in YYYY-MM-DD — avoids the UTC drift of new Date().toISOString().
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fmtDate(iso: string): string {
  // Accept "YYYY-MM-DD" or full ISO; render as "12 Aug 2026".
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
