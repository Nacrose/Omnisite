'use client'

import { useState, useRef, useEffect } from 'react'
import { useApp } from '@/lib/app-store'
import { ChevronDown, Building2, Check, MapPin, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Project {
  id: string
  /** UUID matching the projects table in Supabase. 'p1' maps to the seeded project. */
  dbId: string
  name: string
  code: string
  location: string
  value: string
  progress: number
  status: 'active' | 'on-hold' | 'closed'
}

export const PROJECTS: Project[] = [
  {
    id: 'p1',
    dbId: '00000000-0000-0000-0000-000000000001',
    name: 'Kathmandu Ring Road Expansion — Package 3',
    code: 'KRR-P3',
    location: 'Kathmandu',
    value: 'NPR 487M',
    progress: 62,
    status: 'active',
  },
  {
    id: 'p2',
    dbId: '00000000-0000-0000-0000-000000000002',
    name: 'Melamchi Water Supply — Treatment Plant',
    code: 'MWS-TP',
    location: 'Sindhupalchok',
    value: 'NPR 1.2B',
    progress: 78,
    status: 'active',
  },
  {
    id: 'p3',
    dbId: '00000000-0000-0000-0000-000000000003',
    name: 'Pokhara International Airport — Terminal',
    code: 'PIA-T',
    location: 'Pokhara',
    value: 'NPR 640M',
    progress: 45,
    status: 'active',
  },
  {
    id: 'p4',
    dbId: '00000000-0000-0000-0000-000000000004',
    name: 'Fast Track Expressway — Section 4',
    code: 'FT-E4',
    location: 'Makwanpur',
    value: 'NPR 2.1B',
    progress: 12,
    status: 'active',
  },
  {
    id: 'p5',
    dbId: '00000000-0000-0000-0000-000000000005',
    name: 'Bharatpur Hospital — New Wing',
    code: 'BHR-NW',
    location: 'Chitwan',
    value: 'NPR 320M',
    progress: 100,
    status: 'closed',
  },
]

export function ProjectSwitcher() {
  const { activeProject, activeProjectId, setActiveProject } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = PROJECTS.find((p) => p.id === activeProjectId) ?? PROJECTS[0]

  const selectProject = (p: Project) => {
    setActiveProject(p.name, p.id, p.dbId)
    setOpen(false)
    toast.success(`Switched to project`, { description: p.name })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-muted-foreground hover:text-foreground hover:bg-accent flex max-w-[300px] items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors"
      >
        <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">{current.name}</span>
        <ChevronDown
          className={cn('h-3 w-3 flex-shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="pane absolute top-full left-0 z-50 mt-1 w-[420px] overflow-hidden rounded-lg border border-[var(--pane-divider)] shadow-2xl">
          {/* Header */}
          <div className="bg-secondary/20 border-b border-[var(--pane-divider)] px-4 py-2.5">
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Switch Project
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              {PROJECTS.filter((p) => p.status === 'active').length} active ·{' '}
              {PROJECTS.filter((p) => p.status === 'closed').length} closed
            </div>
          </div>

          {/* Project list */}
          <div className="max-h-[400px] overflow-y-auto py-1">
            {PROJECTS.map((p) => {
              const isSelected = p.id === current.id
              return (
                <button
                  key={p.id}
                  onClick={() => selectProject(p)}
                  className={cn(
                    'hover:bg-accent flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors',
                    isSelected && 'bg-accent/60'
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-xs font-bold text-white',
                      p.status === 'closed'
                        ? 'bg-slate-400'
                        : 'from-primary to-accent-foreground bg-gradient-to-br'
                    )}
                  >
                    {p.code.split('-')[0].substring(0, 2)}
                  </div>
                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{p.name}</span>
                      {isSelected && <Check className="text-primary h-3.5 w-3.5 flex-shrink-0" />}
                    </div>
                    <div className="text-muted-foreground mt-0.5 flex items-center gap-3 text-[11px]">
                      <span className="font-mono">{p.code}</span>
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" />
                        {p.location}
                      </span>
                      <span>·</span>
                      <span className="font-mono">{p.value}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="bg-secondary h-1 flex-1 overflow-hidden rounded-full">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            p.status === 'closed' ? 'bg-slate-400' : 'bg-primary'
                          )}
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground w-8 text-right font-mono text-[10px]">
                        {p.progress}%
                      </span>
                    </div>
                  </div>
                  {/* Status dot */}
                  <div className="mt-1 flex-shrink-0">
                    <Circle
                      className={cn(
                        'h-2 w-2 fill-current',
                        p.status === 'active'
                          ? 'text-emerald-500'
                          : p.status === 'on-hold'
                            ? 'text-amber-500'
                            : 'text-slate-400'
                      )}
                    />
                  </div>
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="bg-secondary/20 flex items-center justify-between border-t border-[var(--pane-divider)] px-4 py-2">
            <span className="text-muted-foreground text-[10px]">
              Row-Level Security enforced per project
            </span>
            <button className="text-primary text-[11px] hover:underline">+ New Project</button>
          </div>
        </div>
      )}
    </div>
  )
}
