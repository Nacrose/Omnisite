'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { confirm } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { Plus, MapPin, X, Trash2, Archive, Save, Link as LinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  useColumnVisibility,
  ColumnToggle,
  StickyTableShell,
  StickyTableHeader,
  StickyTableBody,
  type ColumnDef,
} from '@/components/ui/table-utils'
import type { ProjectLocation, Vendor, LocationStatus } from '@/lib/types/vendor'

// ─── Local helpers ───────────────────────────────────────────────────────────

/** Status → badge styling. Active = emerald, Closed = slate. */
function statusBadgeClass(status: LocationStatus) {
  return status === 'active'
    ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10'
    : 'border-slate-400/40 text-slate-600 dark:text-slate-300 bg-slate-400/10'
}

/**
 * Placeholder Linked-Records counts. Will be wired up when locationId lands
 * on Tasks / DSR / NCR / BOQ entries — for now we render "—" placeholders.
 */
const LINKED_RECORD_TYPES: { key: string; label: string }[] = [
  { key: 'tasks', label: 'Tasks' },
  { key: 'dsr', label: 'DSR Entries' },
  { key: 'ncr', label: 'NCRs' },
  { key: 'boq', label: 'BOQ Items' },
]

// ─── LocationsView (center pane) ─────────────────────────────────────────────

