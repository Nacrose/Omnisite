# OmniSite Architecture

This document describes the runtime architecture of OmniSite — the request
pipeline, the data layer, the security model, and the key abstractions a
contributor needs to understand before making non-trivial changes.

## High-Level Stack

```
┌──────────────────────────────────────────────────────────────┐
│                       Browser (Client)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐  │
│  │ React 19    │  │ Zustand     │  │ useSyncedState       │  │
│  │ (RSC + CSR) │  │ (UI state)  │  │ (per-module data)    │  │
│  └─────────────┘  └─────────────┘  └──────────┬───────────┘  │
│         │                                     │              │
│         │                                     │ fetch        │
│         ▼                                     ▼              │
└──────────────────────────────────────────────────────────────┘
                          │
                          │ HTTPS
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                  Next.js 16 (Vercel / self-host)             │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  proxy.ts (Edge)                                       │  │
│  │  - Per-request CSP nonce                               │  │
│  │  - Static security headers (HSTS, X-Frame-Options…)    │  │
│  │  - Supabase session refresh                            │  │
│  │  - Auth gating (fail-closed → /login on outage)        │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────────────┐  │
│  │  App Router pages (RSC)                                │  │
│  │  - (workspace)/{module}/page.tsx                       │  │
│  │  - Lazy-loaded via next/dynamic                        │  │
│  └────────────────────────┬───────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────────────┐  │
│  │  /api/{table}/route.ts  (createCrudHandler factory)    │  │
│  │  1. requireAuth()         — Supabase session           │  │
│  │  2. checkRateLimit()      — Upstash Redis              │  │
│  │  3. requireRole()         — RBAC from user_projects    │  │
│  │  4. verifyProjectAccess() — cross-project-write guard  │  │
│  │  5. validateBody()        — zod schema                 │  │
│  │  6. upsertWithAudit()     — service-role + audit trail │  │
│  └────────────────────────┬───────────────────────────────┘  │
└───────────────────────────┼──────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
   ┌──────────────────────┐    ┌──────────────────────┐
   │  Supabase Postgres   │    │  Upstash Redis       │
   │  - 16 business tables│    │  - Rate-limit tokens │
   │  - RLS policies      │    │  - Sliding window    │
   │  - Audit triggers    │    └──────────────────────┘
   │  - Realtime pub/sub  │
   └──────────────────────┘
```

## Request Pipeline (write path)

Every write to a business table flows through this pipeline. Each stage is
non-negotiable — skipping a stage is a security regression.

### 1. `proxy.ts` (Edge Middleware)

Runs on every request before the page or API route handler. Responsibilities:

- **CSP nonce generation** — `randomUUID()` per request, set as `x-nonce`
  header. Next.js reads this and passes it to RSCs so inline scripts
  (hydration data) get the nonce. `script-src` is `'self' 'nonce-${nonce}'`
  only — NO `'unsafe-inline'` or `'unsafe-eval'`.
- **Static security headers** — HSTS with preload, X-Frame-Options DENY,
  X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy
  lockdown.
- **Session refresh** — `supabase.auth.getUser()` triggers a token refresh
  if the access token is expired; refreshed tokens are written back to
  cookies via `setAll()`.
- **Auth gating** — unauthenticated users redirect to `/login?redirect=...`.
  **Fail-closed**: if `getUser()` throws (Supabase outage), redirect to
  `/login?error=auth_service_unavailable`. The previous fail-open pattern
  turned a Supabase outage into an auth bypass.

### 2. `requireAuth()` (`src/lib/api-auth.ts`)

Two paths, in priority order:

1. **Cookie-based (preferred)** — `createServerSupabaseClient()` reads
   cookies via `next/headers`. Works with the proxy's auth gating.
2. **Bearer token (fallback)** — for API clients without cookies.

Role is resolved from `user_projects` (DB-backed) — NOT `user_metadata.role`,
which is client-set and vulnerable to self-escalation. Falls back to
`'FOREMAN'` (least-privilege) if no role found.

### 3. `checkRateLimit()` (`src/lib/rate-limit.ts`)

