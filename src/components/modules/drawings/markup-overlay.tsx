'use client'

/**
 * MarkupOverlay — Fabric.js canvas positioned on top of the PDF page.
 *
 * Provides a toolbar with markup tools (freehand draw, rectangle, circle,
 * arrow, text, stamp), a color picker, stroke-width selector, undo/redo,
 * clear all, and save.
 *
 * The overlay is sized to match the PDF canvas (passed in via `width` and
 * `height` props from the parent PdfViewer's onCanvasReady callback). When
 * the parent PDF zoom changes, the parent re-renders the PDF and notifies
 * this overlay with the new dimensions — this overlay then resizes its
 * Fabric.js canvas (Fabric.js handles re-scaling the existing objects via
 * `setDimensions`).
 *
 * On "Save", the parent calls `serialize()` via the imperative handle to
 * get the current Fabric.js objects as JSON, then maps them into
 * `DrawingAnnotation` rows keyed by drawingId + pageNumber.
 *
 * On load, the parent passes existing annotations via `annotations` and
 * this overlay deserializes each annotation's `fabricData` onto the canvas.
 *
 * Fabric.js v7 ships its own types (the @types/fabric package was for v5
 * and is incompatible). We import as a namespace and cast a few internal
 * fields to `any` where the v7 types are trickier than the runtime API.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as fabric from 'fabric'
import { Button } from '@/components/ui/button'
import {
  Pencil,
  Square,
  Circle as CircleIcon,
  Type,
  Stamp,
  ArrowRight,
  Undo2,
  Redo2,
  Trash2,
  Save,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AnnotationType, DrawingAnnotation, StampType } from './types'
// Re-export the toolbar + shared constants for backwards compat.
export { MarkupToolbar } from './markup-toolbar'
// Import STAMPS for use in the stamp-creation logic below.
import { STAMPS } from './markup-toolbar'

interface Point {
  x: number
  y: number
}

export interface MarkupOverlayHandle {
  /** Serialize current canvas objects to a DrawingAnnotation[]. */
  serialize: () => SerializedAnnotation[]
  /** Replace the canvas contents with the given annotations. */
  load: (annotations: DrawingAnnotation[]) => void
  /** Clear all objects from the canvas. */
  clear: () => void
}

interface SerializedAnnotation {
  /** Fabric.js serialized object (full object graph). */
  fabricData: unknown
  /** Inferred annotation type (freehand/rectangle/...). */
  type: AnnotationType
  /** Bounding box (canvas pixels). */
  x: number
  y: number
  width?: number
  height?: number
  /** Text content for text/stamp annotations. */
  textContent?: string
  /** Stroke color of the object. */
  color: string
  /** Stroke width. */
  strokeWidth: number
}

interface MarkupOverlayProps {
  /** CSS pixel width of the PDF page (drives Fabric.js canvas size). */
  width: number
  /** CSS pixel height of the PDF page. */
  height: number
  /** Currently selected tool. */
  activeTool: AnnotationType | 'select'
  /** Currently selected color. */
  color: string
  /** Currently selected stroke width. */
  strokeWidth: number
  /** Stamp type to drop on the next click (when activeTool === 'stamp'). */
  activeStamp?: StampType
  /** Author info for new annotations (set by the parent from useAuth). */
  authorId: string
  authorName: string
  /** Drawing + page identifiers for new annotations. */
  drawingId: string
  pageNumber: number
  /** Existing annotations to load (called once on mount via the handle). */
  annotations?: DrawingAnnotation[]
  /** Fired when the user clicks Save — parent persists the annotations. */
  onSave: (annotations: DrawingAnnotation[]) => void
  /** Fired when the canvas state changes (for the dirty indicator). */
  onDirtyChange?: (dirty: boolean) => void
}

