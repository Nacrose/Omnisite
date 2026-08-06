'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { usePersistentState } from '@/lib/use-persistent-state'
import { LABOR_RATES, type LaborRate } from '@/data/seed/labor'

const CATEGORY_COLORS: Record<string, string> = {
  Skilled: 'border-sky-500/40 text-sky-700 dark:text-sky-300',
  Unskilled: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
  Supervisor: 'border-violet-500/40 text-violet-700 dark:text-violet-300',
}

export function LaborView() {
  const [rates, setRates] = usePersistentState<LaborRate[]>(
    'omnisite-admin-labor',
    () => LABOR_RATES
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const q = searchQuery.toLowerCase()
  const filtered = rates.filter(
    (r) => !q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)
  )

  const selected = rates.find((r) => r.id === selectedId)

  const addNew = () => {
    const newRate: LaborRate = {
      id: `LR-${crypto.randomUUID().slice(0, 8)}`,
      code: '',
      name: '',
      category: 'Skilled',
      uom: 'day',
      rate: 0,
      otRate: 0,
      source: 'Manual',
    }
    setRates((prev) => [...prev, newRate])
    setSelectedId(newRate.id)
  }

  const updateRate = (id: string, field: keyof LaborRate, value: string | number | boolean) => {
    setRates((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const deleteRate = (id: string) => {
    setRates((prev) => prev.filter((r) => r.id !== id))
    if (selectedId === id) setSelectedId(null)
    toast.success('Labor rate deleted')
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col border-r border-[var(--pane-divider)]">
        <div className="border-b border-[var(--pane-divider)] px-3 py-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search by code or name…"
              className="h-8 pl-7 text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((r) => (
            <div
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={cn(
                'flex cursor-pointer items-center gap-3 border-b border-[var(--pane-divider)] px-3 py-2 transition-colors',
                selectedId === r.id ? 'bg-accent' : 'hover:bg-accent/30'
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{r.name || '—'}</span>
                  <Badge
                    variant="outline"
                    className={cn('h-4 px-1 text-[10px]', CATEGORY_COLORS[r.category])}
                  >
                    {r.category}
                  </Badge>
                </div>
                <div className="text-muted-foreground text-[10px]">
                  {r.code} · {r.uom}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-xs font-semibold">NPR {r.rate.toLocaleString()}</div>
                <div className="text-muted-foreground text-[10px]">
                  OT: {r.otRate.toLocaleString()}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-muted-foreground p-8 text-center text-xs">
              No labor rates found.
            </div>
          )}
        </div>
        <div className="border-t border-[var(--pane-divider)] p-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full gap-1.5 text-xs"
            onClick={addNew}
          >
            <Plus className="h-3 w-3" /> Add Labor Rate
          </Button>
        </div>
      </div>

      {selected && (
        <div className="w-80 space-y-3 p-4">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Labor Rate Details
          </div>
          <div>
            <label className="text-[10px] font-medium">Code</label>
            <Input
              className="mt-0.5 h-7 font-mono text-xs"
              value={selected.code}
              onChange={(e) => updateRate(selected.id, 'code', e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-medium">Name</label>
            <Input
              className="mt-0.5 h-7 text-xs"
              value={selected.name}
              onChange={(e) => updateRate(selected.id, 'name', e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-medium">Category</label>
            <select
              className="mt-0.5 h-7 w-full rounded border border-[var(--pane-divider)] bg-transparent px-2 text-xs"
              value={selected.category}
              onChange={(e) => updateRate(selected.id, 'category', e.target.value)}
            >
              <option value="Skilled">Skilled</option>
              <option value="Unskilled">Unskilled</option>
              <option value="Supervisor">Supervisor</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium">Rate (NPR)</label>
              <Input
                className="mt-0.5 h-7 text-xs"
                type="number"
                value={selected.rate}
                onChange={(e) => updateRate(selected.id, 'rate', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="text-[10px] font-medium">OT Rate</label>
              <Input
                className="mt-0.5 h-7 text-xs"
                type="number"
                value={selected.otRate}
                onChange={(e) => updateRate(selected.id, 'otRate', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium">UOM</label>
            <Input
              className="mt-0.5 h-7 text-xs"
              value={selected.uom}
              onChange={(e) => updateRate(selected.id, 'uom', e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-medium">Source</label>
            <Input
              className="mt-0.5 h-7 text-xs"
              value={selected.source}
              onChange={(e) => updateRate(selected.id, 'source', e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full gap-1.5 text-xs text-red-600"
            onClick={() => deleteRate(selected.id)}
          >
            <Trash2 className="h-3 w-3" /> Delete
          </Button>
        </div>
      )}
    </div>
  )
}
