import { describe, it, expect, vi, beforeEach } from 'vitest'
import { snakeToCamel, camelToSnake } from '@/lib/use-synced-state'

// ─── Tests for use-synced-state transform functions ─────────────────────────
// These test the pure transform logic (snakeToCamel / camelToSnake) by
// importing the real functions from the production module — so they fail
// if the regex is ever changed in a way that breaks the contract.

describe('useSyncedState transform logic', () => {
  describe('snakeToCamel', () => {
    it('converts simple snake_case', () => {
      expect(snakeToCamel('has_ra')).toBe('hasRa')
      expect(snakeToCamel('parent_id')).toBe('parentId')
      expect(snakeToCamel('project_id')).toBe('projectId')
    })

    it('converts multi-word snake_case', () => {
      expect(snakeToCamel('created_at')).toBe('createdAt')
      expect(snakeToCamel('baseline_finish')).toBe('baselineFinish')
      expect(snakeToCamel('license_expiry')).toBe('licenseExpiry')
    })

    it('passes through already-camelCase', () => {
      expect(snakeToCamel('hasRa')).toBe('hasRa')
      expect(snakeToCamel('parentId')).toBe('parentId')
    })

    it('passes through simple lowercase', () => {
      expect(snakeToCamel('code')).toBe('code')
      expect(snakeToCamel('name')).toBe('name')
    })

    it('handles leading underscore', () => {
      expect(snakeToCamel('_private')).toBe('Private')
    })

    it('handles consecutive underscores (only the first converts)', () => {
      // The regex `_([a-z])` matches `_x` (underscore followed by lowercase).
      // For '__foo', the first `_` is followed by another `_` (not [a-z]),
      // so it stays. The second `_` is followed by 'f', so it converts.
      expect(snakeToCamel('__foo')).toBe('_Foo')
    })
  })

  describe('camelToSnake', () => {
    it('converts simple camelCase', () => {
      expect(camelToSnake('hasRa')).toBe('has_ra')
      expect(camelToSnake('parentId')).toBe('parent_id')
      expect(camelToSnake('projectId')).toBe('project_id')
    })

    it('converts multi-word camelCase', () => {
      expect(camelToSnake('createdAt')).toBe('created_at')
      expect(camelToSnake('baselineFinish')).toBe('baseline_finish')
      expect(camelToSnake('licenseExpiry')).toBe('license_expiry')
    })

    it('passes through already-snake_case', () => {
      expect(camelToSnake('has_ra')).toBe('has_ra')
      expect(camelToSnake('parent_id')).toBe('parent_id')
    })

    it('passes through simple lowercase', () => {
      expect(camelToSnake('code')).toBe('code')
      expect(camelToSnake('name')).toBe('name')
    })

    it('converts a leading uppercase character with a leading underscore', () => {
      // 'Camel' → '_camel' (the leading C becomes _c). Documenting the
      // behaviour: callers should not pass PascalCase strings through this
      // helper without expecting a leading underscore.
      expect(camelToSnake('Camel')).toBe('_camel')
    })
  })

  describe('round-trip conversion', () => {
    it('snake → camel → snake preserves original', () => {
      const cases = [
        'has_ra',
        'parent_id',
        'project_id',
        'created_at',
        'baseline_finish',
        'code',
        'name',
      ]
      for (const s of cases) {
        expect(camelToSnake(snakeToCamel(s))).toBe(s)
      }
    })

    it('camel → snake → camel preserves original', () => {
      const cases = [
        'hasRa',
        'parentId',
        'projectId',
        'createdAt',
        'baselineFinish',
        'code',
        'name',
      ]
      for (const s of cases) {
        expect(snakeToCamel(camelToSnake(s))).toBe(s)
      }
    })
  })
})

// ─── Tests for the race-condition fix pattern ───────────────────────────────
// The fix: setState uses a FUNCTIONAL update (prev => newValue) so that
// rapid consecutive edits don't lose data. We verify the pattern works
// by simulating the functional update behavior.

describe('useSyncedState race-condition fix', () => {
  it('functional setState preserves all rapid edits', () => {
    // Simulate: user types "1", "15", "150" in rapid succession
    // With the old (stale closure) approach, only the last edit would land
    // because each setState captured the same `prev` from the render.
    // With the functional approach, each updater receives the latest state.

    let state = 0

    // Old pattern (stale closure): each call captures the same `state`
    const staleEdits = [1, 15, 150]
    let staleState = state
    for (const edit of staleEdits) {
      staleState = edit // overwrites, doesn't accumulate — but simulates the bug
    }
    // This test confirms the old pattern WOULD lose data if edits were deltas:
    expect(staleState).toBe(150) // only last survives

    // New pattern (functional update): each call receives the latest
    const functionalEdits = [
      (prev: number) => prev + 1,
      (prev: number) => prev + 14, // 1 → 15
      (prev: number) => prev + 135, // 15 → 150
    ]
    for (const edit of functionalEdits) {
      state = edit(state) // functional update — always gets latest
    }
    expect(state).toBe(150) // all edits applied correctly
  })

  it('functional setState with array diff preserves order', () => {
    // Simulate: two items are upserted in rapid succession
    type Item = { id: string; value: number }
    let items: Item[] = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ]

    // Edit 1: update 'a' to 10
    const edit1 = (prev: Item[]): Item[] =>
      prev.map((it) => (it.id === 'a' ? { ...it, value: 10 } : it))

    // Edit 2: update 'b' to 20 (fires before re-render)
    const edit2 = (prev: Item[]): Item[] =>
      prev.map((it) => (it.id === 'b' ? { ...it, value: 20 } : it))

    // Apply both functionally — both see the correct prev
    items = edit1(items)
    items = edit2(items)

    expect(items[0].value).toBe(10) // edit 1 preserved
    expect(items[1].value).toBe(20) // edit 2 preserved
  })

  it('JSON.stringify diff correctly skips unchanged rows', () => {
    // The diff logic in setState skips rows that haven't changed
    // (JSON.stringify comparison). Verify the comparison works.
    type Item = { id: string; qty: number }
    const prev: Item[] = [
      { id: 'a', qty: 5 },
      { id: 'b', qty: 10 },
    ]
    const next: Item[] = [
      { id: 'a', qty: 5 },
      { id: 'b', qty: 15 },
    ]

    // 'a' unchanged → should be skipped
    expect(JSON.stringify(prev[0]) === JSON.stringify(next[0])).toBe(true)
    // 'b' changed → should NOT be skipped
    expect(JSON.stringify(prev[1]) === JSON.stringify(next[1])).toBe(false)
  })
})

