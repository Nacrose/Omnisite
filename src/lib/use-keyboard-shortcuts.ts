'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp, KEYBOARD_SHORTCUTS } from '@/lib/app-store'

/**
 * Global keyboard shortcuts hook.
 * - ⌘K / Ctrl+K → Command palette (handled in CommandPalette component)
 * - Single letter keys (when not typing in an input) → switch module (URL nav)
 * - N → Quick Add menu
 * - [ → Toggle left pane
 * - ] → Toggle right pane
 */
export function useKeyboardShortcuts() {
  const { setQuickAddOpen, toggleLeftPane, toggleRightPane } = useApp()
  const router = useRouter()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return
      // Skip if any modifier is pressed (except for ⌘K which is handled elsewhere)
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()

      // Quick Add
      if (key === 'n') {
        e.preventDefault()
        setQuickAddOpen(true)
        return
      }
      // Toggle panes
      if (key === '[') {
        e.preventDefault()
        toggleLeftPane()
        return
      }
      if (key === ']') {
        e.preventDefault()
        toggleRightPane()
        return
      }

      // Module navigation — push the URL; the layout syncs activeModule.
      if (KEYBOARD_SHORTCUTS[key]) {
        e.preventDefault()
        router.push(`/${KEYBOARD_SHORTCUTS[key]}`)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [router, setQuickAddOpen, toggleLeftPane, toggleRightPane])
}
