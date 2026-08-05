/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import * as React from 'react'

// ─── Mocks ─────────────────────────────────────────────────────────────────
//
// `useSyncedState` reaches into several modules at module-load time. We mock
// them BEFORE importing the hook so the import doesn't try to hit real env
// vars or initialize a real Supabase client.

// Mock supabase.ts — pretend Supabase IS configured so the hook exercises the
// server-side fetch path (not the localStorage fallback).
vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    channel: () => ({
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      unsubscribe: () => {},
    }),
    removeChannel: () => {},
  },
}))

// Mock the app store — `useSyncedState` reads `activeProjectDbId` to scope
// queries per-project. We return a stable project UUID for the test.
const mockActiveProjectDbId = '00000000-0000-0000-0000-000000000001'
vi.mock('@/lib/app-store', () => ({
  useApp: () => ({ activeProjectDbId: mockActiveProjectDbId }),
}))

// Mock use-persistent-state so we don't actually touch localStorage.
vi.mock('@/lib/use-persistent-state', () => ({
  usePersistentState: (key: string, initial: any) => {
    const [state, setState] = React.useState(typeof initial === 'function' ? initial() : initial)
    return [state, setState]
  },
}))

// Mock api-client's fetchPaginated + invalidateReads. The mock fetches return
// a configurable list of rows + a null nextCursor (single-page dataset).
const mockFetchPaginated = vi.fn()
vi.mock('@/lib/api-client', () => ({
  fetchPaginated: (...args: any[]) => mockFetchPaginated(...args),
  invalidateReads: () => {},
}))

import { useSyncedState } from '@/lib/use-synced-state'

// ─── Test fixtures ─────────────────────────────────────────────────────────

interface TestItem {
  id: string
  description: string
  qty: number
}

const INITIAL: TestItem[] = []

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('useSyncedState hook (integration smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchPaginated.mockResolvedValue({ data: [], nextCursor: null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the initial value before the fetch resolves', async () => {
    // Make fetchPaginated hang so we can observe the pre-fetch state.
    mockFetchPaginated.mockImplementation(
      () => new Promise(() => {}) // never resolves
    )

    const { result } = renderHook(() =>
      useSyncedState<TestItem[]>('test-key', 'boq_items', INITIAL)
    )

    // Initial render: state is the initial value, loading is true (because
    // isSupabaseConfigured() is mocked to return true).
    expect(result.current[0]).toEqual(INITIAL)
    expect(result.current[2]).toBe(true) // loading
  })

  it('fetches data from the API endpoint on mount and returns the transformed rows', async () => {
    const dbRows = [
      { id: '1.1.1', description: 'Excavation', qty: 100 },
      { id: '1.1.2', description: 'Concrete', qty: 50 },
    ]
    mockFetchPaginated.mockResolvedValueOnce({ data: dbRows, nextCursor: null })

    const { result } = renderHook(() =>
      useSyncedState<TestItem[]>('test-key', 'boq_items', INITIAL)
    )

    // Wait for the fetch + setState to settle.
    await waitFor(() => {
      expect(result.current[2]).toBe(false) // loading is done
    })

    // Verify the hook fetched from the right endpoint with the right query.
    expect(mockFetchPaginated).toHaveBeenCalledWith('boq', {
      project_id: mockActiveProjectDbId,
      limit: '200',
    })

    // Verify the rows were set into state.
    expect(result.current[0]).toEqual(dbRows)
    expect(result.current[2]).toBe(false) // loading complete
    expect(result.current[3]).toBe(false) // not truncated
  })

  it('sets truncated=true when MAX_PAGES cap is hit', async () => {
    // Simulate a large dataset where the API always returns 200 rows + a
    // nextCursor, so the hook walks all 10 pages and still has more.
    const fullPage = Array.from({ length: 200 }, (_, i) => ({
      id: `item-${i}`,
      description: `Item ${i}`,
      qty: i,
    }))
    for (let i = 0; i < 11; i++) {
      mockFetchPaginated.mockResolvedValueOnce({
        data: fullPage,
        nextCursor: `cursor-${i}`,
      })
    }

    const { result } = renderHook(() =>
      useSyncedState<TestItem[]>('test-key', 'boq_items', INITIAL)
    )

    await waitFor(() => {
      expect(result.current[2]).toBe(false) // loading done
    })

    // After 10 pages, the hook should have stopped and flagged truncation.
    expect(result.current[3]).toBe(true) // truncated
    expect(mockFetchPaginated).toHaveBeenCalledTimes(10) // exactly MAX_PAGES
  })

  it('falls back to localStorage when the fetch throws', async () => {
    mockFetchPaginated.mockRejectedValueOnce(new Error('Network error'))

    const initial: TestItem[] = [{ id: 'fallback', description: 'Fallback', qty: 1 }]
    const { result } = renderHook(() =>
      useSyncedState<TestItem[]>('test-key', 'boq_items', initial)
    )

    await waitFor(() => {
      expect(result.current[2]).toBe(false) // loading done
    })

    // After the error, state should fall back to the initial/localStorage value.
    expect(result.current[0]).toEqual(initial)
  })

  it('stops paginating when the API returns fewer than 200 rows', async () => {
    const smallPage = [
      { id: '1', description: 'Only item', qty: 1 },
      { id: '2', description: 'Second', qty: 2 },
    ]
    mockFetchPaginated.mockResolvedValueOnce({
      data: smallPage,
      nextCursor: null, // no more pages
    })

    const { result } = renderHook(() =>
      useSyncedState<TestItem[]>('test-key', 'boq_items', INITIAL)
    )

    await waitFor(() => {
      expect(result.current[2]).toBe(false)
    })

    // Should have fetched exactly once — small page, no cursor, exit early.
    expect(mockFetchPaginated).toHaveBeenCalledTimes(1)
    expect(result.current[0]).toEqual(smallPage)
    expect(result.current[3]).toBe(false) // not truncated
  })

  it('stops paginating when nextCursor is null even if rows.length === 200', async () => {
    const fullPage = Array.from({ length: 200 }, (_, i) => ({
      id: `item-${i}`,
      description: `Item ${i}`,
      qty: i,
    }))
    mockFetchPaginated.mockResolvedValueOnce({
      data: fullPage,
      nextCursor: null, // server says no more
    })

    const { result } = renderHook(() =>
      useSyncedState<TestItem[]>('test-key', 'boq_items', INITIAL)
    )

    await waitFor(() => {
      expect(result.current[2]).toBe(false)
    })

    expect(mockFetchPaginated).toHaveBeenCalledTimes(1)
    expect(result.current[3]).toBe(false)
  })
})
