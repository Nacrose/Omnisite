'use client'

import { useState } from 'react'
import { Workspace2Pane, PaneHeader, PaneBody } from '@/components/workspace-3pane'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Users, Package, FileText, Zap, Settings as SettingsIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  MATERIALS,
  VENDORS,
  ROLES,
  type Cat,
  type Material,
  type Vendor,
  type Role,
} from './admin/types'
import { UsersView, UsersInspector } from './admin/users-tab'
import { MaterialsView, MaterialInspector } from './admin/materials-tab'
import { VendorsView, VendorInspector } from './admin/vendors-tab'
import { RatesView, RateInspector } from './admin/rates-tab'
import { PresetsView, PresetInspector } from './admin/presets-tab'
import { PRESETS } from '@/data/seed/admin'

/**
 * AdminModule — thin shell that owns the active-tab state and routes
 * between the five subfile views (Users / Materials / Vendors / Rates /
 * Presets). Each tab's center-pane view + right-pane inspector pair lives
 * in its own file under './admin/'.
 */
export function AdminModule() {
  const [cat, setCat] = useState<Cat>('users')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRole, setSelectedRole] = useState<Role>(ROLES[4])
  const [selectedMaterial, setSelectedMaterial] = useState<Material>(MATERIALS[0])
  const [selectedVendor, setSelectedVendor] = useState<Vendor>(VENDORS[0])
  // Compute counts from the real arrays so badges never lie.
  const totalUsers = ROLES.reduce((s, r) => s + r.users, 0)
  const CATS: { id: Cat; name: string; icon: typeof Users; count: number }[] = [
    { id: 'users', name: 'User Management', icon: Users, count: totalUsers },
    { id: 'materials', name: 'Material Master', icon: Package, count: MATERIALS.length },
    { id: 'vendors', name: 'Vendor Master', icon: FileText, count: VENDORS.length },
    { id: 'rates', name: '3-Tier Rate Library', icon: Zap, count: 3 },
    { id: 'presets', name: 'RA Preset Library', icon: SettingsIcon, count: PRESETS.length },
  ]
  return (
    <Workspace2Pane
      leftPane={
        <>
          <PaneHeader title="Master Data">
            <Button variant="ghost" size="sm" className="h-7" disabled title="Coming soon">
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
                  : cat === 'vendors'
                    ? 'Vendor Master · AVL'
                    : cat === 'rates'
                      ? '3-Tier Rate Library'
                      : 'RA Preset Library'
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
            <Button size="sm" className="h-7 gap-1.5 text-xs" disabled title="Coming soon">
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
          {cat === 'vendors' && (
            <VendorsView
              selectedVendor={selectedVendor}
              onSelectVendor={setSelectedVendor}
              searchQuery={searchQuery}
            />
          )}
          {cat === 'rates' && <RatesView />}
          {cat === 'presets' && <PresetsView />}
        </>
      }
      rightPane={
        cat === 'users' ? (
          <UsersInspector role={selectedRole} />
        ) : cat === 'materials' ? (
          <MaterialInspector material={selectedMaterial} />
        ) : cat === 'vendors' ? (
          <VendorInspector vendor={selectedVendor} />
        ) : cat === 'rates' ? (
          <RateInspector />
        ) : (
          <PresetInspector />
        )
      }
      leftPaneWidth="240px"
      rightPaneWidth="380px"
    />
  )
}
