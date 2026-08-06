'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Plus, Search, Trash2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { usePersistentState } from '@/lib/use-persistent-state'

interface UnitRow {
  id: string
  code: string
  name: string
  unitType: string
  isBaseUnit: boolean
  isActive: boolean
}

interface ConversionRow {
  id: string
  fromCode: string
  toCode: string
  factor: number
  materialCode: string
}

const SEED_UNITS: UnitRow[] = [
  { id: 'u-bag', code: 'BAG', name: 'Bag (50kg cement)', unitType: 'Weight', isBaseUnit: false, isActive: true },
  { id: 'u-kg', code: 'KG', name: 'Kilogram', unitType: 'Weight', isBaseUnit: true, isActive: true },
  { id: 'u-ton', code: 'TON', name: 'Metric Ton', unitType: 'Weight', isBaseUnit: false, isActive: true },
  { id: 'u-cum', code: 'CUM', name: 'Cubic Meter', unitType: 'Volume', isBaseUnit: true, isActive: true },
  { id: 'u-cft', code: 'CFT', name: 'Cubic Feet', unitType: 'Volume', isBaseUnit: false, isActive: true },
  { id: 'u-ltr', code: 'LTR', name: 'Liter', unitType: 'Volume', isBaseUnit: false, isActive: true },
  { id: 'u-sqm', code: 'SQM', name: 'Square Meter', unitType: 'Area', isBaseUnit: true, isActive: true },
  { id: 'u-sqft', code: 'SQFT', name: 'Square Feet', unitType: 'Area', isBaseUnit: false, isActive: true },
  { id: 'u-m', code: 'M', name: 'Meter', unitType: 'Length', isBaseUnit: true, isActive: true },
  { id: 'u-ft', code: 'FT', name: 'Feet', unitType: 'Length', isBaseUnit: false, isActive: true },
  { id: 'u-nos', code: 'NOS', name: 'Numbers', unitType: 'Count', isBaseUnit: true, isActive: true },
  { id: 'u-day', code: 'DAY', name: 'Day', unitType: 'Time', isBaseUnit: true, isActive: true },
  { id: 'u-hr', code: 'HR', name: 'Hour', unitType: 'Time', isBaseUnit: false, isActive: true },
]

const SEED_CONVERSIONS: ConversionRow[] = [
  { id: 'c-1', fromCode: 'TON', toCode: 'KG', factor: 1000, materialCode: '' },
  { id: 'c-2', fromCode: 'BAG', toCode: 'KG', factor: 50, materialCode: '' },
  { id: 'c-3', fromCode: 'CFT', toCode: 'CUM', factor: 0.0283168, materialCode: '' },
  { id: 'c-4', fromCode: 'SQFT', toCode: 'SQM', factor: 0.092903, materialCode: '' },
  { id: 'c-5', fromCode: 'FT', toCode: 'M', factor: 0.3048, materialCode: '' },
]

const TYPE_COLORS: Record<string, string> = {
  Weight: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
  Volume: 'border-sky-500/40 text-sky-700 dark:text-sky-300',
  Area: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
  Length: 'border-violet-500/40 text-violet-700 dark:text-violet-300',
  Count: 'border-slate-400/40 text-muted-foreground',
  Time: 'border-rose-500/40 text-rose-700 dark:text-rose-300',
}

