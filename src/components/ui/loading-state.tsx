'use client'

import { Loader2 } from 'lucide-react'

/**
 * Loading spinner — shown while useSyncedState fetches data from Supabase.
 * Full-pane overlay so users see a clear loading state instead of a flash
 * of stale/demo content getting swapped for real content.
 */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-3">
      <Loader2 className="text-primary h-6 w-6 animate-spin" />
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
        <div
          key={i}
          className="flex h-9 items-center gap-2 border-b border-[var(--pane-divider)] px-2"
        >
          {Array.from({ length: cols }).map((_, j) => (
            <div
              key={j}
              className="bg-secondary/60 h-4 animate-pulse rounded"
              style={{
                width: j === 0 ? '60px' : j === 1 ? 'flex: 1' : `${60 + (j % 3) * 20}px`,
                flex: j === 1 ? 1 : 'none',
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
