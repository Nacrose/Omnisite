'use client'
import { useEffect, type RefObject } from 'react'

export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      )
    const focusable = getFocusable()
    if (focusable.length > 0) focusable[0].focus()
    else {
      container.setAttribute('tabindex', '-1')
      container.focus()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const current = getFocusable()
      if (current.length === 0) return
      const first = current[0],
        last = current[current.length - 1]
      const activeEl = document.activeElement
      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (activeEl === last || !container.contains(activeEl)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    container.addEventListener('keydown', handleKeyDown)
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused?.focus) previouslyFocused.focus()
    }
  }, [containerRef, active])
}
