'use client'

import { useState, useMemo } from 'react'
import { useSyncedState } from '@/lib/use-synced-state'
import { useApp } from '@/lib/app-store'
import { Loader2, Check, X, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Worker {
  id: string
  name: string
  trade: string
  status: 'on-site' | 'off-site' | 'break'
  todayHours?: number
  wageRate?: number
}

interface AttendanceRow {
  id: string
  worker_id: string
  date: string
  hours: number
  ot_hours: number
  note?: string | null
}

export default function MobileAttendancePage() {
  const { activeProjectDbId } = useApp()
  const [workers] = useSyncedState<Worker[]>('omnisite-workers', 'workers', () => [] as Worker[], {
    fieldMap: { todayHours: 'today_hours', wageRate: 'wage_rate' },
    primaryKey: 'id',
  })
  const [attendance, setAttendance] = useSyncedState<AttendanceRow[]>(
    'omnisite-worker-attendance',
    'worker_attendance',
    () => [] as AttendanceRow[],
    { primaryKey: 'id' }
  )

  const today = new Date().toISOString().slice(0, 10)
  const [search, setSearch] = useState('')

  // Today's attendance map: worker_id → hours (or null if not logged)
  const todayMap = useMemo(() => {
    const m = new Map<string, AttendanceRow>()
    for (const a of attendance) {
      if (a.date === today) m.set(a.worker_id, a)
    }
    return m
  }, [attendance, today])

  const filtered = search.trim()
    ? workers.filter(
        (w) =>
          w.name.toLowerCase().includes(search.toLowerCase()) ||
          w.id.toLowerCase().includes(search.toLowerCase()) ||
          w.trade.toLowerCase().includes(search.toLowerCase())
      )
    : workers

  const logHours = (workerId: string, hours: number) => {
    const id = `WA-${workerId}-${today}`
    const existing = todayMap.get(workerId)
    const row: AttendanceRow = {
      id,
      worker_id: workerId,
      date: today,
      hours,
      ot_hours: Math.max(0, hours - 8),
    }
    setAttendance((prev) => (existing ? prev.map((a) => (a.id === id ? row : a)) : [...prev, row]))
    const w = workers.find((w) => w.id === workerId)
    toast.success('Hours logged', {
      description: `${w?.name || workerId} · ${hours}h${hours > 8 ? ` (${(hours - 8).toFixed(1)}h OT)` : ''}`,
    })
  }

  const markAbsent = (workerId: string) => {
    logHours(workerId, 0)
  }

  const presentCount = Array.from(todayMap.values()).filter((a) => a.hours > 0).length
  const totalHours = Array.from(todayMap.values()).reduce((s, a) => s + a.hours, 0)

  return (
    <div className="space-y-3 p-4">
      <div>
        <h1 className="text-lg font-bold">Attendance</h1>
        <p className="text-muted-foreground text-sm">{today}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="border-border bg-card rounded-xl border p-3">
          <div className="text-2xl font-bold text-emerald-600">{presentCount}</div>
          <div className="text-muted-foreground text-[11px]">Present</div>
        </div>
        <div className="border-border bg-card rounded-xl border p-3">
          <div className="text-2xl font-bold">{totalHours.toFixed(1)}h</div>
          <div className="text-muted-foreground text-[11px]">Total hours</div>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search worker…"
        className="border-border bg-card focus:border-primary w-full rounded-xl border px-3 py-2 text-sm outline-none"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Worker list */}
      <div className="space-y-2">
        {filtered.map((w) => {
          const att = todayMap.get(w.id)
          const logged = att != null
          return (
            <div key={w.id} className="border-border bg-card rounded-xl border p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{w.name}</div>
                  <div className="text-muted-foreground text-[11px]">
                    {w.trade} · {w.id}
                  </div>
                </div>
                {logged ? (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      att.hours > 0
                        ? 'bg-emerald-500/15 text-emerald-600'
                        : 'bg-red-500/15 text-red-600'
                    )}
                  >
                    {att.hours > 0 ? `${att.hours}h` : 'Absent'}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-[11px]">Not logged</span>
                )}
              </div>

              {/* Quick log buttons */}
              <div className="mt-2 flex gap-1.5">
                {[4, 6, 8, 10, 12].map((h) => (
                  <button
                    key={h}
                    onClick={() => logHours(w.id, h)}
                    className={cn(
                      'flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors',
                      att?.hours === h
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-secondary text-muted-foreground active:bg-accent'
                    )}
                  >
                    {h}h
                  </button>
                ))}
                <button
                  onClick={() => markAbsent(w.id)}
                  className={cn(
                    'border-border flex items-center justify-center rounded-lg border px-2.5 py-1.5 transition-colors',
                    att?.hours === 0
                      ? 'border-red-500 bg-red-500/15 text-red-600'
                      : 'bg-secondary text-muted-foreground active:bg-accent'
                  )}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && !workers.length && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      )}
    </div>
  )
}
