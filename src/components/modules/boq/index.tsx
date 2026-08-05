'use client'

import { Workspace3Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Badge } from '@/components/ui/badge'
import { GripVertical } from 'lucide-react'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { LoadingState } from '@/components/ui/loading-state'
import { StickyTableShell, StickyTableBody } from '@/components/ui/table-utils'
import { toast } from 'sonner'

import { BoqGrid } from './boq-grid'
import { RaInspector, NonPricedInspector } from './ra-inspector'
import { updateItem, type BoqHandlerCtx } from './handlers'
import { AuditLogViewer } from '@/components/modules/audit-log-viewer'
import { useBoqState, BOQ_COLS } from './use-boq-state'
import { BoqToolbar, BoqGridTitle } from './boq-toolbar'
import { BoqGridHeader } from './boq-grid-header'
import { BoqFooter } from './boq-footer'
import { BoqContextMenu } from './boq-context-menu'

/**
 * BOQ & Rate Analysis module.
 *
 * State + derived memoizations + undo/redo + DnD + handler context live in
 * `useBoqState`. The toolbar, grid header, footer, and context menu are
 * extracted into their own components. This component is the layout shell —
 * it composes the pieces into the 3-pane workspace and owns no business
 * logic.
 */
export function BoqModule() {
  const state = useBoqState()
  const {
    boqRows,
    setBoqRows,
    boqLoading,
    boqTruncated,
    loadMoreBoq,
    boqData,
    allFlat,
    selectedId,
    setSelectedId,
    expanded,
    selected,
    editing,
    setEditing,
    searchQuery,
    setSearchQuery,
    contextMenu,
    setContextMenu,
    auditViewer,
    setAuditViewer,
    undoStack,
    redoStack,
    canUndo,
    canRedo,
    boqColVisible,
    boqIsVisible,
    boqToggleCol,
    colWidths,
    colStartDrag,
    filteredBoqData,
    searchExpandedSet,
    selectedLeaf,
    contractTotal,
    ctx,
    undoFn,
    redoFn,
    dnd,
    toggleExpand,
    handleToggleSelect,
    activeProject,
  } = state

  if (boqLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingState label="Loading BOQ items…" />
      </div>
    )
  }

  // Guard against an empty BOQ store (e.g. fresh install with no seed data,
  // or all items deleted). Placed AFTER all hooks have been called so we
  // don't violate rules-of-hooks.
  if (!selectedLeaf) {
    return (
      <Workspace3Pane
        centerPane={
          <PaneBody className="text-muted-foreground flex items-center justify-center text-sm">
            No items to display
          </PaneBody>
        }
        rightPane={
          <PaneBody className="text-muted-foreground flex items-center justify-center text-sm">
            No items to display
          </PaneBody>
        }
        rightPaneWidth="380px"
      />
    )
  }

  return (
    <>
      <Workspace3Pane
        centerPane={
          <>
            <PaneHeader title={BoqGridTitle({ selectedCount: selected.size, activeProject })}>
              <BoqToolbar
                activeProject={activeProject}
                selectedCount={selected.size}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                boqTruncated={boqTruncated}
                onLoadMore={async () => {
                  try {
                    await loadMoreBoq()
                    toast.success('Loaded next page')
                  } catch {
                    toast.error('Failed to load more rows')
                  }
                }}
                canUndo={canUndo}
                canRedo={canRedo}
                undoCount={undoStack.length}
                redoCount={redoStack.length}
                onUndo={undoFn}
                onRedo={redoFn}
                selectedLeaf={selectedLeaf}
                boqData={boqData}
                ctx={ctx}
              />
            </PaneHeader>
            <StickyTableShell minWidth={1000}>
              <BoqGridHeader
                columns={BOQ_COLS}
                visible={boqColVisible}
                isVisible={boqIsVisible}
                onToggleCol={boqToggleCol}
                widths={colWidths}
                onResizeStart={colStartDrag}
              />
              <StickyTableBody>
                <DndContext
                  sensors={dnd.sensors}
                  collisionDetection={closestCenter}
                  onDragStart={dnd.handleDragStart}
                  onDragOver={dnd.handleDragOver}
                  onDragEnd={dnd.handleDragEnd}
                  onDragCancel={dnd.handleDragCancel}
                >
                  <BoqGrid
                    items={filteredBoqData}
                    expanded={searchExpandedSet}
                    selectedId={selectedId}
                    selected={selected}
                    editing={editing}
                    draggedItem={dnd.draggedItem}
                    dragOverHeading={dnd.dragOverHeading}
                    onSelectId={setSelectedId}
                    onContextMenu={setContextMenu}
                    onToggleExpand={toggleExpand}
                    onToggleSelect={handleToggleSelect}
                    onUpdateItem={(id, field, value, skipUndo) =>
                      updateItem(id, field, value, ctx, skipUndo)
                    }
                    onSetEditing={setEditing}
                    isVisible={boqIsVisible}
                    colWidths={colWidths}
                  />
                  <DragOverlay>
                    {dnd.draggedItem ? (
                      <div className="pane border-primary flex h-9 items-center gap-2 rounded-md border px-4 text-xs shadow-lg">
                        <GripVertical className="text-primary h-3 w-3" />
                        <span className="text-muted-foreground font-mono">
                          {dnd.draggedItem.code}
                        </span>
                        <span className="truncate font-medium">{dnd.draggedItem.desc}</span>
                        <Badge variant="secondary" className="ml-2 text-[9px]">
                          {dnd.draggedItem.type}
                        </Badge>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </StickyTableBody>
            </StickyTableShell>
            <BoqFooter allFlat={allFlat} contractTotal={contractTotal} />
          </>
        }
        rightPane={
          selectedLeaf.type === 'Priced' ? (
            // key={item.id} forces RaInspector to remount when the selected
            // BOQ item changes, so its internal coefficient/row state resets
            // instead of leaking from the previous item.
            <RaInspector
              key={selectedLeaf.id}
              item={selectedLeaf}
              onUpdateLocation={(locId) => {
                // Propagate the location link into the synced boqRows store
                // so it persists to Supabase (location_id column added in
                // migration 12) and is visible to other modules.
                setBoqRows((prev) =>
                  prev.map((r) =>
                    r.id === selectedLeaf.id ? { ...r, locationId: locId ?? undefined } : r
                  )
                )
              }}
            />
          ) : (
            <NonPricedInspector key={selectedLeaf.id} item={selectedLeaf} />
          )
        }
        rightPaneWidth="380px"
      />

      {/* Context Menu */}
      {contextMenu && (
        <BoqContextMenu
          menu={contextMenu}
          allFlat={allFlat}
          ctx={ctx}
          onSelectId={setSelectedId}
          onSetEditing={(id, field) => setEditing({ id, field })}
          onOpenAudit={(recordId, label) => setAuditViewer({ recordId, label })}
          onClose={() => setContextMenu(null)}
        />
      )}

      {auditViewer && (
        <AuditLogViewer
          tableName="boq_items"
          recordId={auditViewer.recordId}
          recordLabel={auditViewer.label}
          onClose={() => setAuditViewer(null)}
        />
      )}
    </>
  )
}

export default BoqModule