Sliding-window rate limiter via Upstash Redis (`@upstash/ratelimit`).
60 requests per minute per identifier (user_id preferred, IP fallback).

- **Fails OPEN** when Redis is not configured or errors at runtime — rate
  limiting is optional and breaking every API request when Upstash is
  down would be worse than running unprotected.
- **Telemetry** — emits a `console.warn` (once per minute per process)
  AND a Sentry `captureMessage` (once per 5 minutes per process) on
  fail-open, so operators get paged.
- **Auto-trusts `x-forwarded-for` on Vercel** (`process.env.VERCEL === '1'`)
  so rate limiting works out-of-the-box without forcing operators to set
  `TRUST_PROXY=true`.

### 4. `requireRole()` (`src/lib/api-auth.ts`)

RBAC check. Roles: PM, Site Engineer, Storekeeper, Foreman. Each table's
write roles are declared in `TABLE_WRITE_ROLES`:

```typescript
const TABLE_WRITE_ROLES: Record<string, Role[]> = {
  cbs_nodes: ['PM'], // financial-critical
  subcontractors: ['PM'],
  projects: ['PM'],
  user_projects: ['PM'],
  // ... most others: ['PM', 'SITE_ENGINEER']
}
```

**Defense-in-depth for demo mode**: even if a demo user with PM role
somehow reaches a configured Supabase backend, the empty `accessToken`
check blocks the write with 403.

### 5. `verifyProjectAccess()` (`src/lib/api-auth.ts`)

The explicit ownership check that closes the cross-project-write attack
vector when routes use `upsertWithAudit()` (service-role, RLS-bypassed).
Without this, a malicious user with a valid session could craft a body
with a foreign `project_id` and write to a project they're not assigned
to.

Queries `user_projects` for `(user_id, project_id)`. Returns `true` if a
row exists, `false` otherwise (fail-closed on DB error too).

### 6. `validateBody()` (`src/lib/validation.ts`)

Zod schema validation. Every POST/PUT body is validated before reaching
the DB layer. Schemas are defined per-table in `validation.ts`.

### 7. `upsertWithAudit()` / `deleteWithAudit()` (Postgres functions)

`SECURITY DEFINER` Postgres functions that perform the business write +
the `audit_log` INSERT in a single transaction. Callable ONLY by the
service_role (`REVOKE EXECUTE FROM PUBLIC, anon, authenticated`).

Key safety properties:

- **`SET search_path = public, pg_temp`** — closes the CVE-2018-1058-style
  search_path injection.
- **Table allowlist** — `p_table` is checked against an explicit list
  before any `EXECUTE`. Prevents arbitrary-table writes via dynamic SQL.
- **PII masking** — `mask_pii()` redacts `workers.phone`,
  `subcontractors.pan`, `subcontractors.gst` before they land in
  `audit_log.changed_fields`.

See [`supabase/CURRENT_SCHEMA.md`](../supabase/CURRENT_SCHEMA.md) for the
canonical function definitions and migration history.

## Data Layer

### `useSyncedState` (`src/lib/use-synced-state.ts`)

The hybrid Supabase/localStorage hook that backs every module's data.
Returns `[state, setState, loading, truncated, loadMore]`.

- **Reads** go through the REST API (`/api/{table}`) — server-validated,
  RLS-enforced. Paginated 200 rows at a time; default cap is 3 pages
  (600 rows) on initial mount, overridable via `SyncConfig.maxPages`.
- **Writes** are queued in a ref and drained by a separate `useEffect`
  (StrictMode-safe — prevents duplicate POSTs in dev).
- **Realtime** — one Supabase channel per table+project, multiplexed
  across `useSyncedState` instances via a shared channel cache. GC sweep
  every 2 minutes retires channels idle for 5 minutes.
- **localStorage fallback** — when Supabase is not configured, state
  persists to localStorage via `usePersistentState` (500ms trailing
  debounce).

### `createCrudHandler` (`src/lib/crud-handler.ts`)

