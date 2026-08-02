'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * A drop-in replacement for useState that persists to localStorage.
 * The value is JSON-serialized and saved on every change.
 * On first mount, the stored value is used if available; otherwise the initializer.
 *
 * SSR-safe: returns the initial value on the server, hydrates from localStorage on the client.
 *
 * @param key   localStorage key
 * @param initial  initial value or initializer function (same as useState)
 * @returns [value, setValue] tuple — setValue works exactly like useState's setter
 */
export function usePersistentState<T>(
  key: string,
  initial: T | (() => T)
): [T, (value: T | ((prev: T) => T)) => void] {
  // Lazy initializer: on first render, try to read from localStorage, fall back to `initial`
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return typeof initial === 'function' ? (initial as () => T)() : initial
    }
    try {
      const stored = window.localStorage.getItem(key)
      if (stored !== null) {
        return JSON.parse(stored) as T
      }
    } catch (e) {
      console.warn(`usePersistentState: failed to read "${key}" from localStorage`, e)
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial
  })

  // Write to localStorage whenever state changes — debounced by 500ms so
  // rapid edits (e.g. dragging a column-width handle, typing in a cell)
  // don't thrash the main thread with JSON.stringify + setItem on every
  // keystroke. The latest state is always read from `stateRef.current`
  // when the timer fires, so coalesced updates land as a single write.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(stateRef.current))
      } catch (e) {
        console.warn(`usePersistentState: failed to write "${key}" to localStorage`, e)
      }
    }, 500)
    return () => window.clearTimeout(handle)
  }, [key, state])

  return [state, setState]
}

/**
 * Clear a persistent state key from localStorage.
 * Useful for a "Reset to defaults" action.
 */
export function clearPersistentState(key: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch (e) {
    console.warn(`clearPersistentState: failed to clear "${key}"`, e)
  }
}

/**
 * Clear all OmniSite persistent state keys.
 */
export function clearAllPersistentState() {
  if (typeof window === 'undefined') return
  const keys = [
    'omnisite-boq-data',
    'omnisite-boq-expanded',
    'omnisite-boq-selected',
    'omnisite-scheduler-tasks',
    'omnisite-scheduler-expanded',
    'omnisite-scheduler-selected',
    'omnisite-financials-cbs',
    'omnisite-financials-expanded',
    'omnisite-financials-selected',
    'omnisite-procurement-reqs',
    'omnisite-qs-items',
    'omnisite-recent-modules',
    'omnisite-active-project',
    // Additional keys not in the original list:
    'omnisite-workers',
    'omnisite-equipment',
    'omnisite-chat-channel',
    'omnisite-locale',
    'omnisite-calendar',
    'omnisite-notifications-dispatched',
    'omnisite-audit-queue',
    'omnisite-app-store', // Zustand persisted store
    // NOTE: 'omnisite-demo-bypass' was removed — the demo backdoor is gone.
  ]
  keys.forEach((k) => {
    try {
      window.localStorage.removeItem(k)
    } catch (e) {
      /* ignore */
    }
  })
}

/**
 * Hook to force a re-render after clearing persistent state.
 * Returns a function that clears state and triggers a reload.
 */
export function useResetState() {
  return useCallback(() => {
    clearAllPersistentState()
    // Reload the page to reset all in-memory state
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }, [])
}