export function LocationsView({
  locations,
  vendors,
  selectedLocation,
  onSelectLocation,
  searchQuery,
  onCreateLocation,
}: {
  locations: ProjectLocation[]
  vendors: Vendor[]
  selectedLocation: ProjectLocation
  onSelectLocation: (l: ProjectLocation) => void
  searchQuery: string
  onCreateLocation: (l: ProjectLocation) => void
}) {
  const [showNewForm, setShowNewForm] = useState(false)

  const q = searchQuery.trim().toLowerCase()
  const filtered = locations.filter(
    (l) => l.name.toLowerCase().includes(q) || l.group.toLowerCase().includes(q)
  )

  // Existing groups — used as <datalist> suggestions in the New Location form
  // and in the inspector.
  const existingGroups = useMemo(
    () =>
      Array.from(new Set(locations.map((l) => l.group)))
        .filter(Boolean)
        .sort(),
    [locations]
  )

  // Subcontractor vendors — populate the Assigned SC dropdown.
  const scVendors = useMemo(() => vendors.filter((v) => v.category === 'subcontractor'), [vendors])

  const COLS: ColumnDef[] = [
    { key: 'name', label: 'Name', hideable: false },
    { key: 'group', label: 'Group' },
    { key: 'status', label: 'Status' },
    { key: 'sc', label: 'Assigned SC' },
  ]
  const { visible, isVisible, toggle } = useColumnVisibility(
    COLS.map((c) => c.key),
    [],
    'admin-locations'
  )

  return (
    <>
      <StickyTableShell minWidth={620}>
        <StickyTableHeader>
          {isVisible('name') && <div className="flex-1 px-2">Name</div>}
          {isVisible('group') && <div className="w-32 px-2">Group</div>}
          {isVisible('status') && <div className="w-24 px-2">Status</div>}
          {isVisible('sc') && <div className="w-44 px-2">Assigned SC</div>}
          <div className="flex-shrink-0 pr-2">
            <ColumnToggle columns={COLS} visible={visible} onToggle={toggle} />
          </div>
        </StickyTableHeader>
        <StickyTableBody>
          {filtered.length === 0 ? (
            <div className="text-muted-foreground px-3 py-8 text-center text-xs">
              {q
                ? `No locations match "${searchQuery}".`
                : 'No locations yet. Click "+ New Location" to create one.'}
            </div>
          ) : (
            filtered.map((l) => (
              <div
                key={l.id}
                onClick={() => onSelectLocation(l)}
                className={cn(
                  'row-hover flex h-10 cursor-pointer items-center border-b border-[var(--pane-divider)] text-xs transition-colors',
                  selectedLocation.id === l.id && 'bg-accent border-l-primary border-l-2'
                )}
              >
                {isVisible('name') && (
                  <div className="flex flex-1 items-center gap-1.5 px-2 font-medium">
                    <MapPin className="text-muted-foreground h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{l.name}</span>
                  </div>
                )}
                {isVisible('group') && (
                  <div className="text-muted-foreground w-32 truncate px-2 text-[11px]">
                    {l.group || '—'}
                  </div>
                )}
                {isVisible('status') && (
                  <div className="w-24 px-2">
                    <Badge
                      variant="outline"
                      className={cn('text-[10px]', statusBadgeClass(l.status))}
                    >
                      {l.status === 'active' ? 'Active' : 'Closed'}
                    </Badge>
                  </div>
                )}
                {isVisible('sc') && (
                  <div className="text-muted-foreground w-44 truncate px-2 text-[11px]">
                    {l.assignedScId
                      ? (scVendors.find((v) => v.id === l.assignedScId)?.name ?? l.assignedScId)
                      : '—'}
                  </div>
                )}
              </div>
            ))
          )}
        </StickyTableBody>
      </StickyTableShell>

      {/* Floating "+ New Location" button — ENABLED per spec */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
        <Button
          size="sm"
          className="pointer-events-auto h-8 gap-1.5 text-xs shadow-lg"
          onClick={() => setShowNewForm(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          New Location
        </Button>
      </div>

      <NewLocationForm
        open={showNewForm}
        existingGroups={existingGroups}
        scVendors={scVendors}
        nextSortOrder={locations.length + 1}
        onClose={() => setShowNewForm(false)}
        onSave={(loc) => {
          onCreateLocation(loc)
          setShowNewForm(false)
          toast.success('Location created', { description: `"${loc.name}" added.` })
        }}
      />
    </>
  )
}

// ─── NewLocationForm (modal) ─────────────────────────────────────────────────

export function NewLocationForm({
  open,
  existingGroups,
  scVendors,
  nextSortOrder,
  onClose,
  onSave,
}: {
  open: boolean
  existingGroups: string[]
  scVendors: Vendor[]
  nextSortOrder: number
  onClose: () => void
  onSave: (loc: ProjectLocation) => void
}) {
  const [name, setName] = useState('')
  const [group, setGroup] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<LocationStatus>('active')
  const [assignedScId, setAssignedScId] = useState<string>('')
  const nameRef = useRef<HTMLInputElement>(null)

  // Reset the form fields whenever the modal opens (false → true transition).
  // This is the React-recommended "adjust state during render when a prop
  // changes" pattern — see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // — preferred over a useEffect that calls setState, which would trigger an
  // extra render cycle.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setName('')
      setGroup('')
      setDescription('')
      setStatus('active')
      setAssignedScId('')
    }
  }

  // Autofocus the name field after the modal opens. The setTimeout is
  // necessary because the AnimatePresence motion.div animates in; without
  // the delay the input isn't focusable yet.
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => nameRef.current?.focus(), 30)
    return () => window.clearTimeout(t)
  }, [open])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const canSave = name.trim().length > 0

  const handleSave = () => {
    if (!canSave) return
    onSave({
      // Generate a stable-ish id. Real impl will use a DB sequence.
      id: `LOC-${Date.now().toString(36).toUpperCase()}`,
      name: name.trim(),
      group: group.trim() || 'Ungrouped',
      description: description.trim() || undefined,
      status,
      assignedScId: assignedScId || undefined,
      sortOrder: nextSortOrder,
    })
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="pane w-full max-w-md overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-10 items-center justify-between border-b border-[var(--pane-divider)] px-3">
              <div className="text-xs font-semibold tracking-wider uppercase">New Location</div>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
              {/* Name (required) */}
              <div>
                <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wider uppercase">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  ref={nameRef}
                  className="h-8 text-xs"
                  placeholder="e.g. Pier 4"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSave) handleSave()
                  }}
                />
              </div>

              {/* Group (dropdown + free-text via datalist) */}
              <div>
                <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wider uppercase">
                  Group
                </label>
                <Input
                  className="h-8 text-xs"
                  placeholder="e.g. Bridge Structure"
                  list="location-groups-list"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                />
                <datalist id="location-groups-list">
                  {existingGroups.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
                {existingGroups.length > 0 && (
                  <div className="text-muted-foreground mt-1 text-[10px]">
                    Existing: {existingGroups.join(' · ')}
                  </div>
                )}
              </div>

              {/* Description (optional) */}
              <div>
                <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wider uppercase">
                  Description
                </label>
                <Textarea
                  className="min-h-16 text-xs"
                  placeholder="Optional — area scope, chainage, notes…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Status */}
              <div className="flex items-center justify-between">
                <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                  Status
                </label>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-[11px]',
                      status === 'active'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground'
                    )}
                  >
                    {status === 'active' ? 'Active' : 'Closed'}
                  </span>
                  <Switch
                    checked={status === 'active'}
                    onCheckedChange={(v) => setStatus(v ? 'active' : 'closed')}
                  />
                </div>
              </div>

              {/* Assigned SC (optional) */}
              <div>
                <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wider uppercase">
                  Assigned SC
                </label>
                <select
                  className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-md border px-2 text-xs outline-none focus-visible:ring-[3px]"
                  value={assignedScId}
                  onChange={(e) => setAssignedScId(e.target.value)}
                >
                  <option value="">— None —</option>
                  {scVendors
                    .filter((v) => v.category === 'subcontractor')
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.id})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--pane-divider)] px-3 py-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={!canSave}
                onClick={handleSave}
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── LocationInspector (right pane) ──────────────────────────────────────────

