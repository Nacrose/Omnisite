'use client'

import { ChevronDown, ChevronRight, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BoqItem } from './types'

export function BoqOutlineTree({ items, selectedId, onSelect, expanded, onToggle, depth = 0 }: {
  items: BoqItem[]; selectedId: string; onSelect: (id: string) => void;
  expanded: Set<string>; onToggle: (id: string) => void; depth?: number;
}) {
  return (
    <div className="text-xs">
      {items.map(item => {
        const isExpanded = expanded.has(item.id)
        const hasChildren = item.children && item.children.length > 0
        const isHeading = item.type === 'Heading'
        return (
          <div key={item.id}>
            <button
              onClick={() => onSelect(item.id)}
              className={cn(
                'w-full flex items-center gap-1.5 h-7 pr-2 rounded transition-colors',
                selectedId === item.id ? 'bg-accent' : 'hover:bg-accent/50'
              )}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {hasChildren ? (
                <span onClick={(e) => { e.stopPropagation(); onToggle(item.id) }} className="cursor-pointer p-0.5">
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </span>
              ) : (
                <span className="w-4" />
              )}
              <span className={cn('font-mono text-muted-foreground text-[10px] w-7', isHeading && 'font-semibold')}>{item.code}</span>
              <span className={cn('truncate flex-1 text-left', isHeading && 'font-semibold')}>{item.desc}</span>
              {item.hasRA && <Lock className="w-2.5 h-2.5 text-emerald-500" />}
            </button>
            {hasChildren && isExpanded && (
              <BoqOutlineTree items={item.children!} selectedId={selectedId} onSelect={onSelect} expanded={expanded} onToggle={onToggle} depth={depth + 1} />
            )}
          </div>
        )
      })}
    </div>
  )
}
