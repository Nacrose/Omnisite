'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Per-module loading fallback shown by `next/dynamic` while the module
 * chunk is being fetched. Shows a skeleton layout (not just a spinner)
 * so the user sees content-shaped placeholders instead of a blank flash.
 */
export function ModuleLoadingFallback({ label }: { label?: string }) {
  return (
    <div className="flex h-full flex-col">
      {/* Header skeleton */}
      <div className="border-border flex h-14 items-center gap-2 border-b px-4">
        <div className="bg-muted h-6 w-6 animate-pulse rounded" />
        <div className="bg-muted h-4 w-32 animate-pulse rounded" />
        <div className="flex-1" />
        <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
        <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
      </div>
      {/* Body skeleton — 3-pane layout */}
      <div className="flex flex-1 gap-px overflow-hidden">
        {/* Left pane */}
        <div className="border-border hidden w-60 flex-col gap-1 border-r p-2 sm:flex">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-muted h-8 animate-pulse rounded"
              style={{ opacity: 1 - i * 0.1 }}
            />
          ))}
        </div>
        {/* Center pane */}
        <div className="flex-1 flex-col gap-2 p-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="border-border/50 bg-muted/50 h-12 animate-pulse rounded border"
              style={{ opacity: 1 - i * 0.08 }}
            />
          ))}
        </div>
        {/* Right pane */}
        <div className="border-border hidden w-80 flex-col gap-3 border-l p-4 lg:flex">
          <div className="bg-muted h-8 w-3/4 animate-pulse rounded" />
          <div className="bg-muted h-4 w-full animate-pulse rounded" />
          <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
          <div className="bg-muted mt-4 h-8 w-full animate-pulse rounded" />
          <div className="bg-muted h-4 w-full animate-pulse rounded" />
          <div className="bg-muted h-4 w-1/2 animate-pulse rounded" />
        </div>
      </div>
    </div>
  )
}

export default ModuleLoadingFallback
