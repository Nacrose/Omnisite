'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * A drop-in replacement for useState that persists to localStorage.
 * The value is JSON-serialized and saved on every change.
 * On first mount, the stored value is used if available; otherwise the initializer.
 *
 * SSR-safe: ALWAYS returns the initial value on the server AND on the
 * first client render. The persisted value is loaded in a useEffect
 * after hydration, which means:
 *   - The server-rendered HTML matches the client's first paint (no
 *     hydration mismatch warning).
 *   - There's a one-frame flash to the initial value before the
 *     persisted data loads. This is the standard tradeoff for SSR +
 *     localStorage.
 *
 * Previously this hook read localStorage synchronously in the useState
 * lazy initializer — which caused a hydration mismatch when modules
 * were server-rendered (ssr: true). The server rendered the initial/
 * default state; the client's first render read localStorage and
 * produced different HTML → React flagged it as a mismatch.
 *
 * @param key   localStorage key
 * @param initial  initial value or initializer function (same as useState)
 * @returns [value, setValue] tuple — setValue works exactly like useState's setter
 */
export function usePersistentState<T>(
  key: string,
  initial: T | (() => T)
): [T, (value: T | ((prev: T) => T)) => void] {
  // Always start with the initial value — server AND client's first render.
  // This ensures the server-rendered HTML matches the client's first paint.
  const computeInitial = (): T => (typeof initial === 'function' ? (initial as () => T)() : initial)
  const [state, setState] = useState<T>(computeInitial)

  // Hydrate from localStorage AFTER the first paint (useEffect runs
  // after hydration). This avoids the hydration mismatch but means
  // there's a one-frame flash to the default value. For most use
  // cases (admin tab selection, chart expanded state, etc.) this is
  // invisible. For data-heavy hooks (chat messages, BOQ data), the
  // parent useSyncedState hook handles its own loading state.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (hydratedRef.current) return // only hydrate once
    hydratedRef.current = true
    try {
      const stored = window.localStorage.getItem(key)
      if (stored !== null) {
        const parsed = JSON.parse(stored) as T
        // Defer setState to avoid cascading renders (react-hooks/set-state-in-effect)
        Promise.resolve().then(() => setState(parsed))
      }
    } catch {
      // localStorage may be unavailable (SSR, privacy mode) — ignore.
    }
  }, [key])

  // Write to localStorage whenever state changes — debounced by 500ms so
  // rapid edits don't thrash the main thread. The latest state is always
  // read from `stateRef.current` when the timer fires.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(stateRef.current))
      } catch {
        // Quota exceeded or localStorage unavailable — ignore.
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
    // New keys added in pass-1 + pass-2 (migrations 28-31 + new modules):
    'omnisite-rfis',
    'omnisite-procurement-mins',
    'omnisite-procurement-stock',
    'omnisite-notifications',
    'omnisite-worker-attendance',
    'omnisite-onboarding-checked',
    'omnisite-reports-layout',
    'omnisite-vendors',
    'omnisite-dsr-entries',
    'omnisite-qs-items',
    'omnisite-drawings',
    'omnisite-letters',
    'omnisite-grns',
    'omnisite-requisitions',
    'omnisite-purchase-orders',
    'omnisite-subcontractors',
    'omnisite-chat-messages',
    'omnisite-project-locations',
    'omnisite-drawing-annotations',
    'omnisite-user-projects',
    // NOTE: 'omnisite-demo-bypass' was removed — the demo backdoor is gone.
  ]
  // Also clear any key that starts with 'omnisite-' (catches keys we
  // might have missed, e.g. per-item RA state like 'omnisite-boq-ra-1.1.1').
  try {
    const allKeys = Object.keys(window.localStorage)
    for (const k of allKeys) {
      if (k.startsWith('omnisite-') && !keys.includes(k)) {
        keys.push(k)
      }
    }
  } catch {
    // localStorage may be unavailable — ignore
  }
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
