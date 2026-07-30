'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Plus, X, AlertTriangle, Zap, ArrowRight, FileText,
} from 'lucide-react'
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
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md pane border border-[var(--pane-divider)] rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--pane-divider)] bg-primary/5">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Add New Task</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Task name */}
          <div>
            <label className="text-xs font-medium">Task Name <span className="text-red-500">*</span></label>
            <Input
              className="mt-1 h-8 text-xs"
              placeholder="e.g. PCC M20 pouring at pier P-5"
              value={newTask.name}
              onChange={(e) => setNewTask(t => ({ ...t, name: e.target.value }))}
              autoFocus
            />
          </div>

          {/* Task type */}
          <div>
            <label className="text-xs font-medium">Task Type</label>
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {(['Work', 'Milestone', 'Hammock', 'Summary'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setNewTask(prev => ({ ...prev, type: t }))}
                  className={cn(
                    'h-8 rounded text-[11px] border transition-colors',
                    newTask.type === t
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-[var(--pane-divider)] hover:bg-accent'
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
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  className="h-8 text-xs w-20"
                  min={0}
                  max={TOTAL_WEEKS - 1}
                  value={newTask.start}
                  onChange={(e) => setNewTask(t => ({ ...t, start: Math.max(0, Math.min(TOTAL_WEEKS - 1, parseInt(e.target.value) || 0)) }))}
                />
                <span className="text-[10px] text-muted-foreground">→ Wk {newTask.start + 1}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Duration (weeks)</label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  className="h-8 text-xs w-20"
                  min={1}
                  max={TOTAL_WEEKS - newTask.start}
                  value={newTask.duration}
                  onChange={(e) => setNewTask(t => ({ ...t, duration: Math.max(1, Math.min(TOTAL_WEEKS - t.start, parseInt(e.target.value) || 1)) }))}
                  disabled={newTask.type === 'Milestone'}
                />
                <span className="text-[10px] text-muted-foreground">→ Wk {newTask.start + newTask.duration + 1}</span>
              </div>
            </div>
          </div>

          {/* Constraints */}
          <div>
            <label className="text-xs font-medium">Constraint</label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {['ASAP', 'SNET', 'FNLT', 'MFO', 'MSO', 'ALAP'].map(c => (
                <button
                  key={c}
                  onClick={() => setNewTask(t => ({ ...t, constraints: c }))}
                  className={cn(
                    'h-7 rounded text-[10px] border transition-colors font-mono',
                    newTask.constraints === c
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-[var(--pane-divider)] hover:bg-accent'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Critical path toggle */}
          <label className="flex items-center gap-2 p-2 rounded-md border border-[var(--pane-divider)] cursor-pointer hover:bg-accent/30">
            <input
              type="checkbox"
              checked={newTask.critical}
              onChange={(e) => setNewTask(t => ({ ...t, critical: e.target.checked }))}
              className="w-4 h-4"
            />
            <span className="text-xs flex-1">Mark as critical path task</span>
            <span className="text-[10px] text-red-500">highlighted in red</span>
          </label>

          {/* Preview */}
          <div className="p-2.5 rounded-md bg-secondary/30 text-[11px]">
            <div className="text-[10px] text-muted-foreground mb-1">Preview</div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">T-new</span>
              <span className="font-medium">{newTask.name || 'New Task'}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                Wk {newTask.start + 1} → Wk {newTask.start + newTask.duration + 1} · {newTask.duration}w
              </span>
            </div>
            {/* Mini bar preview */}
            <div className="mt-2 h-4 relative bg-secondary rounded-sm overflow-hidden">
              <div
                className={cn(
                  'absolute h-full rounded-sm',
                  newTask.critical ? 'bg-red-500' : 'bg-primary',
                  newTask.type === 'Milestone' && 'bg-amber-500',
                  newTask.type === 'Hammock' && 'bg-violet-500',
                  newTask.type === 'Summary' && 'bg-muted-foreground/60'
                )}
                style={{ left: `${(newTask.start / TOTAL_WEEKS) * 100}%`, width: `${Math.max((newTask.duration / TOTAL_WEEKS) * 100, 2)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--pane-divider)] bg-secondary/20">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!newTask.name.trim()}
            onClick={onSubmit}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Task
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Critical Path Breach / EOT Modal ───────────────────────────────────────

export function CriticalPathBreachModal({ task, onClose, onEotClaim, onAccelerate }: {
  task: Task
  onClose: () => void
  onEotClaim: () => void
  onAccelerate: () => void
}) {
  const match = task.constraints?.match(/Wk (\d+)/)
  const deadlineWeek = match ? parseInt(match[1]) : 0
  const finishWeek = task.start + task.duration
  const overrunWeeks = finishWeek - deadlineWeek
  const overrunDays = overrunWeeks * 7

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg pane border border-red-500/40 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--pane-divider)] bg-red-500/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold text-red-600">⚠️ Critical Path Breach</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Breach details */}
          <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-xs space-y-1.5">
            <div className="font-medium text-red-600">{task.id} — {task.name}</div>
            <div className="text-muted-foreground">
              This Hammock task (quantity-driven) has expanded beyond its Must Finish On deadline.
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground">Deadline</div>
                <div className="font-mono font-bold">Wk {deadlineWeek}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground">Forecast Finish</div>
                <div className="font-mono font-bold text-red-600">Wk {finishWeek}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground">Overrun</div>
                <div className="font-mono font-bold text-red-600">+{overrunWeeks}w ({overrunDays}d)</div>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Select Resolution Option</div>

            {/* EOT Claim */}
            <button
              onClick={onEotClaim}
              className="w-full flex items-start gap-3 p-3 rounded-lg border border-[var(--pane-divider)] hover:border-primary/40 hover:bg-accent/30 text-left transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">File EOT Claim</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Extension of Time claim per FIDIC Clause 8.4. Drafts a formal letter to the Engineer with impact analysis. Timeline moves by +{overrunWeeks} weeks. No cost penalty.
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
            </button>

            {/* Acceleration */}
            <button
              onClick={onAccelerate}
              className="w-full flex items-start gap-3 p-3 rounded-lg border border-[var(--pane-divider)] hover:border-primary/40 hover:bg-accent/30 text-left transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-violet-500" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">Accelerate (Crash Schedule)</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Add resources (extra shifts, additional equipment) to recover the {overrunWeeks}-week overrun. Estimated acceleration cost: NPR {(overrunWeeks * 850000).toLocaleString()}. Pushes to Financials as a variation.
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
            </button>
          </div>

          {/* FIDIC reference */}
          <div className="p-2 rounded-md bg-secondary/30 text-[10px] text-muted-foreground">
            <span className="font-medium">FIDIC Reference:</span> Sub-Clause 8.4 (Extension of Time) and Sub-Clause 8.6 (Rate of Progress). The Contractor shall be entitled to an EOT if the delay is caused by a Variation, exceptionally adverse weather, or unforeseen ground conditions.
          </div>
        </div>
      </div>
    </div>
  )
}
