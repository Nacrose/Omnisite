'use client'

import { useEffect, useMemo, useRef } from 'react'
import { usePresence, type PresenceUser } from '@/lib/use-presence'

/**
 * Cursor position broadcast by a remote user. Always includes the user's
 * display metadata (color, initials) so the consuming component can render
 * a labeled cursor overlay without an extra lookup.
 */
export interface RemoteCursor {
  id: string
  name: string
  initials: string
  color: string
  module: string
  x: number
  y: number
}

export interface UseCursorTrackingResult {
  /** Remote users whose cursor position is currently known (non-null). */
  cursors: RemoteCursor[]
  /** The presence users list (passed through for callers that need it). */
  users: PresenceUser[]
  isConnected: boolean
}

/**
 * Live cursor tracking infrastructure.
 *
 * Wires a single `mousemove` listener on `document` to the throttled
 * `trackCursor` from `usePresence` (50ms throttle is enforced inside
 * `trackCursor`, not here — this hook just forwards every event).
 *
 * Returns the list of remote cursors derived from the presence `users`
 * list — i.e. users whose `cursor` field is non-null. The consuming
 * component (a cursor overlay, typically mounted once at the workspace
 * layout root) is responsible for actually rendering these.
 *
 * Notes:
 * - The throttling is shared with `trackCursor` so we don't have two
 *   independent throttle windows drifting apart. If you change the 50ms
 *   target, change it in `usePresence.trackCursor` as well.
 * - `mousemove` is the only event we listen to. We deliberately don't
 *   clear our cursor on `mouseleave`/`blur` — clearing is handled by the
 *   next `track()` call from `usePresence` (module change, record change)
 *   or by the remote idle-timeout logic if one is added later.
 * - The hook returns the same `users` and `isConnected` it got from
 *   `usePresence` so consumers don't need to call both hooks.
 */
export function useCursorTracking(): UseCursorTrackingResult {
  const { users, isConnected, trackCursor } = usePresence()

  // We capture the latest trackCursor in a ref so the document-level
  // mousemove listener doesn't need to be re-attached on every render
  // (trackCursor is itself useCallback-stable, but this keeps the contract
  // explicit and future-proofs against changes to usePresence).
  const trackCursorRef = useRef(trackCursor)
  useEffect(() => {
    trackCursorRef.current = trackCursor
  }, [trackCursor])

  // Attach ONE mousemove listener for the lifetime of the calling
  // component. We forward every event to trackCursor — the 50ms throttle
  // is enforced inside trackCursor itself.
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      trackCursorRef.current(e.clientX, e.clientY)
    }
    document.addEventListener('mousemove', onMouseMove)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  // Derive the remote cursor list from the presence users list. Memoized
  // so consumers don't re-render unless the underlying users array actually
  // changes (identity-stable thanks to setUsers in usePresence).
  const cursors = useMemo<RemoteCursor[]>(
    () =>
      users
        .filter((u) => u.cursor != null)
        .map((u) => ({
          id: u.id,
          name: u.name,
          initials: u.initials,
          color: u.color,
          module: u.module,
          x: u.cursor!.x,
          y: u.cursor!.y,
        })),
    [users]
  )

  return { cursors, users, isConnected }
}
