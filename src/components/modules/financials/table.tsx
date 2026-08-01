import React from 'react'
import { cn } from '@/lib/utils'
import { fmt, type CbsNode } from './types'

export type EditingState = { code: string; field: 'committed' | 'actual' | 'forecast' } | null
export type SetEditing = (e: EditingState) => void
export type UpdateNode = (
  code: string,
  field: 'committed' | 'actual' | 'forecast',
  value: number
) => void
export type CbsIsVisible = (key: string) => boolean

export interface CbsTableProps {
  items: CbsNode[]
  depth: number
  expanded: Set<string>
  selectedCode: string
  editing: EditingState
  cbsIsVisible: CbsIsVisible
  onSelectCode: (code: string) => void
  toggleExpand: (code: string) => void
  updateNode: UpdateNode
  setEditing: SetEditing
}

// Renders the CBS P&L grid rows recursively. Leaf nodes get inline-editable
// inputs for committed / actual / forecast; parent rows show read-only
// aggregated totals. Margin is always live-recalculated and color-coded.
export function CbsTable(props: CbsTableProps) {
  const {
    items,
    depth,
    expanded,
    selectedCode,
    editing,
    cbsIsVisible,
    onSelectCode,
    toggleExpand,
    updateNode,
    setEditing,
  } = props

  return (
    <>
      {items.map((c) => {
        const isExpanded = expanded.has(c.code)
        const hasChildren = c.children && c.children.length > 0
        const isSelected = c.code === selectedCode
        const isLeaf = !hasChildren
        return (
          <React.Fragment key={c.code}>
            <div
              onClick={() => onSelectCode(c.code)}
              className={cn(
                'row-hover flex h-9 cursor-pointer items-center border-b border-[var(--pane-divider)] text-xs',
                isSelected && 'bg-accent'
              )}
              style={{ paddingLeft: `${depth * 18 + 8}px` }}
            >
              <div className="w-5">
                {hasChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpand(c.code)
                    }}
                    className="p-0.5"
                  >
                    {isExpanded ? '▾' : '▸'}
                  </button>
                )}
              </div>
              {cbsIsVisible('code') && (
                <div className="text-muted-foreground w-16 font-mono">{c.code}</div>
              )}
              <div className={cn('flex-1 truncate', depth === 0 && 'font-semibold')}>{c.name}</div>
              {cbsIsVisible('budget') && (
                <div className="text-muted-foreground w-24 pr-2 text-right font-mono">
                  {fmt(c.budget)}
                </div>
              )}
              {/* Committed — inline editable for leaf nodes */}
              {cbsIsVisible('committed') && (
                <div className="w-24 pr-2">
                  {isLeaf ? (
                    <input
                      type="number"
                      value={c.committed || ''}
                      onChange={(e) =>
                        updateNode(c.code, 'committed', parseFloat(e.target.value) || 0)
                      }
                      onFocus={() => setEditing({ code: c.code, field: 'committed' })}
                      onBlur={() => setEditing(null)}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'h-6 w-full rounded border bg-transparent px-1.5 text-right font-mono text-xs transition-colors',
                        editing?.code === c.code && editing.field === 'committed'
                          ? 'border-primary bg-background ring-primary/30 ring-1'
                          : 'hover:bg-accent/50 text-muted-foreground border-transparent hover:border-[var(--pane-divider)]'
                      )}
                    />
                  ) : (
                    <span className="text-muted-foreground block text-right font-mono">
                      {fmt(c.committed)}
                    </span>
                  )}
                </div>
              )}
              {/* Actual — inline editable for leaf nodes */}
              {cbsIsVisible('actual') && (
                <div className="w-24 pr-2">
                  {isLeaf ? (
                    <input
                      type="number"
                      value={c.actual || ''}
                      onChange={(e) =>
                        updateNode(c.code, 'actual', parseFloat(e.target.value) || 0)
                      }
                      onFocus={() => setEditing({ code: c.code, field: 'actual' })}
                      onBlur={() => setEditing(null)}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'h-6 w-full rounded border bg-transparent px-1.5 text-right font-mono text-xs transition-colors',
                        editing?.code === c.code && editing.field === 'actual'
                          ? 'border-primary bg-background ring-primary/30 ring-1'
                          : 'hover:bg-accent/50 border-transparent hover:border-[var(--pane-divider)]'
                      )}
                    />
                  ) : (
                    <span className="block text-right font-mono">{fmt(c.actual)}</span>
                  )}
                </div>
              )}
              {/* Forecast — inline editable for leaf nodes */}
              {cbsIsVisible('forecast') && (
                <div className="w-24 pr-2">
                  {isLeaf ? (
                    <input
                      type="number"
                      value={c.forecast || ''}
                      onChange={(e) =>
                        updateNode(c.code, 'forecast', parseFloat(e.target.value) || 0)
                      }
                      onFocus={() => setEditing({ code: c.code, field: 'forecast' })}
                      onBlur={() => setEditing(null)}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'h-6 w-full rounded border bg-transparent px-1.5 text-right font-mono text-xs transition-colors',
                        editing?.code === c.code && editing.field === 'forecast'
                          ? 'border-primary bg-background ring-primary/30 ring-1'
                          : 'hover:bg-accent/50 border-transparent hover:border-[var(--pane-divider)]'
                      )}
                    />
                  ) : (
                    <span className="block text-right font-mono">{fmt(c.forecast)}</span>
                  )}
                </div>
              )}
              {/* Margin — live recalculated, color-coded */}
              {cbsIsVisible('margin') && (
                <div
                  className={cn(
                    'w-20 pr-3 text-right font-mono font-medium tabular-nums',
                    c.marginPct >= 0 ? 'delta-up' : 'delta-down'
                  )}
                >
                  {c.marginPct >= 0 ? '+' : ''}
                  {c.marginPct.toFixed(1)}%
                </div>
              )}
            </div>
            {hasChildren && isExpanded && (
              <CbsTable
                items={c.children!}
                depth={depth + 1}
                expanded={expanded}
                selectedCode={selectedCode}
                editing={editing}
                cbsIsVisible={cbsIsVisible}
                onSelectCode={onSelectCode}
                toggleExpand={toggleExpand}
                updateNode={updateNode}
                setEditing={setEditing}
              />
            )}
          </React.Fragment>
        )
      })}
    </>
  )
}
