'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { PaneHeader, PaneBody } from '@/components/workspace-3pane'
import {
  Plus,
  Copy,
  Camera,
  Cloud,
  Users,
  Clock,
  Truck,
  Mountain,
  Thermometer,
  Droplets,
  Wind,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Daily Site Log ─────────────────────────────────────────────────────────
//
// There is currently no `daily_site_logs` DB table or API route. Until that
// lands, this view renders EMPTY defaults for every section so the user
// sees a real "log a fresh day" form instead of yesterday's demo data.
// Previously the cards were pre-populated with fabricated weather,
// visitors, manpower, equipment, and a geological face log — which made
// it look like real records existed when they didn't, and gave false
// confidence that the data was being persisted somewhere.
//
// Each section below is a controlled-or-uncontrolled input the user can
// fill in. None of the inputs persist yet (no backing store); when the
// `daily_site_logs` table + route land, swap these `defaultValue=""`
// props for `useSyncedState` bindings.

export function DailySiteLogView({ date }: { date: string }) {
  // Format the ISO date as "30 July 2026" for the header.
  const formatted = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—'
  return (
    <>
      <PaneHeader title={`Daily Site Log · ${formatted}`}>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() =>
            toast.info('Copy Yesterday coming soon', {
              description:
                'Will prefill weather/visitors/manpower/equipment from the previous day once the daily_site_logs table lands.',
            })
          }
          title="Copy Yesterday (coming soon)"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy Yesterday
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() =>
            toast.info('Photo upload coming soon', {
              description:
                'Daily site log photos will attach once the daily_site_logs table lands.',
            })
          }
          title="Photo (coming soon)"
        >
          <Camera className="h-3.5 w-3.5" />
          Photo
        </Button>
      </PaneHeader>
      <PaneBody className="space-y-4 p-4">
        {/* Weather — empty defaults until daily_site_logs exists */}
        <Card title="Weather" icon={<Cloud className="h-4 w-4" />}>
          <div className="grid grid-cols-4 gap-3 text-center">
            <WeatherCell icon={<Thermometer className="h-4 w-4" />} label="Max" value="—" />
            <WeatherCell icon={<Thermometer className="h-4 w-4" />} label="Min" value="—" />
            <WeatherCell icon={<Droplets className="h-4 w-4" />} label="Rain" value="—" />
            <WeatherCell icon={<Wind className="h-4 w-4" />} label="Wind" value="—" />
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              className="h-8 text-xs"
              placeholder="Sky condition (clear / overcast / rainy)…"
              defaultValue=""
            />
          </div>
        </Card>

        {/* Visitors — empty array until daily_site_logs exists */}
        <Card title="Visitors" icon={<Users className="h-4 w-4" />}>
          <div className="space-y-1.5">
            {(
              [] as Array<{
                name: string
                org: string
                purpose: string
                time: string
              }>
            ).map((v, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded border border-[var(--pane-divider)] p-1.5 text-xs"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-400 to-slate-600 text-[10px] font-semibold text-white">
                  {v.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{v.name}</div>
                  <div className="text-muted-foreground text-[10px]">
                    {v.org} · {v.purpose}
                  </div>
                </div>
                <div className="text-muted-foreground text-[10px]">{v.time}</div>
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full gap-1 text-xs"
              onClick={() =>
                toast.info('Visitor logging coming soon', {
                  description:
                    'Add visitor rows once the daily_site_logs table + route land. No backing store exists yet.',
                })
              }
            >
              <Plus className="h-3 w-3" />
              Add visitor
            </Button>
          </div>
        </Card>

        {/* Delays — empty default textarea */}
        <Card title="Delays / Interruptions" icon={<Clock className="h-4 w-4" />}>
          <Textarea
            className="min-h-[60px] text-xs"
            defaultValue=""
            placeholder="Describe any delays or interruptions (e.g. equipment breakdown, weather stoppage, missing material)…"
          />
        </Card>

        {/* Manpower — empty default with a "log from T&A" hint */}
        <Card
          title="Manpower Log"
          icon={<Users className="h-4 w-4" />}
          action={
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-[10px]"
              onClick={() =>
                toast.info('Copy Yesterday coming soon', {
                  description:
                    'Will prefill manpower from the previous day once the daily_site_logs table lands.',
                })
              }
            >
              <Copy className="h-3 w-3" />
              Yesterday
            </Button>
          }
        >
          <div className="text-muted-foreground rounded-md border border-dashed border-[var(--pane-divider)] p-3 text-center text-[11px]">
            No manpower data — log from Time &amp; Attendance
          </div>
        </Card>

        {/* Equipment — empty default with a "log from Equipment module" hint */}
        <Card title="Equipment Log" icon={<Truck className="h-4 w-4" />}>
          <div className="text-muted-foreground rounded-md border border-dashed border-[var(--pane-divider)] p-3 text-center text-[11px]">
            No equipment data — log from Equipment module
          </div>
        </Card>

        {/* Geological face log (tunneling) — empty default */}
        <Card title="Geological Face Log · Tunneling" icon={<Mountain className="h-4 w-4" />}>
          <div className="text-muted-foreground rounded-md border border-dashed border-[var(--pane-divider)] p-3 text-center text-[11px]">
            No geological face log entries
          </div>
        </Card>
      </PaneBody>
    </>
  )
}

function Card({
  title,
  icon,
  children,
  action,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="pane overflow-hidden rounded-lg border border-[var(--pane-divider)]">
      <div className="bg-secondary/20 flex items-center gap-2 border-b border-[var(--pane-divider)] px-3 py-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-semibold tracking-wider uppercase">{title}</span>
        <div className="flex-1" />
        {action}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function WeatherCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="bg-secondary/40 rounded-md p-2">
      <div className="text-muted-foreground flex items-center justify-center">{icon}</div>
      <div className="text-muted-foreground mt-1 text-[10px]">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  )
}
