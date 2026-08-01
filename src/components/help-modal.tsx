'use client'

import { useState, useEffect } from 'react'
import { X, Keyboard, Command, ArrowLeft, ArrowRight } from 'lucide-react'
import { useApp, KEYBOARD_SHORTCUTS, MODULES } from '@/lib/app-store'
import { ModuleIcon } from '@/components/module-icon'
import { cn } from '@/lib/utils'

const GLOBAL_SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'Open Command Palette', desc: 'Search modules, actions, documents' },
  { keys: ['N'], label: 'Quick Add menu', desc: 'Create DSR, RFI, expense, equipment log…' },
  { keys: ['?'], label: 'Show this help', desc: 'Keyboard shortcuts reference' },
  { keys: ['['], label: 'Toggle left pane', desc: 'Outline / list pane' },
  { keys: [']'], label: 'Toggle right pane', desc: 'Contextual inspector pane' },
]

const BOQ_SHORTCUTS = [
  { keys: ['⌘', 'Z'], label: 'Undo', desc: 'Revert last BOQ edit' },
  { keys: ['⌘', '⇧', 'Z'], label: 'Redo', desc: 'Re-apply last undone edit' },
]

export function HelpModal() {
  const [open, setOpen] = useState(false)

  // ? key opens the help modal; Escape closes (also handled by the overlay)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '?') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="pane flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-[var(--pane-divider)] px-4">
          <div className="flex items-center gap-2">
            <Keyboard className="text-primary h-4 w-4" />
            <span className="text-sm font-semibold">Keyboard Shortcuts</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="hover:bg-accent text-muted-foreground rounded p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto p-5">
          {/* Global shortcuts */}
          <section>
            <h3 className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-wider uppercase">
              Global
            </h3>
            <div className="space-y-2">
              {GLOBAL_SHORTCUTS.map((s) => (
                <ShortcutRow key={s.label} keys={s.keys} label={s.label} desc={s.desc} />
              ))}
            </div>
          </section>

          {/* Module navigation */}
          <section>
            <h3 className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-wider uppercase">
              Module Navigation
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {Object.entries(KEYBOARD_SHORTCUTS).map(([key, modId]) => {
                const mod = MODULES.find((m) => m.id === modId)
                if (!mod) return null
                return (
                  <div key={key} className="flex items-center gap-2.5 text-xs">
                    <kbd className="bg-secondary flex h-5 min-w-[20px] items-center justify-center rounded border border-[var(--pane-divider)] px-1.5 font-mono text-[10px] font-semibold">
                      {key.toUpperCase()}
                    </kbd>
                    <ModuleIcon name={mod.icon} className="text-muted-foreground h-3.5 w-3.5" />
                    <span className="flex-1">{mod.name}</span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* BOQ-specific */}
          <section>
            <h3 className="text-muted-foreground mb-3 text-[10px] font-semibold tracking-wider uppercase">
              BOQ Module
            </h3>
            <div className="space-y-2">
              {BOQ_SHORTCUTS.map((s) => (
                <ShortcutRow key={s.label} keys={s.keys} label={s.label} desc={s.desc} />
              ))}
            </div>
          </section>

          {/* Tips */}
          <section className="bg-primary/5 border-primary/20 rounded-md border p-3">
            <div className="mb-1 text-xs font-semibold">💡 Tips</div>
            <ul className="text-muted-foreground space-y-1 text-[11px] leading-relaxed">
              <li>
                • Single-letter shortcuts only fire when you&apos;re not typing in an input field.
              </li>
              <li>
                • Right-click BOQ rows for context actions (duplicate, delete, add child, export
                RA).
              </li>
              <li>• Drag Gantt bars to move tasks; drag the right edge to resize duration.</li>
              <li>
                • Click vendor cards in Procurement to select — higher bidders trigger an override
                modal.
              </li>
              <li>
                • The clock in the Dashboard header ticks live — it&apos;s a real 1-second interval.
              </li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="bg-secondary/20 text-muted-foreground flex items-center justify-between border-t border-[var(--pane-divider)] px-4 py-2.5 text-[10px]">
          <span>
            Press{' '}
            <kbd className="bg-secondary rounded border border-[var(--pane-divider)] px-1 py-0.5 font-mono">
              ?
            </kbd>{' '}
            anywhere to toggle this help
          </span>
          <button onClick={() => setOpen(false)} className="text-primary hover:underline">
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

function ShortcutRow({ keys, label, desc }: { keys: string[]; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex min-w-[80px] items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="bg-secondary flex h-6 min-w-[20px] items-center justify-center rounded border border-[var(--pane-divider)] px-1.5 font-mono text-[11px] font-semibold shadow-sm"
          >
            {k}
          </kbd>
        ))}
      </div>
      <div className="flex-1">
        <div className="text-xs font-medium">{label}</div>
        <div className="text-muted-foreground text-[10px]">{desc}</div>
      </div>
    </div>
  )
}