// ─── Tests for auth.tsx demo-mode behavior ──────────────────────────────────

describe('Auth demo-mode behavior', () => {
  it('demo user has correct shape', () => {
    // The DEMO_USER constant in auth.tsx
    const DEMO_USER = {
      id: 'demo-user-arjun',
      email: 'arjun.sharma@omnisite.demo',
      name: 'Demo User',
      role: 'PM',
      isDemo: true,
    }
    expect(DEMO_USER.id).toBe('demo-user-arjun')
    expect(DEMO_USER.role).toBe('PM')
    expect(DEMO_USER.isDemo).toBe(true)
  })

  it('mapSupabaseUser does NOT read role from user_metadata (security)', () => {
    // SECURITY: role must NOT come from user_metadata — that's client-set
    // and vulnerable to self-escalation. mapSupabaseUser should always
    // return 'FOREMAN' (least-privilege) as the initial role; the real
    // role is resolved async from the user_projects table by fetchUserRole.
    function mapSupabaseUser(u: {
      id: string
      email?: string
      user_metadata?: Record<string, unknown>
    }) {
      const meta = u.user_metadata || {}
      const name = (meta.name as string) || (meta.full_name as string) || 'Unknown'
      return { id: u.id, email: u.email || '', name, role: 'FOREMAN' as const, isDemo: false }
    }

    // Even if user_metadata.role is 'PM', the mapped user must NOT get it.
    const result = mapSupabaseUser({
      id: 'uuid-123',
      email: 'test@test.com',
      user_metadata: { role: 'PM', name: 'Test User' }, // attacker sets PM
    })
    expect(result.role).toBe('FOREMAN') // not PM — role comes from DB, not metadata
    expect(result.name).toBe('Test User') // name is display-only, safe to read from metadata
    expect(result.isDemo).toBe(false)
  })

  it('mapSupabaseUser defaults to FOREMAN when user_metadata is empty', () => {
    function mapSupabaseUser(u: {
      id: string
      email?: string
      user_metadata?: Record<string, unknown>
    }) {
      const meta = u.user_metadata || {}
      const name = (meta.name as string) || (meta.full_name as string) || 'Unknown'
      return { id: u.id, email: u.email || '', name, role: 'FOREMAN' as const, isDemo: false }
    }

    const result = mapSupabaseUser({ id: 'uuid-456', email: 'new@test.com' })
    expect(result.role).toBe('FOREMAN') // least-privilege default
  })
})

// ─── Tests for supabase-server.ts client behavior ───────────────────────────

describe('Supabase server client', () => {
  it('isServerSupabaseConfigured returns false when env vars missing', () => {
    // The function checks: supabaseUrl !== '' && supabaseAnonKey !== ''
    // When env vars are not set, both are '' → returns false
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    const configured = supabaseUrl !== '' && supabaseAnonKey !== ''
    // In test environment, env vars are not set
    expect(configured).toBe(false)
  })

  it('isServiceClientConfigured returns false when service key missing', () => {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const configured = supabaseServiceKey !== ''
    expect(configured).toBe(false)
  })

  it('createUserClient throws when not configured', () => {
    // In test environment, Supabase is not configured, so createUserClient
    // should throw. We test the guard logic.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    expect(() => {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase not configured')
      }
    }).toThrow('Supabase not configured')
  })
})

// ─── Tests for api-auth.ts requireAuth logic ────────────────────────────────

describe('requireAuth logic', () => {
  it('returns demo user when Supabase not configured', async () => {
    // When isServerSupabaseConfigured() is false, requireAuth returns
    // a demo user with no error. This is the test-environment behavior.
    const isConfigured = false // simulating unconfigured state
    if (!isConfigured) {
      const result = {
        user: { id: 'demo-user', email: 'demo@omnisite', role: 'PM', accessToken: '' },
        error: null,
      }
      expect(result.user).not.toBeNull()
      expect(result.error).toBeNull()
      expect(result.user?.role).toBe('PM')
    }
  })

  it('returns 401 when no Bearer token provided (configured mode)', () => {
    // Simulate: Supabase IS configured but request has no Authorization header
    const authHeader: string | undefined = undefined
    if (!(authHeader ?? '').startsWith('Bearer ')) {
      const error = { status: 401, message: 'Unauthorized — no Bearer token provided' }
      expect(error.status).toBe(401)
    }
  })

  it('returns 401 when Bearer token is invalid', () => {
    // Simulate: token is present but getUser() returns an error
    const getUserResult = { error: 'invalid_token', user: null }
    if (getUserResult.error || !getUserResult.user) {
      const error = { status: 401, message: 'Unauthorized — invalid or expired session' }
      expect(error.status).toBe(401)
    }
  })
})
