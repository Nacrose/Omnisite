'use client'
import { useState, useEffect, useCallback } from 'react'
import { resolvePermission, type Permissions } from '@/lib/permissions-config'

let cached: Permissions | null = null
let promise: Promise<Permissions> | null = null

async function fetchMine(): Promise<Permissions> {
  if (cached) return cached
  if (promise) return promise
  promise = fetch('/api/permissions/me')
    .then((r) => (r.ok ? r.json() : { permissions: {} }))
    .then((d: { permissions?: Permissions }) => {
      cached = d.permissions ?? {}
      return cached
    })
    .catch(() => {
      cached = {}
      return cached as Permissions
    })
    .finally(() => {
      promise = null
    })
  return promise
}

export function usePermissions() {
  const [perms, setPerms] = useState<Permissions | null>(cached)
  useEffect(() => {
    if (!perms) fetchMine().then(setPerms)
  }, [perms])
  const can = useCallback((key: string) => resolvePermission(perms, key), [perms])
  return { can, loading: perms === null }
}

export function clearPermissionCache() {
  cached = null
}
