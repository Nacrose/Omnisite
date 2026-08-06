'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Building2, X, Loader2, CheckCircle2, Calendar } from 'lucide-react'
import { toast } from 'sonner'

interface NewProjectModalProps {
  onClose: () => void
  onCreated: (projectId: string, projectName: string) => void
}

export function NewProjectModal({ onClose, onCreated }: NewProjectModalProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Project name is required')
      return
    }
    if (!code.trim()) {
      toast.error('Project code is required')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          location: location.trim() || undefined,
          start_date: startDate || undefined,
          value: value ? parseFloat(value) : 0,
          status: 'Active',
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create project')
        return
      }

      setSuccess(true)
      toast.success('Project created', {
        description: `${name} is ready. You've been assigned as PM automatically.`,
      })
      setTimeout(() => {
        onCreated(data.id, name)
        onClose()
      }, 1200)
    } catch {
      toast.error('Network error')
    } finally {
      setSubmitting(false)
    }
  }

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
            <Building2 className="text-primary h-4 w-4" />
            <span className="text-sm font-semibold">
              {success ? 'Project Created' : 'New Project'}
            </span>
          </div>
          <button onClick={onClose} className="hover:bg-accent text-muted-foreground rounded p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
            <div className="text-sm font-semibold">{name}</div>
            <div className="text-muted-foreground mt-1 text-xs">
              Created — you are the PM. Switching you there now…
            </div>
          </div>
        ) : (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
            <div>
              <label className="flex items-center gap-1 text-xs font-medium">
                Project Name <span className="text-red-500">*</span>
              </label>
              <Input
                className="mt-1 h-8 text-xs"
                placeholder="e.g. Kathmandu Ring Road — Package 3"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                disabled={submitting}
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-xs font-medium">
                Project Code <span className="text-red-500">*</span>
              </label>
              <Input
                className="mt-1 h-8 font-mono text-xs uppercase"
                placeholder="e.g. KRR-P3"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={submitting}
              />
              <p className="text-muted-foreground mt-1 text-[10px]">
                Short code used in BOQ items, tasks, and drawings.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium">Location</label>
              <Input
                className="mt-1 h-8 text-xs"
                placeholder="e.g. Kathmandu"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-xs font-medium">
                <Calendar className="h-3 w-3" />
                Start Date
              </label>
              <Input
                className="mt-1 h-8 text-xs"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={submitting}
              />
              <p className="text-muted-foreground mt-1 text-[10px]">
                Drives the Gantt chart &ldquo;today&rdquo; line and S-curve baseline.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium">Contract Value (NPR)</label>
              <Input
                className="mt-1 h-8 text-xs"
                type="number"
                placeholder="e.g. 487400000"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="flex items-center justify-between border-t border-[var(--pane-divider)] pt-3">
              <div className="text-muted-foreground text-[10px]">You'll be auto-assigned as PM</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={submitting || !name.trim() || !code.trim()}
                  onClick={handleSubmit}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Building2 className="h-3.5 w-3.5" />
                      Create Project
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
