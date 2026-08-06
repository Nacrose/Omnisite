'use client'

import { useState, useMemo } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Users, Package, Zap, Settings as SettingsIcon, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { usePersistentState } from '@/lib/use-persistent-state'
import { useSyncedState } from '@/lib/use-synced-state'
import { LoadingState } from '@/components/ui/loading-state'
import {
  MATERIALS,
  ROLES,
  INITIAL_LOCATIONS,
  INITIAL_VENDORS,
  type Cat,
  type Material,
  type Role,
  type ProjectLocation,
} from './admin/types'
import { UsersView, UsersInspector } from './admin/users-tab'
import { MaterialsView, MaterialInspector } from './admin/materials-tab'
import { RatesView, RateInspector } from './admin/rates-tab'
import { PresetsView, PresetInspector } from './admin/presets-tab'
import { LocationsView, LocationInspector } from './admin/locations-tab'
import { LaborView } from './admin/labor-tab'
import { PRESETS } from '@/data/seed/admin'

/**
 * AdminModule — thin shell that owns the active-tab state and routes
 * between the five subfile views (Users / Materials / Rates / Presets /
 * Locations). Each tab's center-pane view + right-pane inspector pair lives
 * in its own file under './admin/'.
 */
export function AdminModule() {
  const [cat, setCat] = useState<Cat>('users')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState<Role>(ROLES[4])
  // Persist materials to localStorage so alt-UOM rate edits survive reloads.
  // Previously this was useState(MATERIALS[0]) — edits to alt-UOM rates
  // were lost on every page refresh.
  const [materialsStore, setMaterialsStore] = usePersistentState<Material[]>(
    'omnisite-admin-materials',
    () => MATERIALS
  )
  const [selectedMaterial, setSelectedMaterial] = useState<Material>(
    materialsStore[0] ?? MATERIALS[0]
  )

  // Locations are a full CRUD surface, so we persist them to localStorage.
  // Synced via /api/project_locations when Supabase is configured; falls back
  // to localStorage (with INITIAL_LOCATIONS as the seed) when not. The fieldMap
  // maps the camelCase ProjectLocation fields to the snake_case columns on
  // the `project_locations` table (migration 00000000000010).
  const [locations, setLocations, locationsLoading] = useSyncedState<ProjectLocation[]>(
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
  const [selectedLocation, setSelectedLocation] = useState<ProjectLocation>(
    () => locations[0] ?? INITIAL_LOCATIONS[0]
  )

  // Existing groups — derived from the live locations array so the inspector
  // and the New Location form stay in sync as edits land.
  const existingGroups = useMemo(
    () =>
      Array.from(new Set(locations.map((l) => l.group)))
        .filter(Boolean)
        .sort(),
    [locations]
  )

  // ── Location mutation helpers ─────────────────────────────────────────
  // All three mutate the persisted array AND keep `selectedLocation` in
  // sync (the inspector is bound to selectedLocation, so without this the
  // inspector wouldn't reflect its own edits).
  const updateLocation = (updated: ProjectLocation) => {
    setLocations((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
    setSelectedLocation((cur) => (cur.id === updated.id ? updated : cur))
  }
  const createLocation = (loc: ProjectLocation) => {
    setLocations((prev) => [...prev, loc])
    setSelectedLocation(loc)
  }
  const closeLocation = (id: string) => {
    setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, status: 'closed' } : l)))
    setSelectedLocation((cur) => (cur.id === id ? { ...cur, status: 'closed' } : cur))
  }
  const deleteLocation = (id: string) => {
    // Compute the remaining list from the current `locations` (closure-captured
    // but fresh at click time), then update both states in one pass.
    const remaining = locations.filter((l) => l.id !== id)
    setLocations(remaining)
    if (selectedLocation.id === id) {
      setSelectedLocation(remaining[0] ?? INITIAL_LOCATIONS[0])
    }
  }

  // Compute counts from the real arrays so badges never lie.
  // NOTE: totalUsers is a DEMO count derived from the seed `users` field on
  // each Role in ROLES. The real per-project user count comes from the
  // `user_projects` query surfaced in the Users tab (see UsersView).
  const totalUsers = ROLES.reduce((s, r) => s + r.users, 0)
  // Each category entry's `count` field drives the sidebar badge. The rates
  // tab is a fixed 3-tier library (Org / Project / RA Preset) — surface that
  // as a label rather than a numeric count so the badge isn't misleading.
  const CATS: { id: Cat; name: string; icon: typeof Users; count: number | string }[] = [
    { id: 'users', name: 'User Management', icon: Users, count: totalUsers },
    { id: 'materials', name: 'Material Master', icon: Package, count: MATERIALS.length },
    { id: 'labor', name: 'Labor Rate Library', icon: Users, count: '10 trades' },
    { id: 'rates', name: '3-Tier Rate Library', icon: Zap, count: '3 tiers' },
    { id: 'presets', name: 'RA Preset Library', icon: SettingsIcon, count: PRESETS.length },
    { id: 'locations', name: 'Work Locations', icon: MapPin, count: locations.length },
  ]
  const activeCatName = CATS.find((c) => c.id === cat)?.name ?? cat
  return (
    <Workspace2Pane
      leftPane={
        <>
          <PaneHeader title="Master Data">
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() =>
                toast.info(
                  `Use the New button in the center pane to create a new ${activeCatName} entry.`
                )
              }
              title="Add entry (use center pane)"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </PaneHeader>
          <PaneBody className="py-2">
            {CATS.map((c) => {
              const Icon = c.icon
              return (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  className={cn(
                    'flex h-9 w-full items-center gap-2.5 px-3 text-xs',
                    cat === c.id
                      ? 'bg-accent border-primary border-l-2'
                      : 'hover:bg-accent/50 border-l-2 border-transparent'
                  )}
                >
                  <Icon className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="flex-1 text-left">{c.name}</span>
                  <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                    {c.count}
                  </Badge>
                </button>
              )
            })}
          </PaneBody>
        </>
      }
      centerPane={
        <>
          <PaneHeader
            title={
              cat === 'users'
                ? 'User Management · PM-Centric'
                : cat === 'materials'
                  ? 'Material Master · Two-tier'
                  : cat === 'rates'
                    ? '3-Tier Rate Library'
                    : cat === 'presets'
                      ? 'RA Preset Library'
                      : 'Work Locations · Project Areas'
            }
          >
            <div className="relative w-40">
              <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                placeholder="Search…"
                className="h-7 pl-7 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {/* The Locations tab owns its own "+ New Location" button inside the
                view (it triggers a modal form), so for that tab the shared
                header New button redirects users to the in-view affordance
                instead of duplicating it. Other tabs surface a "coming soon"
                toast — creation flows for users / materials / rates / presets
                will land alongside their respective API endpoints. */}
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() =>
                cat === 'locations'
                  ? toast.info(
                      'Use the “+ New Location” button in the center pane to create a work location.'
                    )
                  : toast.info(`New ${activeCatName} creation coming soon — use the API for now.`)
              }
              title="New entry"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </PaneHeader>

          {cat === 'users' && (
            <UsersView
              selectedRole={selectedRole}
              onSelectRole={setSelectedRole}
              searchQuery={searchQuery}
            />
          )}
          {cat === 'materials' && (
            <MaterialsView
              selectedMaterial={selectedMaterial}
              onSelectMaterial={setSelectedMaterial}
              searchQuery={searchQuery}
            />
          )}
          {cat === 'rates' && <RatesView />}
          {cat === 'presets' && <PresetsView />}
          {cat === 'labor' && <LaborView />}
          {cat === 'locations' &&
            (locationsLoading ? (
              <div className="flex h-full items-center justify-center">
                <LoadingState label="Loading locations…" />
              </div>
            ) : (
              <LocationsView
                locations={locations}
                vendors={INITIAL_VENDORS}
                selectedLocation={selectedLocation}
                onSelectLocation={setSelectedLocation}
                searchQuery={searchQuery}
                onCreateLocation={createLocation}
              />
            ))}
        </>
      }
      rightPane={
        cat === 'users' ? (
          <UsersInspector role={selectedRole} />
        ) : cat === 'materials' ? (
          <MaterialInspector
            material={selectedMaterial}
            onUpdateAltUomRate={(altIndex, rate) => {
              // Persist alt-UOM rate edits into the selectedMaterial state
              // AND the materialsStore (localStorage) so they survive
              // reloads. Previously the input was uncontrolled, and even
              // after the controlled fix, edits were lost on page refresh.
              setSelectedMaterial((cur) => {
                const updated = cur.altUoms
                  ? {
                      ...cur,
                      altUoms: cur.altUoms.map((alt, i) =>
                        i === altIndex ? { ...alt, rate } : alt
                      ),
                    }
                  : cur
                setMaterialsStore((prev) =>
                  prev.map((m) => (m.code === updated.code ? updated : m))
                )
                return updated
              })
            }}
          />
        ) : cat === 'rates' ? (
          <RateInspector />
        ) : cat === 'presets' ? (
          <PresetInspector />
        ) : cat === 'locations' ? (
          locationsLoading ? (
            <div className="flex h-full items-center justify-center">
              <LoadingState label="Loading locations…" />
            </div>
          ) : (
            <LocationInspector
              location={selectedLocation}
              vendors={INITIAL_VENDORS}
              existingGroups={existingGroups}
              onChange={updateLocation}
              onCloseLocation={closeLocation}
              onDelete={deleteLocation}
            />
          )
        ) : (
          <PresetInspector />
        )
      }
      leftPaneWidth="240px"
      rightPaneWidth="380px"
    />
  )
}
