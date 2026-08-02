'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, AlertTriangle, Zap, ArrowRight, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { TOTAL_WEEKS, type Task } from './types'

// ─── New Task draft shape ───────────────────────────────────────────────────

export interface NewTaskDraft {
  name: string
  type: Task['type']
  start: number
  duration: number
  progress: number
  constraints: string
  critical: boolean
}

export const EMPTY_NEW_TASK: NewTaskDraft = {
  name: '',
  type: 'Work',
  start: 18,
  duration: 5,
  progress: 0,
  constraints: 'ASAP',
  critical: false,
}

// ─── Add Task Modal ─────────────────────────────────────────────────────────

export function AddTaskModal({
  newTask,
  setNewTask,
  onClose,
  onSubmit,
}: {
  newTask: NewTaskDraft
  setNewTask: (updater: (prev: NewTaskDraft) => NewTaskDraft) => void
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="pane w-full max-w-md overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-primary/5 flex h-12 items-center justify-between border-b border-[var(--pane-divider)] px-4">
          <div className="flex items-center gap-2">
            <Plus className="text-primary h-4 w-4" />
            <span className="text-sm font-semibold">Add New Task</span>
          </div>
          <button onClick={onClose} className="hover:bg-accent text-muted-foreground rounded p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
          {/* Task name */}
          <div>
            <label className="text-xs font-medium">
              Task Name <span className="text-red-500">*</span>
            </label>
            <Input
              className="mt-1 h-8 text-xs"
              placeholder="e.g. PCC M20 pouring at pier P-5"
              value={newTask.name}
              onChange={(e) => setNewTask((t) => ({ ...t, name: e.target.value }))}
              autoFocus
            />
          </div>

          {/* Task type */}
          <div>
            <label className="text-xs font-medium">Task Type</label>
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {(['Work', 'Milestone', 'Hammock', 'Summary'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setNewTask((prev) => ({ ...prev, type: t }))}
                  className={cn(
                    'h-8 rounded border text-[11px] transition-colors',
                    newTask.type === t
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-accent border-[var(--pane-divider)]'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Start week + Duration */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Start Week</label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="number"
                  className="h-8 w-20 text-xs"
                  min={0}
                  max={TOTAL_WEEKS - 1}
                  value={newTask.start}
                  onChange={(e) =>
                    setNewTask((t) => ({
                      ...t,
                      start: Math.max(0, Math.min(TOTAL_WEEKS - 1, parseInt(e.target.value) || 0)),
                    }))
                  }
                />
                <span className="text-muted-foreground text-[10px]">→ Wk {newTask.start + 1}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Duration (weeks)</label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="number"
                  className="h-8 w-20 text-xs"
                  min={1}
                  max={TOTAL_WEEKS - newTask.start}
                  value={newTask.duration}
                  onChange={(e) =>
                    setNewTask((t) => ({
                      ...t,
                      duration: Math.max(
                        1,
                        Math.min(TOTAL_WEEKS - t.start, parseInt(e.target.value) || 1)
                      ),
                    }))
                  }
                  disabled={newTask.type === 'Milestone'}
                />
                <span className="text-muted-foreground text-[10px]">
                  → Wk {newTask.start + newTask.duration + 1}
                </span>
              </div>
            </div>
          </div>

          {/* Constraints */}
          <div>
            <label className="text-xs font-medium">Constraint</label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {['ASAP', 'SNET', 'FNLT', 'MFO', 'MSO', 'ALAP'].map((c) => (
                <button
                  key={c}
                  onClick={() => setNewTask((t) => ({ ...t, constraints: c }))}
                  className={cn(
                    'h-7 rounded border font-mono text-[10px] transition-colors',
                    newTask.constraints === c
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'hover:bg-accent border-[var(--pane-divider)]'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Critical path toggle */}
          <label className="hover:bg-accent/30 flex cursor-pointer items-center gap-2 rounded-md border border-[var(--pane-divider)] p-2">
            <input
              type="checkbox"
              checked={newTask.critical}
              onChange={(e) => setNewTask((t) => ({ ...t, critical: e.target.checked }))}
              className="h-4 w-4"
            />
            <span className="flex-1 text-xs">Mark as critical path task</span>
            <span className="text-[10px] text-red-500">highlighted in red</span>
          </label>

          {/* Preview */}
          <div className="bg-secondary/30 rounded-md p-2.5 text-[11px]">
            <div className="text-muted-foreground mb-1 text-[10px]">Preview</div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-[10px]">T-new</span>
              <span className="font-medium">{newTask.name || 'New Task'}</span>
              <span className="text-muted-foreground ml-auto text-[10px]">
                Wk {newTask.start + 1} → Wk {newTask.start + newTask.duration + 1} ·{' '}
                {newTask.duration}w
              </span>
            </div>
            {/* Mini bar preview */}
            <div className="bg-secondary relative mt-2 h-4 overflow-hidden rounded-sm">
              <div
                className={cn(
                  'absolute h-full rounded-sm',
                  newTask.critical ? 'bg-red-500' : 'bg-primary',
                  newTask.type === 'Milestone' && 'bg-amber-500',
                  newTask.type === 'Hammock' && 'bg-violet-500',
                  newTask.type === 'Summary' && 'bg-muted-foreground/60'
                )}
                style={{
                  left: `${(newTask.start / TOTAL_WEEKS) * 100}%`,
                  width: `${Math.max((newTask.duration / TOTAL_WEEKS) * 100, 2)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-secondary/20 flex items-center justify-end gap-2 border-t border-[var(--pane-divider)] px-4 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" className="gap-1.5" disabled={!newTask.name.trim()} onClick={onSubmit}>
            <Plus className="h-3.5 w-3.5" />
            Add Task
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Critical Path Breach / EOT Modal ───────────────────────────────────────

export function CriticalPathBreachModal({
  task,
  onClose,
  onEotClaim,
  onAccelerate,
}: {
  task: Task
  onClose: () => void
  onEotClaim?: () => void
  onAccelerate?: () => void
}) {
  const match = task.constraints?.match(/Wk (\d+)/)
  const deadlineWeek = match ? parseInt(match[1]) : 0
  const finishWeek = task.start + task.duration
  // Guard: if the constraint has no parseable week (shouldn't happen — the
  // breach detector only opens this modal when /Wk (\d+)/ matches — but
  // defensive), render a minimal "invalid constraint" state instead of
  // showing wildly wrong overrun numbers (audit R3-8 — previously
  // deadlineWeek fell back to 0, making overrun = finishWeek, e.g. "+48w").
  const hasValidDeadline = match !== null && deadlineWeek > 0
  const overrunWeeks = hasValidDeadline ? finishWeek - deadlineWeek : 0
  const overrunDays = overrunWeeks * 7

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="pane w-full max-w-lg overflow-hidden rounded-xl border border-red-500/40 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-[var(--pane-divider)] bg-red-500/10 px-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-semibold text-red-600">⚠️ Critical Path Breach</span>
          </div>
          <button onClick={onClose} className="hover:bg-accent text-muted-foreground rounded p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Breach details */}
          <div className="space-y-1.5 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs">
            <div className="font-medium text-red-600">
              {task.id} — {task.name}
            </div>
            {hasValidDeadline ? (
              <>
                <div className="text-muted-foreground">
                  This task has a <span className="font-medium">Must Finish On</span> deadline of Wk{' '}
                  {deadlineWeek} but its forecast finish is Wk {finishWeek}. The deadline is overrun
                  by {overrunWeeks} week{overrunWeeks === 1 ? '' : 's'}.
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="text-center">
                    <div className="text-muted-foreground text-[10px]">Deadline</div>
                    <div className="font-mono font-bold">Wk {deadlineWeek}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-[10px]">Forecast Finish</div>
                    <div className="font-mono font-bold text-red-600">Wk {finishWeek}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground text-[10px]">Overrun</div>
                    <div className="font-mono font-bold text-red-600">
                      +{overrunWeeks}w ({overrunDays}d)
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-muted-foreground">
                This task has a deadline constraint ({task.constraints}) but no parseable week
                number. Edit the task in the inspector to set a valid deadline week (e.g.{' '}
                {task.constraints}: Wk 48).
              </div>
            )}
          </div>

          {/* Options */}
          <div className="space-y-2">
            <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Select Resolution Option
            </div>

            {/* EOT Claim */}
            <button
              onClick={() =>
                onEotClaim
                  ? onEotClaim()
                  : toast.info(
                      'EOT claim filing coming soon — document the claim in the Correspondence module as a Site Instruction.'
                    )
              }
              title="File EOT Claim"
              className="hover:border-primary/40 hover:bg-accent/30 group flex w-full items-start gap-3 rounded-lg border border-[var(--pane-divider)] p-3 text-left transition-colors"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                <FileText className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">File EOT Claim</div>
                <div className="text-muted-foreground mt-0.5 text-[11px]">
                  Extension of Time claim per FIDIC Clause 8.4. Drafts a formal letter to the
                  Engineer with impact analysis. Timeline moves by +{overrunWeeks} weeks. No cost
                  penalty.
                </div>
              </div>
              <ArrowRight className="text-muted-foreground mt-1 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>

            {/* Acceleration */}
            <button
              onClick={() =>
                onAccelerate
                  ? onAccelerate()
                  : toast.info(
                      'Schedule acceleration coming soon — contact the planning team for crash options.'
                    )
              }
              title="Accelerate (Crash Schedule)"
              className="hover:border-primary/40 hover:bg-accent/30 group flex w-full items-start gap-3 rounded-lg border border-[var(--pane-divider)] p-3 text-left transition-colors"
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/15">
                <Zap className="h-4 w-4 text-violet-500" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">Accelerate (Crash Schedule)</div>
                <div className="text-muted-foreground mt-0.5 text-[11px]">
                  Add resources (extra shifts, additional equipment) to recover the {overrunWeeks}
                  -week overrun. Contact the planning team for an acceleration cost estimate — the
                  real figure depends on task resource rates and availability, which aren't wired
                  into this view yet. Pushes to Financials as a variation once costed.
                </div>
              </div>
              <ArrowRight className="text-muted-foreground mt-1 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          </div>

          {/* FIDIC reference */}
          <div className="bg-secondary/30 text-muted-foreground rounded-md p-2 text-[10px]">
            <span className="font-medium">FIDIC Reference:</span> Sub-Clause 8.4 (Extension of Time)
            and Sub-Clause 8.6 (Rate of Progress). The Contractor shall be entitled to an EOT if the
            delay is caused by a Variation, exceptionally adverse weather, or unforeseen ground
            conditions.
          </div>
        </div>
      </div>
    </div>
  )
}
