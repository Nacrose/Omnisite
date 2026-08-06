/**
 * Bulk queue store with IndexedDB persistence.
 *
 * Survives page refresh — bulk draft rows are stored in IndexedDB
 * (via idb-keyval) so they persist even if the browser is closed.
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type BulkQueueStatus = 'DRAFT' | 'VALIDATING' | 'PENDING_SYNC' | 'SYNCING' | 'SYNCED' | 'FAILED'

export interface BulkQueueItem {
  id: string
  entityType: string
  payload: Record<string, unknown>
  status: BulkQueueStatus
  attempts: number
  errorMessage?: string
  createdAt: string
}

interface BulkQueueState {
  items: BulkQueueItem[]
  addItem: (item: BulkQueueItem) => void
  updateItem: (id: string, patch: Partial<BulkQueueItem>) => void
  removeItem: (id: string) => void
  clearSynced: () => void
  reset: () => void
}

const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const { get } = await import('idb-keyval')
      const value = await get(name)
      return value ?? null
    } catch {
      return localStorage.getItem(name)
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const { set } = await import('idb-keyval')
      await set(name, value)
    } catch {
      localStorage.setItem(name, value)
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      const { del } = await import('idb-keyval')
      await del(name)
    } catch {
      localStorage.removeItem(name)
    }
  },
}

export const useBulkQueueStore = create<BulkQueueState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) => set((state) => ({ items: [...state.items, item] })),
      updateItem: (id, patch) =>
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        })),
      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
      clearSynced: () =>
        set((state) => ({ items: state.items.filter((item) => item.status !== 'SYNCED') })),
      reset: () => set({ items: [] }),
    }),
    {
      name: 'omnisite-bulk-queue',
      storage: createJSONStorage(() => idbStorage),
    }
  )
)

export function useBulkQueueStats() {
  return useBulkQueueStore((state) => {
    const items = state.items
    return {
      total: items.length,
      draft: items.filter((i) => i.status === 'DRAFT').length,
      pendingSync: items.filter((i) => i.status === 'PENDING_SYNC').length,
      syncing: items.filter((i) => i.status === 'SYNCING').length,
      synced: items.filter((i) => i.status === 'SYNCED').length,
      failed: items.filter((i) => i.status === 'FAILED').length,
    }
  })
}
