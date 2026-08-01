'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Undo2 } from 'lucide-react'
import { toast } from 'sonner'

// ─── Confirm Dialog ─────────────────────────────────────────────────────────

interface ConfirmState {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  danger: boolean
  onConfirm: () => void
}

let confirmSetState: ((s: ConfirmState) => void) | null = null

/**
 * Show a confirm dialog. Returns a promise that resolves to true (confirmed)
 * or false (cancelled).
 *
 * @example
 *   const ok = await confirm('Delete item?', 'This cannot be undone.', 'Delete', true)
 *   if (ok) { deleteItem(id) }
 */
export function confirm(
  title: string,
  description: string,
  confirmLabel = 'Confirm',
  danger = false
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!confirmSetState) {
      // Fallback if the provider isn't mounted — use window.confirm
      resolve(window.confirm(`${title}\n\n${description}`))
      return
    }
    confirmSetState({
      open: true,
      title,
      description,
      confirmLabel,
      danger,
      onConfirm: () => resolve(true),
    })
  })
}

/** Provider component — mount once at the app root. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    danger: false,
    onConfirm: () => {},
  })

  useEffect(() => {
    confirmSetState = setState
    return () => {
      confirmSetState = null
    }
  }, [])

  const close = () => setState((s) => ({ ...s, open: false }))

  return (
    <>
      {children}
      <AnimatePresence>
        {state.open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            onClick={close}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="pane w-full max-w-sm overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5">
                <div className="flex items-start gap-3">
                  {state.danger && (
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-500/15">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold">{state.title}</h3>
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      {state.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={close}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    variant={state.danger ? 'destructive' : 'default'}
                    onClick={() => {
                      state.onConfirm()
                      close()
                    }}
                  >
                    {state.confirmLabel}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Undo Toast ─────────────────────────────────────────────────────────────

/**
 * Show a toast with an "Undo" button that calls `onUndo` when clicked.
 * The toast auto-dismisses after `duration` ms (default 5s).
 *
 * @example
 *   deleteItem(id)
 *   undoableToast('Item deleted', 'Click to undo', () => restoreItem(id))
 */
export function undoableToast(
  message: string,
  description: string,
  onUndo: () => void,
  duration = 5000
) {
  toast.success(message, {
    description,
    duration,
    action: {
      label: 'Undo',
      onClick: onUndo,
    },
  })
}