export const MarkupOverlay = forwardRef<MarkupOverlayHandle, MarkupOverlayProps>(
  function MarkupOverlay(props, ref) {
    const {
      width,
      height,
      activeTool,
      color,
      strokeWidth,
      activeStamp,
      authorId,
      authorName,
      drawingId,
      pageNumber,
      onSave,
      onDirtyChange,
    } = props

    const canvasElRef = useRef<HTMLCanvasElement>(null)
    const fabricRef = useRef<fabric.Canvas | null>(null)
    const isDrawingRef = useRef(false)
    const startPosRef = useRef<Point | null>(null)
    const activeShapeRef = useRef<fabric.FabricObject | null>(null)
    // History stacks for undo/redo. We store serialized Fabric.js snapshots
    // (state objects) — simpler than tracking each object individually.
    const undoStackRef = useRef<unknown[]>([])
    const redoStackRef = useRef<unknown[]>([])
    const lastSnapshotRef = useRef<unknown>(null)
    const dirtyRef = useRef(false)

    const [mounted, setMounted] = useState(false)

    // ─── Initialize Fabric.js canvas on mount ─────────────────────────────
    useEffect(() => {
      if (!canvasElRef.current) return

      // Fabric v7 — Canvas is the interactive editor canvas.
      const canvas = new fabric.Canvas(canvasElRef.current, {
        backgroundColor: 'transparent',
        selection: false, // we handle tool-based selection manually
        preserveObjectStacking: true,
      })
      fabricRef.current = canvas
      setMounted(true)

      // Capture initial snapshot for undo baseline.
      const initialSnap = canvas.toJSON()
      lastSnapshotRef.current = initialSnap

      // Object added/modified → mark dirty + push undo snapshot.
      const pushSnapshot = () => {
        if (lastSnapshotRef.current !== null) {
          undoStackRef.current.push(lastSnapshotRef.current)
        }
        // Cap undo history at 50 entries (memory bound).
        if (undoStackRef.current.length > 50) {
          undoStackRef.current.shift()
        }
        redoStackRef.current = []
        lastSnapshotRef.current = canvas.toJSON()
        if (!dirtyRef.current) {
          dirtyRef.current = true
          onDirtyChange?.(true)
        }
      }

      canvas.on('object:added', pushSnapshot)
      canvas.on('object:modified', pushSnapshot)
      canvas.on('object:removed', pushSnapshot)

      return () => {
        canvas.dispose()
        fabricRef.current = null
      }
      // INTENTIONAL dep exclusion: this is a mount-once effect that
      // initializes the Fabric.js canvas. All dynamic props (tool, color,
      // strokeWidth) are read via the refs updated by the subsequent
      // effects below, so the canvas picks up changes without re-init.
      // Re-running this on every prop change would destroy and recreate
      // the canvas, discarding all user drawings.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ─── Resize Fabric.js canvas when PDF page dimensions change ──────────
    useEffect(() => {
      const canvas = fabricRef.current
      if (!canvas || width === 0 || height === 0) return
      canvas.setDimensions({ width, height })
      canvas.renderAll()
    }, [width, height])

    // ─── Apply tool changes ───────────────────────────────────────────────
    useEffect(() => {
      const canvas = fabricRef.current
      if (!canvas) return

      // Freehand uses Fabric's built-in drawing mode.
      if (activeTool === 'freehand') {
        canvas.isDrawingMode = true
        const brush = canvas.freeDrawingBrush
        if (brush) {
          brush.color = color
          brush.width = strokeWidth
        }
      } else {
        canvas.isDrawingMode = false
      }

      // In 'select' mode, allow object selection; otherwise disable so the
      // drawing tools don't fight with Fabric's selection box.
      canvas.selection = activeTool === 'select'
      canvas.defaultCursor = activeTool === 'select' ? 'default' : 'crosshair'
    }, [activeTool, color, strokeWidth])

    // ─── Mouse handlers for shape tools (rect, circle, arrow, text, stamp) ─
    // Fabric v7 event payloads use `scenePoint` (canvas-space coordinates)
    // and `viewportPoint` (screen-space). We use scenePoint throughout so the
    // shapes are placed in canvas pixel space — same coordinate system as the
    // Fabric.js objects themselves.
    useEffect(() => {
      const canvas = fabricRef.current
      if (!canvas) return

      const onMouseDown = (opt: { scenePoint: Point }) => {
        if (activeTool === 'select' || activeTool === 'freehand') return
        const pointer = opt.scenePoint
        isDrawingRef.current = true
        startPosRef.current = { x: pointer.x, y: pointer.y }

        if (activeTool === 'text') {
          // Prompt for text content. (We use a simple prompt here — the
          // toolbar already shows a text tool button; production UI would
          // use a popover input. Keeping it simple per the spec.)
          const text = window.prompt('Annotation text:')
          if (text && text.trim()) {
            const textObj = new fabric.FabricText(text.trim(), {
              left: pointer.x,
              top: pointer.y,
              fill: color,
              fontSize: 16,
              fontFamily: 'Inter, system-ui, sans-serif',
              fontWeight: 'bold',
            })
            canvas.add(textObj)
            canvas.setActiveObject(textObj)
          }
          isDrawingRef.current = false
          startPosRef.current = null
          return
        }

        if (activeTool === 'stamp') {
          // Drop a stamp label at the click position.
          const stampDef = STAMPS.find((s) => s.type === activeStamp) ?? STAMPS[0]
          const stampText = new fabric.FabricText(stampDef.label, {
            left: pointer.x,
            top: pointer.y,
            fill: stampDef.color,
            fontSize: 18,
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: 'bold',
            backgroundColor: stampDef.bg,
            padding: 6,
            originX: 'left',
            originY: 'top',
          })
          // The stamp is stored with a custom property so serialize() can
          // infer 'stamp' rather than 'text'.
          ;(stampText as fabric.FabricObject & { stampType?: StampType }).stampType = stampDef.type
          canvas.add(stampText)
          canvas.setActiveObject(stampText)
          isDrawingRef.current = false
          startPosRef.current = null
          return
        }

        // Rect / circle / arrow — create the placeholder shape, mutate it
        // on mouse:move, and commit on mouse:up.
        let shape: fabric.FabricObject | null = null
        if (activeTool === 'rectangle') {
          shape = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 1,
            height: 1,
            fill: 'transparent',
            stroke: color,
            strokeWidth,
          })
        } else if (activeTool === 'circle') {
          shape = new fabric.Circle({
            left: pointer.x,
            top: pointer.y,
            radius: 1,
            fill: 'transparent',
            stroke: color,
            strokeWidth,
            originX: 'left',
            originY: 'top',
          })
        } else if (activeTool === 'arrow') {
          // Arrow = a Line with arrowhead. We use a Polyline so the
          // arrowhead is part of the same object.
          // We'll mutate points on mouse:move.
          const points = [
            { x: pointer.x, y: pointer.y },
            { x: pointer.x, y: pointer.y },
          ]
          shape = new fabric.Polyline(points, {
            fill: 'transparent',
            stroke: color,
            strokeWidth,
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
          })
        }

        if (shape) {
          activeShapeRef.current = shape
          canvas.add(shape)
        }
      }

      const onMouseMove = (opt: { scenePoint: Point }) => {
        if (!isDrawingRef.current || !startPosRef.current) return
        const start = startPosRef.current
        const pointer = opt.scenePoint
        const shape = activeShapeRef.current
        if (!shape) return

        if (activeTool === 'rectangle') {
          const w = Math.abs(pointer.x - start.x)
          const h = Math.abs(pointer.y - start.y)
          const left = Math.min(start.x, pointer.x)
          const top = Math.min(start.y, pointer.y)
          shape.set({ left, top, width: w, height: h })
        } else if (activeTool === 'circle') {
          // Use distance from start as radius.
          const dx = pointer.x - start.x
          const dy = pointer.y - start.y
          const r = Math.sqrt(dx * dx + dy * dy)
          shape.set({ radius: r })
        } else if (activeTool === 'arrow' && shape instanceof fabric.Polyline) {
          // Update the end point. The points array is mutable on Polyline.
          const pts = shape.points
          if (pts && pts.length >= 2) {
            pts[1] = new fabric.Point(pointer.x, pointer.y)
            shape.set({ points: pts })
            // Re-compute the bounding box so the object dimensions update.
            shape.setCoords()
          }
        }
        canvas.requestRenderAll()
      }

      const onMouseUp = () => {
        if (!isDrawingRef.current) return
        isDrawingRef.current = false
        startPosRef.current = null
        activeShapeRef.current = null
      }

      canvas.on('mouse:down', onMouseDown)
      canvas.on('mouse:move', onMouseMove)
      canvas.on('mouse:up', onMouseUp)

      return () => {
        canvas.off('mouse:down', onMouseDown)
        canvas.off('mouse:move', onMouseMove)
        canvas.off('mouse:up', onMouseUp)
      }
    }, [activeTool, color, strokeWidth, activeStamp])

    // ─── Imperative handle: serialize / load / clear ──────────────────────
    const serialize = useCallback((): SerializedAnnotation[] => {
      const canvas = fabricRef.current
      if (!canvas) return []
      const objects = canvas.getObjects()
      return objects.map((obj) => {
        // Infer type from the Fabric.js class.
        let type: AnnotationType = 'freehand'
        if (obj instanceof fabric.Rect) type = 'rectangle'
        else if (obj instanceof fabric.Circle) type = 'circle'
        else if (obj instanceof fabric.Polyline) type = 'arrow'
        else if (obj instanceof fabric.FabricText) {
          // Stamps are FabricText with a stampType custom property.
          const stampType = (obj as fabric.FabricObject & { stampType?: StampType }).stampType
          type = stampType ? 'stamp' : 'text'
        } else if (obj instanceof fabric.Path) {
          type = 'freehand'
        }

        const bound = obj.getBoundingRect()
        const textContent = obj instanceof fabric.FabricText ? (obj.text ?? undefined) : undefined

        // Serialize the object as a plain JSON object (full object graph).
        // `toObject()` returns the serializable representation; we wrap it
        // so deserialize() can pass it to fabric.util.enlivenObjects().
        const fabricData = obj.toObject(['stampType', 'selectable', 'evented'])

        // Stroke is `string | TFiller | null` — only string is a usable
        // color value for the annotation row's `color` column.
        const rawStroke = obj.stroke
        const colorStr = typeof rawStroke === 'string' ? rawStroke : ''
        const rawFill = obj.fill
        const fillStr = typeof rawFill === 'string' ? rawFill : ''

        return {
          fabricData,
          type,
          x: bound.left,
          y: bound.top,
          width: bound.width,
          height: bound.height,
          textContent,
          color: colorStr || fillStr || color,
          strokeWidth: (obj.strokeWidth as number) ?? strokeWidth,
        }
      })
    }, [color, strokeWidth])

    const load = useCallback(
      (annotations: DrawingAnnotation[]) => {
        const canvas = fabricRef.current
        if (!canvas) return
        // Clear current objects (without firing pushSnapshot — we're loading).
        canvas.clear()
        canvas.backgroundColor = 'transparent'
        dirtyRef.current = false
        onDirtyChange?.(false)

        // Re-create each annotation's Fabric.js object from its fabricData.
        // fabric.util.enlivenObjects takes an array of plain objects and
        // returns a Promise that resolves with the live Fabric instances.
        const objectsData = annotations.map((a) => a.fabricData)
        if (objectsData.length === 0) {
          canvas.renderAll()
          lastSnapshotRef.current = canvas.toJSON()
          return
        }
        // Cast: fabric.util.enlivenObjects is well-typed in v7 but the
        // generic signature is finicky with `unknown[]` input.
        const util = (
          fabric as unknown as {
            util: {
              enlivenObjects: (
                objects: unknown[],
                callback?: (objs: fabric.FabricObject[]) => void,
                namespace?: string
              ) => Promise<fabric.FabricObject[]>
            }
          }
        ).util
        util
          .enlivenObjects(objectsData)
          .then((objs: fabric.FabricObject[]) => {
            for (const obj of objs) {
              canvas.add(obj)
            }
            canvas.renderAll()
            lastSnapshotRef.current = canvas.toJSON()
          })
          .catch((err: unknown) => {
            // eslint-disable-next-line no-console
            console.warn('[MarkupOverlay] Failed to enliven annotation objects:', err)
          })
      },
      [onDirtyChange]
    )

    const clear = useCallback(() => {
      const canvas = fabricRef.current
      if (!canvas) return
      canvas.clear()
      canvas.backgroundColor = 'transparent'
      canvas.renderAll()
      dirtyRef.current = false
      onDirtyChange?.(false)
      lastSnapshotRef.current = canvas.toJSON()
      undoStackRef.current = []
      redoStackRef.current = []
    }, [onDirtyChange])

    useImperativeHandle(
      ref,
      () => ({
        serialize,
        load,
        clear,
      }),
      [serialize, load, clear]
    )

    // ─── Undo / Redo ──────────────────────────────────────────────────────
    const undo = useCallback(() => {
      const canvas = fabricRef.current
      if (!canvas || undoStackRef.current.length === 0) return
      const prev = undoStackRef.current.pop()
      if (prev === undefined) return
      // Push the current state onto the redo stack before reverting.
      redoStackRef.current.push(canvas.toJSON())
      // loadFromJSON returns a Promise; cast because the v7 type signature
      // is stricter than the runtime API.
      const c = canvas as unknown as {
        loadFromJSON: (json: unknown) => Promise<void>
      }
      c.loadFromJSON(prev).then(() => {
        canvas.renderAll()
        lastSnapshotRef.current = canvas.toJSON()
      })
    }, [])

    const redo = useCallback(() => {
      const canvas = fabricRef.current
      if (!canvas || redoStackRef.current.length === 0) return
      const next = redoStackRef.current.pop()
      if (next === undefined) return
      undoStackRef.current.push(canvas.toJSON())
      const c = canvas as unknown as {
        loadFromJSON: (json: unknown) => Promise<void>
      }
      c.loadFromJSON(next).then(() => {
        canvas.renderAll()
        lastSnapshotRef.current = canvas.toJSON()
      })
    }, [])

    // ─── Save handler ─────────────────────────────────────────────────────
    const handleSave = useCallback(() => {
      const serialized = serialize()
      const now = new Date().toISOString()
      const annotations: DrawingAnnotation[] = serialized.map((s, idx) => ({
        id: `${drawingId}-p${pageNumber}-${Date.now()}-${idx}`,
        drawingId,
        pageNumber,
        authorId,
        authorName,
        type: s.type,
        color: s.color,
        strokeWidth: s.strokeWidth,
        fabricData: s.fabricData,
        textContent: s.textContent,
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
        createdAt: now,
        updatedAt: now,
      }))
      onSave(annotations)
      dirtyRef.current = false
      onDirtyChange?.(false)
    }, [serialize, drawingId, pageNumber, authorId, authorName, onSave, onDirtyChange])

    // ─── Render ───────────────────────────────────────────────────────────
    // The canvas is positioned absolutely over the PDF. The toolbar floats
    // above the canvas at the top.
    return (
      <>
        {/* Fabric.js canvas — sized by setDimensions() to match the PDF. */}
        <canvas
          ref={canvasElRef}
          className="absolute inset-0 z-10"
          style={{ pointerEvents: activeTool === 'select' ? 'auto' : 'auto' }}
        />

        {/* Floating toolbar — Save / Undo / Redo / Clear. The tool picker
            itself is rendered by the parent so it stays in the right pane
            on mobile. */}
        {mounted && (
          <div className="absolute top-2 right-2 z-20 flex gap-1">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 w-7 p-0"
              onClick={undo}
              title="Undo"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 w-7 p-0"
              onClick={redo}
              title="Redo"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 w-7 p-0"
              onClick={clear}
              title="Clear all"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="default"
              className="h-7 gap-1 px-2 text-[10px]"
              onClick={handleSave}
              title="Save annotations"
            >
              <Save className="h-3 w-3" />
              Save
            </Button>
          </div>
        )}
      </>
    )
  }
)
