'use client'

import { useState, useMemo, useRef, useEffect, useId } from 'react'
import { MapPin, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSyncedState } from '@/lib/use-synced-state'
import { INITIAL_LOCATIONS } from '@/data/seed/vendors'
import type { ProjectLocation } from '@/lib/types/vendor'

interface LocationPickerProps {
  /** Currently selected location id, or null/undefined for none. */
  value?: string
  /** Fired with the chosen location id (or null when cleared). */
  onChange: (locationId: string | null) => void
  placeholder?: string
  className?: string
  /**
   * When false (default) only active locations are listed. When true, closed
   * locations are included too — useful in admin / historical contexts.
   */
  showAll?: boolean
  /** When true, an extra "— None —" option is rendered at the top to clear the value. */
  allowClear?: boolean
  disabled?: boolean
}

/**
 * Reusable location picker dropdown.
 *
 * Reads the project locations list from the same Supabase `project_locations`
 * table (with localStorage fallback) the Admin → Locations tab writes to
 * (`useSyncedState('omnisite-admin-locations', 'project_locations', …)`),
 * so pickers in other modules always see the same set the admin is editing —
 * no separate sync, and edits in one tab propagate to the others via the
 * realtime channel. The `fieldMap` mirrors the one in the Admin → Locations
 * view so the camelCase app fields round-trip to the snake_case DB columns.
 *
 * Locations are grouped by their `group` field (Bridge Structure, Approach
 * Road, Site Campus, …). Each option shows the location name plus its
 * assigned SC (if any). Keyboard accessible:
 *   - Enter / Space on the trigger opens the panel
 *   - Escape closes without selecting
 *   - Click outside closes (and the previously selected value is kept)
 */
export function LocationPicker({
  value,
  onChange,
  placeholder = 'Select location',
  className,
  showAll = false,
  allowClear = false,
  disabled = false,
}: LocationPickerProps) {
  const [open, setOpen] = useState(false)
  const [locations] = useSyncedState<ProjectLocation[]>(
    'omnisite-admin-locations',
    'project_locations',
    () => INITIAL_LOCATIONS,
    {
      fieldMap: {
        group: 'group_name',
        assignedScId: 'assigned_vendor_id',
        sortOrder: 'sort_order',
      },
      primaryKey: 'id',
    }
  )
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  const filtered = useMemo(
    () => (showAll ? locations : locations.filter((l) => l.status === 'active')),
    [locations, showAll]
  )

  // Group locations by their `group` field, preserving first-seen order so
  // the seed order (Bridge Structure → Approach Road → Site Campus) wins.
  const grouped = useMemo(() => {
    const groups = new Map<string, ProjectLocation[]>()
    for (const loc of filtered) {
      const g = loc.group || 'General'
      const arr = groups.get(g)
      if (arr) arr.push(loc)
      else groups.set(g, [loc])
    }
    return Array.from(groups.entries())
  }, [filtered])

  const selected = locations.find((l) => l.id === value)

  // Close on outside click / Escape. The escape handler is also wired per-key
  // on the trigger button so it fires even when focus hasn't moved.
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleSelect = (loc: ProjectLocation | null) => {
    onChange(loc ? loc.id : null)
    setOpen(false)
    triggerRef.current?.focus()
  }

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={cn(
          'border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full items-center gap-1.5 rounded-md border px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
          !selected && 'text-muted-foreground'
        )}
      >
        <MapPin className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'text-muted-foreground h-3.5 w-3.5 flex-shrink-0 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={listboxId}
          role="listbox"
          aria-label="Project locations"
          className="pane absolute top-full left-0 z-50 mt-1 max-h-72 w-full min-w-[16rem] overflow-y-auto rounded-md border border-[var(--pane-divider)] shadow-xl"
        >
          {allowClear && (
            <button
              type="button"
              role="option"
              aria-selected={value == null}
              onClick={() => handleSelect(null)}
              className={cn(
                'hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs',
                value == null && 'bg-accent/50'
              )}
            >
              <span className="text-muted-foreground">— None —</span>
            </button>
          )}

          {grouped.length === 0 && (
            <div className="text-muted-foreground px-3 py-3 text-center text-xs">
              No locations available.
            </div>
          )}

          {grouped.map(([group, locs]) => (
            <div key={group}>
              <div className="text-muted-foreground/70 bg-secondary/40 px-3 py-1 text-[10px] font-semibold tracking-wider uppercase">
                {group}
              </div>
              {locs.map((loc) => {
                const isSelected = loc.id === value
                return (
                  <button
                    key={loc.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(loc)}
                    className={cn(
                      'hover:bg-accent flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs transition-colors',
                      isSelected && 'bg-accent/60'
                    )}
                  >
                    <MapPin className="text-muted-foreground mt-0.5 h-3 w-3 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{loc.name}</span>
                        {loc.status === 'closed' && (
                          <span className="rounded bg-slate-400/15 px-1 py-px text-[10px] text-slate-600 dark:text-slate-300">
                            closed
                          </span>
                        )}
                      </div>
                      {loc.assignedScId && (
                        <div className="text-muted-foreground truncate text-[10px]">
                          SC: {loc.assignedScId}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="text-primary mt-0.5 h-3 w-3 flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
