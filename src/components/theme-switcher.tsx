'use client'

import { useOmniTheme, OmniSiteTheme } from '@/lib/theme-provider'
import { useState, useRef, useEffect } from 'react'
import { Sun, Moon, Contrast, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const THEMES: { id: OmniSiteTheme; name: string; icon: typeof Sun; desc: string }[] = [
  { id: 'classic', name: 'OmniSite Classic', icon: Sun, desc: 'macOS-native, soft & spacious' },
  {
    id: 'procore',
    name: 'Procore High-Contrast',
    icon: Contrast,
    desc: 'Industrial bright, sharper',
  },
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

  const current = THEMES.find((t) => t.id === theme)!
  const CurrentIcon = current.icon

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-accent text-muted-foreground rounded-md p-2"
        title={`Theme: ${current.name}`}
      >
        <CurrentIcon className="h-4 w-4" />
      </button>

      {open && (
        <div className="pane absolute top-full right-0 z-50 mt-1 w-64 overflow-hidden rounded-lg border border-[var(--pane-divider)] shadow-xl">
          <div className="border-b border-[var(--pane-divider)] px-3 py-2">
            <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Theme Engine
            </div>
          </div>
          <div className="py-1">
            {THEMES.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'hover:bg-accent flex w-full items-start gap-3 px-3 py-2 text-left transition-colors',
                    theme === t.id && 'bg-accent/50'
                  )}
                >
                  <Icon
                    className={cn(
                      'mt-0.5 h-4 w-4',
                      theme === t.id ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {t.name}
                      {theme === t.id && <Check className="text-primary h-3 w-3" />}
                    </div>
                    <div className="text-muted-foreground text-xs">{t.desc}</div>
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