export function UnitsView() {
  const [units, setUnits] = usePersistentState<UnitRow[]>('omnisite-admin-units', () => SEED_UNITS)
  const [conversions, setConversions] = usePersistentState<ConversionRow[]>('omnisite-admin-conversions', () => SEED_CONVERSIONS)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [tab, setTab] = useState<'units' | 'conversions'>('units')

  const q = searchQuery.toLowerCase()
  const filteredUnits = units.filter(
    (u) => !q || u.code.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || u.unitType.toLowerCase().includes(q)
  )
  const selectedUnit = units.find((u) => u.id === selectedUnitId)

  const addUnit = () => {
    const newUnit: UnitRow = {
      id: `u-${crypto.randomUUID().slice(0, 8)}`,
      code: '',
      name: '',
      unitType: 'Count',
      isBaseUnit: false,
      isActive: true,
    }
    setUnits((prev) => [...prev, newUnit])
    setSelectedUnitId(newUnit.id)
  }

  const updateUnit = (id: string, field: keyof UnitRow, value: string | boolean) => {
    setUnits((prev) => prev.map((u) => (u.id === id ? { ...u, [field]: value } : u)))
  }

  const deleteUnit = (id: string) => {
    setUnits((prev) => prev.filter((u) => u.id !== id))
    if (selectedUnitId === id) setSelectedUnitId(null)
    toast.success('Unit deleted')
  }

  const addConversion = () => {
    setConversions((prev) => [...prev, {
      id: `c-${crypto.randomUUID().slice(0, 8)}`,
      fromCode: '',
      toCode: '',
      factor: 1,
      materialCode: '',
    }])
  }

  const updateConversion = (id: string, field: keyof ConversionRow, value: string | number) => {
    setConversions((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)))
  }

  const deleteConversion = (id: string) => {
    setConversions((prev) => prev.filter((c) => c.id !== id))
    toast.success('Conversion deleted')
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col border-r border-[var(--pane-divider)]">
        {/* Tab switcher */}
        <div className="flex gap-1 border-b border-[var(--pane-divider)] px-3 py-2">
          <button
            onClick={() => setTab('units')}
            className={cn('rounded-md px-3 py-1 text-xs', tab === 'units' ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}
          >
            Units ({units.length})
          </button>
          <button
            onClick={() => setTab('conversions')}
            className={cn('rounded-md px-3 py-1 text-xs', tab === 'conversions' ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}
          >
            Conversions ({conversions.length})
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-[var(--pane-divider)] px-3 py-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder={tab === 'units' ? 'Search units…' : 'Search conversions…'}
              className="h-8 pl-7 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'units' ? (
            <>
              {filteredUnits.map((u) => (
                <div
                  key={u.id}
                  onClick={() => setSelectedUnitId(u.id)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 border-b border-[var(--pane-divider)] px-3 py-2 transition-colors',
                    selectedUnitId === u.id ? 'bg-accent' : 'hover:bg-accent/30'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{u.name || '—'}</span>
                      {u.isBaseUnit && <Badge variant="outline" className="h-4 px-1 text-[8px] text-emerald-700 dark:text-emerald-300">base</Badge>}
                    </div>
                    <div className="text-muted-foreground text-[10px]">{u.code} · {u.unitType}</div>
                  </div>
                  {!u.isActive && <Badge variant="outline" className="text-[8px] text-muted-foreground">archived</Badge>}
                </div>
              ))}
            </>
          ) : (
            <>
              {conversions.filter((c) => !q || c.fromCode.toLowerCase().includes(q) || c.toCode.toLowerCase().includes(q)).map((c) => (
                <div key={c.id} className="flex items-center gap-3 border-b border-[var(--pane-divider)] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <span className="font-mono">{c.fromCode || '—'}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono">{c.toCode || '—'}</span>
                    </div>
                    <div className="text-muted-foreground text-[10px]">
                      Factor: {c.factor}
                      {c.materialCode && ` · material: ${c.materialCode}`}
                    </div>
                  </div>
                  <button onClick={() => deleteConversion(c.id)} className="text-muted-foreground hover:text-red-500" title="Delete">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {tab === 'conversions' && (
                <div className="p-2">
                  <Button variant="outline" size="sm" className="h-7 w-full gap-1.5 text-xs" onClick={addConversion}>
                    <Plus className="h-3 w-3" /> Add Conversion
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Add unit button */}
        {tab === 'units' && (
          <div className="border-t border-[var(--pane-divider)] p-2">
            <Button variant="outline" size="sm" className="h-7 w-full gap-1.5 text-xs" onClick={addUnit}>
              <Plus className="h-3 w-3" /> Add Unit
            </Button>
          </div>
        )}
      </div>

      {/* Inspector */}
      {selectedUnit && tab === 'units' && (
        <div className="w-80 space-y-3 p-4">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Unit Details</div>
          <div>
            <label className="text-[10px] font-medium">Code</label>
            <Input className="mt-0.5 h-7 font-mono text-xs uppercase" value={selectedUnit.code} onChange={(e) => updateUnit(selectedUnit.id, 'code', e.target.value.toUpperCase())} />
          </div>
          <div>
            <label className="text-[10px] font-medium">Name</label>
            <Input className="mt-0.5 h-7 text-xs" value={selectedUnit.name} onChange={(e) => updateUnit(selectedUnit.id, 'name', e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-medium">Type</label>
            <select className="mt-0.5 h-7 w-full rounded border border-[var(--pane-divider)] bg-transparent px-2 text-xs" value={selectedUnit.unitType} onChange={(e) => updateUnit(selectedUnit.id, 'unitType', e.target.value)}>
              <option value="Weight">Weight</option>
              <option value="Volume">Volume</option>
              <option value="Area">Area</option>
              <option value="Length">Length</option>
              <option value="Count">Count</option>
              <option value="Time">Time</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-[11px]">
            <Switch checked={selectedUnit.isBaseUnit} onCheckedChange={(v) => updateUnit(selectedUnit.id, 'isBaseUnit', v)} />
            <span>Base unit (reference for conversions)</span>
          </label>
          <label className="flex items-center gap-2 text-[11px]">
            <Switch checked={selectedUnit.isActive} onCheckedChange={(v) => updateUnit(selectedUnit.id, 'isActive', v)} />
            <span>Active</span>
          </label>
          <Button variant="outline" size="sm" className="h-7 w-full gap-1.5 text-xs text-red-600" onClick={() => deleteUnit(selectedUnit.id)}>
            <Trash2 className="h-3 w-3" /> Delete
          </Button>
        </div>
      )}

      {/* Conversions inline editor */}
      {tab === 'conversions' && (
        <div className="w-80 space-y-3 p-4">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">Quick Edit</div>
          {conversions.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-md border border-[var(--pane-divider)] p-2">
              <select className="h-7 rounded border border-[var(--pane-divider)] bg-transparent px-1 text-xs" value={c.fromCode} onChange={(e) => updateConversion(c.id, 'fromCode', e.target.value)}>
                <option value="">From…</option>
                {units.map((u) => <option key={u.id} value={u.code}>{u.code}</option>)}
              </select>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <select className="h-7 rounded border border-[var(--pane-divider)] bg-transparent px-1 text-xs" value={c.toCode} onChange={(e) => updateConversion(c.id, 'toCode', e.target.value)}>
                <option value="">To…</option>
                {units.map((u) => <option key={u.id} value={u.code}>{u.code}</option>)}
              </select>
              <Input className="h-7 w-16 text-xs" type="number" step="0.0001" value={c.factor} onChange={(e) => updateConversion(c.id, 'factor', parseFloat(e.target.value) || 0)} />
              <button onClick={() => deleteConversion(c.id)} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-7 w-full gap-1.5 text-xs" onClick={addConversion}>
            <Plus className="h-3 w-3" /> Add Conversion
          </Button>
        </div>
      )}
    </div>
  )
}
