'use client'

import { Loader2 } from 'lucide-react'

/**
 * Loading spinner — shown while useSyncedState fetches data from Supabase.
 * Full-pane overlay so users see a clear loading state instead of a flash
 * of stale/demo content getting swapped for real content.
 */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  )
}

/**
 * Skeleton rows — shown in place of table data while loading.
 * Renders `count` shimmering placeholder rows.
 */
export function TableSkeleton({ count = 5, cols = 6 }: { count?: number; cols?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center h-9 border-b border-[var(--pane-divider)] px-2 gap-2">
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="h-4 rounded bg-secondary/60 animate-pulse"
              style={{ width: j === 0 ? '60px' : j === 1 ? 'flex: 1' : `${60 + (j % 3) * 20}px`, flex: j === 1 ? 1 : 'none' }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
