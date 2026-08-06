'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { usePersistentState } from '@/lib/use-persistent-state'

interface ToleranceRule {
  id: string
  ruleType: 'QTY' | 'RATE' | 'AMOUNT'
  fieldName: string
  tolerancePct: number
  toleranceAbsolute: number
  isActive: boolean
}

const SEED_RULES: ToleranceRule[] = [
  { id: 't-1', ruleType: 'QTY', fieldName: 'quantity', tolerancePct: 5.0, toleranceAbsolute: 0, isActive: true },
  { id: 't-2', ruleType: 'RATE', fieldName: 'rate', tolerancePct: 2.0, toleranceAbsolute: 0, isActive: true },
  { id: 't-3', ruleType: 'AMOUNT', fieldName: 'amount', tolerancePct: 3.0, toleranceAbsolute: 0, isActive: true },
]

const TYPE_COLORS: Record<string, string> = {
  QTY: 'border-sky-500/40 text-sky-700 dark:text-sky-300',
  RATE: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
  AMOUNT: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
}

export function ToleranceView() {
  const [rules, setRules] = usePersistentState<ToleranceRule[]>('omnisite-admin-tolerance', () => SEED_RULES)

  const updateRule = (id: string, field: keyof ToleranceRule, value: string | number | boolean) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const addRule = () => {
    setRules((prev) => [...prev, {
      id: `t-${crypto.randomUUID().slice(0, 8)}`,
      ruleType: 'QTY',
      fieldName: '',
      tolerancePct: 0,
      toleranceAbsolute: 0,
      isActive: true,
    }])
    toast.success('Tolerance rule added')
  }

  const deleteRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id))
    toast.success('Rule deleted')
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-wider uppercase">
        Procurement Tolerance Rules
      </div>
      <p className="text-muted-foreground mb-4 text-[11px] leading-relaxed">
        These rules control the 3-way match tolerance. When PO vs GRN vs Invoice variance exceeds
        the threshold, the payment is locked. Values are percentages.
      </p>

      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-md border border-[var(--pane-divider)] p-3">
            <Badge variant="outline" className={TYPE_COLORS[r.ruleType]}>
              {r.ruleType}
            </Badge>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium">{r.fieldName || '—'}</div>
              <div className="text-muted-foreground text-[10px]">
                ±{r.tolerancePct}% {r.toleranceAbsolute > 0 && `or NPR ${r.toleranceAbsolute}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[10px]">
                <span className="text-muted-foreground">%</span>
                <Input className="h-6 w-14 text-xs" type="number" step="0.1" value={r.tolerancePct} onChange={(e) => updateRule(r.id, 'tolerancePct', parseFloat(e.target.value) || 0)} />
              </label>
              <Switch checked={r.isActive} onCheckedChange={(v) => updateRule(r.id, 'isActive', v)} />
              <button onClick={() => deleteRule(r.id)} className="text-muted-foreground hover:text-red-500" title="Delete">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" className="mt-3 h-7 gap-1.5 text-xs" onClick={addRule}>
        <Plus className="h-3 w-3" /> Add Rule
      </Button>

      <div className="mt-4 rounded-md border border-[var(--pane-divider)] bg-secondary/20 p-3 text-[10px]">
        <div className="text-muted-foreground mb-1 font-semibold tracking-wider uppercase">How it works</div>
        <ol className="text-muted-foreground list-decimal space-y-0.5 pl-4 leading-relaxed">
          <li>Procurement checks PO qty vs GRN qty vs Invoice qty</li>
          <li>If variance % exceeds the QTY rule → payment locked</li>
          <li>If rate variance exceeds the RATE rule → payment locked</li>
          <li>If amount variance exceeds the AMOUNT rule → payment locked</li>
          <li>PM can override with a justification (audit-logged)</li>
        </ol>
      </div>
    </div>
  )
}
