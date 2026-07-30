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
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '?') {
        e.preventDefault()
        setOpen(o => !o)
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
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl pane border border-[var(--pane-divider)] rounded-xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--pane-divider)]">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Keyboard Shortcuts</span>
          </div>
          <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-accent text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          {/* Global shortcuts */}
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Global</h3>
            <div className="space-y-2">
              {GLOBAL_SHORTCUTS.map(s => (
                <ShortcutRow key={s.label} keys={s.keys} label={s.label} desc={s.desc} />
              ))}
            </div>
          </section>

          {/* Module navigation */}
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Module Navigation</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {Object.entries(KEYBOARD_SHORTCUTS).map(([key, modId]) => {
                const mod = MODULES.find(m => m.id === modId)
                if (!mod) return null
                return (
                  <div key={key} className="flex items-center gap-2.5 text-xs">
                    <kbd className="min-w-[20px] h-5 px-1.5 rounded bg-secondary border border-[var(--pane-divider)] font-mono text-[10px] font-semibold flex items-center justify-center">{key.toUpperCase()}</kbd>
                    <ModuleIcon name={mod.icon} className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="flex-1">{mod.name}</span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* BOQ-specific */}
          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">BOQ Module</h3>
            <div className="space-y-2">
              {BOQ_SHORTCUTS.map(s => (
                <ShortcutRow key={s.label} keys={s.keys} label={s.label} desc={s.desc} />
              ))}
            </div>
          </section>

          {/* Tips */}
          <section className="p-3 rounded-md bg-primary/5 border border-primary/20">
            <div className="text-xs font-semibold mb-1">💡 Tips</div>
            <ul className="text-[11px] text-muted-foreground space-y-1 leading-relaxed">
              <li>• Single-letter shortcuts only fire when you&apos;re not typing in an input field.</li>
              <li>• Right-click BOQ rows for context actions (duplicate, delete, add child, export RA).</li>
              <li>• Drag Gantt bars to move tasks; drag the right edge to resize duration.</li>
              <li>• Click vendor cards in Procurement to select — higher bidders trigger an override modal.</li>
              <li>• The clock in the Dashboard header ticks live — it&apos;s a real 1-second interval.</li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[var(--pane-divider)] bg-secondary/20 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Press <kbd className="px-1 py-0.5 rounded bg-secondary border border-[var(--pane-divider)] font-mono">?</kbd> anywhere to toggle this help</span>
          <button onClick={() => setOpen(false)} className="text-primary hover:underline">Got it</button>
        </div>
      </div>
    </div>
  )
}

function ShortcutRow({ keys, label, desc }: { keys: string[]; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1 min-w-[80px]">
        {keys.map((k, i) => (
          <kbd key={i} className="min-w-[20px] h-6 px-1.5 rounded bg-secondary border border-[var(--pane-divider)] font-mono text-[11px] font-semibold flex items-center justify-center shadow-sm">
            {k}
          </kbd>
        ))}
      </div>
      <div className="flex-1">
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[10px] text-muted-foreground">{desc}</div>
      </div>
    </div>
  )
}
