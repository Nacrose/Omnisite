'use client'

import { useState } from 'react'
import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import type { BoqItem } from './types'

/**
 * Drag-and-drop state + handlers for the BOQ grid.
 *
 * Extracted from `index.tsx` so the main component body stays focused on
 * state setup and rendering. The hook owns:
 *   - the `draggedItem` / `dragOverHeading` UI state
 *   - the dnd-kit sensors config (PointerSensor with 5px activation)
 *   - the four dnd-kit event handlers, which translate dnd-kit events into
 *     `setDraggedItem` / `setDragOverHeading` updates and a single
 *     `onReparent(draggedId, targetId)` callback when a drag ends.
 *
 * The actual reparenting logic lives in `handlers.ts` — `useBoqDnd` just
 * invokes the caller-supplied `onReparent` callback.
 */
export interface BoqDnd {
  sensors: ReturnType<typeof useSensors>
  draggedItem: BoqItem | null
  dragOverHeading: string | null
  handleDragStart: (e: DragStartEvent) => void
  handleDragOver: (e: { over: { id: string | number } | null }) => void
  handleDragEnd: (e: DragEndEvent) => void
  handleDragCancel: () => void
}

export function useBoqDnd(
  allFlat: BoqItem[],
  onReparent: (draggedId: string, targetHeadingId: string) => void
): BoqDnd {
  const [draggedItem, setDraggedItem] = useState<BoqItem | null>(null)
  const [dragOverHeading, setDragOverHeading] = useState<string | null>(null)

  // DnD sensors — require 5px movement to start drag (prevents accidental
  // drags on click).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const handleDragStart = (e: DragStartEvent) => {
    const item = allFlat.find((i) => i.id === e.active.id)
    setDraggedItem(item || null)
  }

  const handleDragOver = (e: { over: { id: string | number } | null }) => {
    setDragOverHeading(e.over ? String(e.over.id) : null)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    setDraggedItem(null)
    setDragOverHeading(null)
    if (!over) return
    onReparent(String(active.id), String(over.id))
  }

  const handleDragCancel = () => {
    setDraggedItem(null)
    setDragOverHeading(null)
  }

  return {
    sensors,
    draggedItem,
    dragOverHeading,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  }
}
