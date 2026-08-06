'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Shield, X, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import {
  getPermissionGroups,
  MODULE_LABELS,
  resolvePermission,
  type Permissions,
} from '@/lib/permissions-config'

export function PermissionEditorModal({
  assignmentId,
  userName,
  userEmail,
  onClose,
}: {
  assignmentId: string
  userName: string
  userEmail: string
  onClose: () => void
}) {
  const [permissions, setPermissions] = useState<Permissions>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const groups = getPermissionGroups()

  useEffect(() => {
    let active = true
    fetch(`/api/permissions?assignmentId=${assignmentId}`)
      .then((r) => r.json())
      .then((d) => {
        if (active) {
          setPermissions(d.permissions ?? {})
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [assignmentId])

  const toggle = (key: string) => {
    const cur = resolvePermission(permissions, key)
    setPermissions((p) => ({ ...p, [key]: !cur }))
    setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, permissions }),
      })
      if (!res.ok) {
        const e = await res.json()
        toast.error(e.error || 'Failed')
        return
      }
      toast.success('Permissions updated', { description: `${userName}'s access updated.` })
      setDirty(false)
      setTimeout(onClose, 800)
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="pane flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--pane-divider)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-primary/5 flex h-12 items-center justify-between border-b border-[var(--pane-divider)] px-4">
          <div className="flex items-center gap-2">
            <Shield className="text-primary h-4 w-4" />
            <span className="text-sm font-semibold">Permissions · {userName}</span>
          </div>
          <button onClick={onClose} className="hover:bg-accent text-muted-foreground rounded p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="bg-secondary/30 border-b border-[var(--pane-divider)] px-4 py-2">
          <div className="text-xs font-medium">{userName}</div>
          <div className="text-muted-foreground text-[10px]">{userEmail}</div>
        </div>
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              {Object.entries(groups).map(([mod, perms]) => (
                <div key={mod} className="mb-4">
                  <div className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-wider uppercase">
                    {MODULE_LABELS[mod] || mod}
                  </div>
                  <div className="space-y-1.5">
                    {perms.map((p) => {
                      const val = resolvePermission(permissions, p.key)
                      const overridden = p.key in permissions
                      return (
                        <div
                          key={p.key}
                          className="flex items-center gap-3 rounded-md border border-[var(--pane-divider)] p-2.5"
                        >
                          <Switch checked={val} onCheckedChange={() => toggle(p.key)} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">{p.label}</span>
                              {overridden && (
                                <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-medium text-amber-700 dark:text-amber-300">
                                  custom
                                </span>
                              )}
                            </div>
                            <div className="text-muted-foreground text-[10px]">{p.description}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-[var(--pane-divider)] px-4 py-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  setPermissions({})
                  setDirty(true)
                }}
              >
                <RotateCcw className="h-3 w-3" />
                Reset to defaults
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button size="sm" className="gap-1.5" disabled={saving || !dirty} onClick={save}>
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Shield className="h-3.5 w-3.5" />
                      Save Permissions
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
