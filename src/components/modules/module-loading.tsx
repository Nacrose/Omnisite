'use client'

import { LoadingState } from '@/components/ui/loading-state'

/**
 * Per-module loading fallback shown by `next/dynamic` while the module
 * chunk is being fetched. Centered full-pane spinner so users see a clear
 * loading state instead of a blank flash.
 */
export function ModuleLoadingFallback({ label }: { label?: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <LoadingState label={label ?? 'Loading module…'} />
    </div>
  )
}

export default ModuleLoadingFallback
