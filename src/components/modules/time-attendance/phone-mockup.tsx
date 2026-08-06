'use client'

import { useState, useEffect } from 'react'
import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Phone mockup — demonstrates the mobile-first Time & Attendance experience.
 * Foreman taps "Clock In" on mobile; GPS is captured; if outside site perimeter,
 * geo-fence alert fires.
 *
 * Self-contained: holds its own clock-in/clock-out state and a 1-second ticker
 * for the live time display.
 */
export function PhoneMockup() {
  const [clockedIn, setClockedIn] = useState(false)
  const [time, setTime] = useState<Date | null>(null)
  useEffect(() => {
    const initial = setTimeout(() => setTime(new Date()), 0)
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => {
      clearTimeout(initial)
      clearInterval(t)
    }
  }, [])

  return (
    <div className="flex justify-center">
      <div className="relative w-[180px] overflow-hidden rounded-[28px] border-[6px] border-slate-800 bg-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-950">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 z-10 h-4 w-16 -translate-x-1/2 rounded-b-2xl bg-slate-800 dark:bg-slate-700" />

        {/* Screen */}
        <div className="flex h-[320px] flex-col bg-gradient-to-b from-slate-50 to-slate-100 p-3 pt-5 dark:from-slate-900 dark:to-slate-800">
          {/* Status bar */}
          <div className="mb-2 flex items-center justify-between text-[8px] font-medium text-slate-600 dark:text-slate-300">
            <span>
              {time
                ? time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                : '--:--'}
            </span>
            <span className="flex items-center gap-0.5">
              <span className="h-1.5 w-2 rounded-sm bg-slate-600 dark:bg-slate-300" />
              <span className="relative h-1.5 w-3 rounded-sm border border-slate-600 dark:border-slate-300">
                <span className="absolute inset-0.5 rounded-sm bg-emerald-500" />
              </span>
            </span>
          </div>

          {/* App header */}
          <div className="mb-3 text-center">
            <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              OmniSite Mobile
            </div>
            <div className="mt-0.5 text-xs font-bold text-slate-900 dark:text-slate-100">
              Foreman · Ram Bahadur
            </div>
          </div>

          {/* Geo-fence status */}
          <div
            className={cn(
              'mb-2 rounded-lg border p-2 text-center',
              clockedIn
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
            )}
          >
            <MapPin
              className={cn(
                'mx-auto mb-0.5 h-4 w-4',
                clockedIn ? 'text-emerald-600' : 'text-amber-600'
              )}
            />
            <div className="text-[10px] font-medium text-slate-700 dark:text-slate-200">
              {clockedIn ? 'Within site perimeter' : 'GPS ready · 27.7°N 85.3°E'}
            </div>
            <div className="mt-0.5 text-[8px] text-slate-500">
              {clockedIn ? 'Distance: 35m from site center' : 'Site radius: 500m'}
            </div>
          </div>

          {/* Clock-in button */}
          <button
            onClick={() => setClockedIn((v) => !v)}
            className={cn(
              'mx-auto flex h-32 w-32 flex-col items-center justify-center rounded-full font-bold text-white shadow-lg transition-all active:scale-95',
              clockedIn
                ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30'
                : 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/30'
            )}
          >
            <div className="text-[10px] tracking-wider uppercase opacity-80">
              {clockedIn ? 'Tap to Clock Out' : 'Tap to Clock In'}
            </div>
            <div className="mt-0.5 font-mono text-lg tabular-nums">
              {time
                ? time.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : '--:--:--'}
            </div>
            <div className="mt-0.5 text-[8px] opacity-80">
              {clockedIn ? 'On site · 4h 18m' : 'Shift starts 08:00'}
            </div>
            {/* Pulsing ring */}
            <span
              className={cn(
                'absolute inset-0 animate-ping rounded-full',
                clockedIn ? 'bg-red-500/20' : 'bg-emerald-500/20'
              )}
            />
          </button>

          {/* Status footer */}
          <div className="mt-auto text-center text-[8px] text-slate-500 dark:text-slate-400">
            {clockedIn ? (
              <div className="flex items-center justify-center gap-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Clocked in at{' '}
                {time
                  ? time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                  : '--:--'}
              </div>
            ) : (
              <div>Tap the button to start your shift</div>
            )}
          </div>
        </div>

        {/* Home indicator */}
        <div className="flex justify-center bg-slate-900 pt-1 pb-1.5 dark:bg-slate-950">
          <div className="h-1 w-20 rounded-full bg-slate-600" />
        </div>
      </div>
    </div>
  )
}