export function LocationInspector({
  location,
  vendors,
  existingGroups,
  onChange,
  onCloseLocation,
  onDelete,
}: {
  location: ProjectLocation
  vendors: Vendor[]
  existingGroups: string[]
  onChange: (updated: ProjectLocation) => void
  onCloseLocation: (id: string) => void
  onDelete: (id: string) => void
}) {
  const scVendors = vendors.filter((v) => v.category === 'subcontractor')
  const assignedSc = scVendors.find((v) => v.id === location.assignedScId)

  const handleDelete = async () => {
    const ok = await confirm(
      'Delete location?',
      `"${location.name}" will be removed. Linked tasks / DSR / NCR / BOQ entries will lose their location tag — this cannot be undone.`,
      'Delete',
      true
    )
    if (ok) {
      onDelete(location.id)
      toast.success('Location deleted', { description: `"${location.name}" removed.` })
    }
  }

  const handleClose = () => {
    onCloseLocation(location.id)
    toast.success('Location closed', { description: `"${location.name}" is now closed.` })
  }

  return (
    <>
      <PaneHeader title="Location Inspector" />
      <PaneBody className="space-y-3 p-4 text-xs">
        <div>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn('text-[10px]', statusBadgeClass(location.status))}
            >
              {location.status === 'active' ? 'Active' : 'Closed'}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {location.group || 'Ungrouped'}
            </Badge>
          </div>
          <div className="text-muted-foreground mt-2 font-mono text-[10px]">{location.id}</div>
        </div>

        <Separator />

        {/* Editable fields */}
        <div className="space-y-2.5">
          {/* Name */}
          <div>
            <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wider uppercase">
              Name
            </label>
            <Input
              className="h-7 text-xs"
              value={location.name}
              onChange={(e) => onChange({ ...location, name: e.target.value })}
            />
          </div>

          {/* Group */}
          <div>
            <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wider uppercase">
              Group
            </label>
            <Input
              className="h-7 text-xs"
              list="location-groups-inspector"
              value={location.group}
              onChange={(e) => onChange({ ...location, group: e.target.value })}
            />
            <datalist id="location-groups-inspector">
              {existingGroups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>

          {/* Description */}
          <div>
            <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wider uppercase">
              Description
            </label>
            <Textarea
              className="min-h-14 text-xs"
              placeholder="No description yet…"
              value={location.description ?? ''}
              onChange={(e) => onChange({ ...location, description: e.target.value || undefined })}
            />
          </div>

          {/* Status */}
          <div className="flex items-center justify-between rounded border border-[var(--pane-divider)] p-2">
            <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Status
            </span>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-[11px]',
                  location.status === 'active'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground'
                )}
              >
                {location.status === 'active' ? 'Active' : 'Closed'}
              </span>
              <Switch
                checked={location.status === 'active'}
                onCheckedChange={(v) => onChange({ ...location, status: v ? 'active' : 'closed' })}
              />
            </div>
          </div>

          {/* Assigned SC */}
          <div>
            <label className="text-muted-foreground mb-1 block text-[10px] font-semibold tracking-wider uppercase">
              Assigned SC
            </label>
            <select
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-7 w-full rounded-md border px-2 text-xs outline-none focus-visible:ring-[3px]"
              value={location.assignedScId ?? ''}
              onChange={(e) => onChange({ ...location, assignedScId: e.target.value || undefined })}
            >
              <option value="">— None —</option>
              {scVendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.id})
                </option>
              ))}
            </select>
            {assignedSc && (
              <div className="text-muted-foreground mt-1 text-[10px]">{assignedSc.name}</div>
            )}
          </div>
        </div>

        <Separator />

        {/* Linked Records — placeholder counts until locationId is wired into other modules */}
        <div>
          <div className="text-muted-foreground mb-2 flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase">
            <LinkIcon className="h-3 w-3" />
            Linked Records
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {LINKED_RECORD_TYPES.map((t) => (
              <div key={t.key} className="rounded border border-[var(--pane-divider)] p-2">
                <div className="text-muted-foreground text-[10px]">{t.label}</div>
                <div className="text-muted-foreground/60 mt-0.5 text-sm font-semibold">—</div>
              </div>
            ))}
          </div>
          <div className="text-muted-foreground mt-1.5 text-[10px]">
            Counts will populate once locationId is wired into Tasks / DSR / NCR / BOQ.
          </div>
        </div>

        <Separator />

        {/* Actions */}
        <div className="space-y-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-full justify-start gap-2 text-xs"
            disabled={location.status === 'closed'}
            onClick={handleClose}
            title={location.status === 'closed' ? 'Already closed' : 'Set status to Closed'}
          >
            <Archive className="h-3.5 w-3.5" />
            Close Location
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start gap-2 text-xs text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Location
          </Button>
        </div>
      </PaneBody>
    </>
  )
}
