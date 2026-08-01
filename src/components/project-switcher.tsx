'use client'

import { useState, useRef, useEffect } from 'react'
import { useApp } from '@/lib/app-store'
import { ChevronDown, Building2, Check, MapPin, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Project {
  id: string
  name: string
  code: string
  location: string
  value: string
  progress: number
  status: 'active' | 'on-hold' | 'closed'
}

const PROJECTS: Project[] = [
  { id: 'p1', name: 'Kathmandu Ring Road Expansion — Package 3', code: 'KRR-P3', location: 'Kathmandu', value: 'NPR 487M', progress: 62, status: 'active' },
  { id: 'p2', name: 'Melamchi Water Supply — Treatment Plant', code: 'MWS-TP', location: 'Sindhupalchok', value: 'NPR 1.2B', progress: 78, status: 'active' },
  { id: 'p3', name: 'Pokhara International Airport — Terminal', code: 'PIA-T', location: 'Pokhara', value: 'NPR 640M', progress: 45, status: 'active' },
  { id: 'p4', name: 'Fast Track Expressway — Section 4', code: 'FT-E4', location: 'Makwanpur', value: 'NPR 2.1B', progress: 12, status: 'active' },
  { id: 'p5', name: 'Bharatpur Hospital — New Wing', code: 'BHR-NW', location: 'Chitwan', value: 'NPR 320M', progress: 100, status: 'closed' },
]

export function ProjectSwitcher() {
  const { activeProject, setActiveProject } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = PROJECTS.find(p => p.name === activeProject) ?? PROJECTS[0]

  const selectProject = (p: Project) => {
    setActiveProject(p.name)
    setOpen(false)
    toast.success(`Switched to project`, { description: p.name })
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 max-w-[300px] px-2 py-1 rounded-md hover:bg-accent transition-colors"
      >
        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{current.name}</span>
        <ChevronDown className={cn('w-3 h-3 flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-[420px] pane border border-[var(--pane-divider)] rounded-lg shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-[var(--pane-divider)] bg-secondary/20">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Switch Project</div>
            <div className="text-xs text-muted-foreground mt-0.5">{PROJECTS.filter(p => p.status === 'active').length} active · {PROJECTS.filter(p => p.status === 'closed').length} closed</div>
          </div>

          {/* Project list */}
          <div className="max-h-[400px] overflow-y-auto py-1">
            {PROJECTS.map(p => {
              const isSelected = p.id === current.id
              return (
                <button
                  key={p.id}
                  onClick={() => selectProject(p)}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-2.5 hover:bg-accent text-left transition-colors',
                    isSelected && 'bg-accent/60'
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    'w-9 h-9 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0',
                    p.status === 'closed' ? 'bg-slate-400' : 'bg-gradient-to-br from-primary to-accent-foreground'
                  )}>
                    {p.code.split('-')[0].substring(0, 2)}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                      <span className="font-mono">{p.code}</span>
                      <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{p.location}</span>
                      <span>·</span>
                      <span className="font-mono">{p.value}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            p.status === 'closed' ? 'bg-slate-400' : 'bg-primary'
                          )}
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono w-8 text-right">{p.progress}%</span>
                    </div>
                  </div>
                  {/* Status dot */}
                  <div className="flex-shrink-0 mt-1">
                    <Circle className={cn(
                      'w-2 h-2 fill-current',
                      p.status === 'active' ? 'text-emerald-500' : p.status === 'on-hold' ? 'text-amber-500' : 'text-slate-400'
                    )} />
                  </div>
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[var(--pane-divider)] bg-secondary/20 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Row-Level Security enforced per project</span>
            <button className="text-[11px] text-primary hover:underline">+ New Project</button>
          </div>
        </div>
      )}
    </div>
  )
}
