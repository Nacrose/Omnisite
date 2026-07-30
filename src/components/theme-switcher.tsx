'use client'

import { useOmniTheme, OmniSiteTheme } from '@/lib/theme-provider'
import { useState, useRef, useEffect } from 'react'
import { Sun, Moon, Contrast, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const THEMES: { id: OmniSiteTheme; name: string; icon: typeof Sun; desc: string }[] = [
  { id: 'classic', name: 'OmniSite Classic', icon: Sun, desc: 'macOS-native, soft & spacious' },
  { id: 'procore', name: 'Procore High-Contrast', icon: Contrast, desc: 'Industrial bright, sharper' },
  { id: 'darkfield', name: 'Dark Field Mode', icon: Moon, desc: 'Engineering-grade dark' },
]

export function ThemeSwitcher() {
  const { theme, setTheme } = useOmniTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const current = THEMES.find(t => t.id === theme)!
  const CurrentIcon = current.icon

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="p-2 rounded-md hover:bg-accent text-muted-foreground"
        title={`Theme: ${current.name}`}
      >
        <CurrentIcon className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 pane border border-[var(--pane-divider)] rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--pane-divider)]">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Theme Engine</div>
          </div>
          <div className="py-1">
            {THEMES.map(t => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id); setOpen(false) }}
                  className={cn(
                    'w-full flex items-start gap-3 px-3 py-2 hover:bg-accent text-left transition-colors',
                    theme === t.id && 'bg-accent/50'
                  )}
                >
                  <Icon className={cn('w-4 h-4 mt-0.5', theme === t.id ? 'text-primary' : 'text-muted-foreground')} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {t.name}
                      {theme === t.id && <Check className="w-3 h-3 text-primary" />}
                    </div>
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