Factory that builds Next.js API route handlers from a declarative config.
Collapsed ~2,400 lines of copy-paste into ~10-line route files. Config
includes: table name, PK column, cursor field, status codes, body
transform, empty-array behavior.

### `api-client.ts`

Pure HTTP wrapper with no Supabase dependency. Features:

- **In-flight GET dedup** — concurrent identical GETs share one fetch.
- **`invalidateReads()`** — called on writes so post-write reads don't
  return stale snapshots.
- **`ApiClientError`** — preserves status + endpoint for callers.

## Security Model

### Defense in depth

| Layer            | Mechanism                                                 |
| ---------------- | --------------------------------------------------------- |
| Network          | HSTS preload, HTTPS-only in production                    |
| Browser          | CSP with per-request nonce (no `unsafe-inline` in script) |
| Edge proxy       | Fail-closed auth gating on Supabase outage                |
| API auth         | Cookie + Bearer, role from DB (not `user_metadata`)       |
| RBAC             | Per-table write roles, demo-mode defense-in-depth         |
| Project scoping  | `verifyProjectAccess()` on every project-scoped write     |
| Input validation | Zod schemas on every POST/PUT                             |
| DB write         | `upsertWith_audit()` — transactional, allowlisted tables  |
| Audit trail      | Append-only `audit_log`, PII-masked, service-role-only    |
| RLS              | Per-project policies on all 16 business tables            |

### What's NOT defended

- **Rate limiter fail-open** — Redis outage disables rate limiting. This
  is a deliberate tradeoff (see `rate-limit.ts` comments). The Sentry
  event on fail-open is the operator's signal.
- **`'unsafe-inline'` in `style-src`** — Tailwind injects runtime styles.
  Mitigated by the nonce on `script-src` (the main XSS vector).

## Testing Strategy

| Layer       | Tool       | Count | Location                         |
| ----------- | ---------- | ----- | -------------------------------- |
| Unit        | Vitest     | ~250  | `src/lib/__tests__/`             |
| Integration | Vitest     | ~70   | `src/lib/__tests__/integration/` |
| E2E         | Playwright | 18    | `e2e/`                           |

### Coverage gaps (P2 TODOs)

- `useSyncedState` hook behavior — partially covered by the new
  `use-synced-state-hook.test.tsx` smoke test, but the realtime INSERT/
  UPDATE/DELETE patch logic is not yet tested.
- Real-Supabase e2e — current e2e is demo-mode only. A Docker Compose
  path with a real Supabase instance is needed to test auth gating,
  RLS enforcement, and realtime subscriptions end-to-end.
- `proxy.ts` CSP nonce generation — covered by `proxy.test.ts` (the
  `__test__` export), but no e2e test asserts the nonce is present on a
  real response.

## Performance

- **Code splitting** — every module loads as a separate chunk via
  `next/dynamic`.
- **Virtualization** — BOQ grid and scheduler task outline use
  `@tanstack/react-virtual`.
- **Memoized tree rebuilds** — BOQ/CBS/task trees only recompute when
  data changes.
- **Debounced localStorage** — 500ms trailing debounce prevents
  main-thread blocking.
- **Realtime project scoping** — Supabase realtime subscriptions
  filtered by `project_id`.
- **Fetch deduplication** — concurrent identical GETs share a single
  in-flight promise.
- **Bundle size guard** — `scripts/check-bundle-size.mjs` fails CI if
  total > 4500 KB or any single chunk > 1300 KB.

## Deployment

### Vercel (recommended)

Env vars required in production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (for audit logging)
- `UPSTASH_REDIS_REST_URL` (for rate limiting)
- `UPSTASH_REDIS_REST_TOKEN`
- `NEXT_PUBLIC_SENTRY_DSN` (optional but recommended)

`TRUST_PROXY=true` is auto-detected on Vercel (`process.env.VERCEL === '1'`)
— no need to set it manually.

`instrumentation.ts` validates required env vars at startup and crashes
the build if any are missing in production.

### Self-hosting

```bash
bun run build
bun run start
```

Set `TRUST_PROXY=true` if behind Caddy/Nginx (for rate-limit IP detection).
