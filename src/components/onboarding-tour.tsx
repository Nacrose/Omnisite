'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const ONBOARDED_KEY = 'omnisite-onboarded'

interface TourStep {
  title: string
  description: string
  icon: string
}

const STEPS: TourStep[] = [
  {
    title: 'Welcome to OmniSite',
    description:
      'Your construction management platform — 14 modules covering pre-construction, site execution, project controls, and documents. Built for Nepali construction realities.',
    icon: '🏗️',
  },
  {
    title: 'Navigate with the Dock',
    description:
      "The dock at the bottom of the screen gives you access to all 14 modules. On desktop, hover the bottom edge to reveal it. On mobile, it's always visible at the bottom.",
    icon: '📱',
  },
  {
    title: 'Quick Add (N)',
    description:
      'Press N or click the + button in the header to quickly create a DSR, RFI, expense, equipment log, drawing, NCR, or worker — from anywhere in the app.',
    icon: '⚡',
  },
  {
    title: 'Command Palette (⌘K)',
    description:
      'Press ⌘K (or Ctrl+K) to open the command palette. Search across BOQ items, tasks, drawings, letters, equipment, and workers — or jump to any module.',
    icon: '🔍',
  },
  {
    title: 'Keyboard Shortcuts',
    description:
      'Press any letter to jump to a module: B=BOQ, S=Scheduler, D=Daily Ops, F=Financials, etc. Press ? for the full shortcut cheat sheet.',
    icon: '⌨️',
  },
  {
    title: 'Project Switcher',
    description:
      'Click the project name in the header to switch between projects. Data is scoped per-project — each project has its own BOQ, schedule, financials, and more.',
    icon: '🔄',
  },
  {
    title: 'Column Toggle',
    description:
      'Every data table has a "Columns" button in the header. Click it to hide/show columns — your preferences are saved per table and persist across sessions.',
    icon: '📊',
  },
  {
    title: "You're all set!",
    description:
      'Start from the Dashboard for an overview, or dive straight into any module. Need help? Press ? anytime for the shortcut cheat sheet.',
    icon: '✅',
  },
]

export function OnboardingTour() {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    // Only show on first visit (not onboarded yet).
    if (typeof window === 'undefined') return
    try {
      const onboarded = window.localStorage.getItem(ONBOARDED_KEY)
      if (!onboarded) {
        // Small delay so it doesn't fire before the page renders.
        const t = setTimeout(() => setShow(true), 1000)
        return () => clearTimeout(t)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const dismiss = () => {
    setShow(false)
    try {
      window.localStorage.setItem(ONBOARDED_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1)
    } else {
      dismiss()
    }
  }

  const prev = () => {
    if (step > 0) setStep((s) => s - 1)
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={dismiss}
          >
            {/* Modal */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="pane w-full max-w-md overflow-hidden rounded-2xl border border-[var(--pane-divider)] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with close */}
              <div className="flex items-center justify-between px-5 pt-5">
                <div className="flex items-center gap-1.5">
                  {STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-1.5 rounded-full transition-all',
                        i === step
                          ? 'bg-primary w-6'
                          : i < step
                            ? 'bg-primary/50 w-1.5'
                            : 'bg-secondary w-1.5'
                      )}
                    />
                  ))}
                </div>
                <button
                  onClick={dismiss}
                  className="hover:bg-accent text-muted-foreground rounded-md p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="px-5 py-6 text-center">
                <div className="mb-4 text-4xl">{current.icon}</div>
                <h2 className="mb-2 text-lg font-bold">{current.title}</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {current.description}
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 pb-5">
                <Button variant="ghost" size="sm" className="text-xs" onClick={dismiss}>
                  Skip tour
                </Button>
                <div className="flex items-center gap-2">
                  {step > 0 && (
                    <Button variant="outline" size="sm" className="h-8 gap-1" onClick={prev}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Back
                    </Button>
                  )}
                  <Button size="sm" className="h-8 gap-1" onClick={next}>
                    {isLast ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Got it
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
