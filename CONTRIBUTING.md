# Contributing to OmniSite

## Development Setup

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000)

Without Supabase env vars, the app runs in demo mode (localStorage fallback).

## Code Quality

Before submitting a PR, run ALL of these locally:

```bash
bun run lint        # ESLint — must be 0 errors (warnings are tolerated)
bun run lint:strict # ESLint with --max-warnings 0 — stricter gate, run before promoting rules
bun run typecheck   # tsc --noEmit — must be 0 errors
bun run test        # Vitest — all tests must pass
bun run test:coverage  # Optional — generates coverage report in ./coverage/
```

CI runs `lint`, `typecheck`, `test`, `audit`, `build`, `size-check`, and e2e
on every push/PR. `lint:strict` is NOT yet enforced in CI because the
codebase has 253 historical warnings (mostly `console.*` in server-side
logging code and non-null assertions in tests). The intent is to pay down
those warnings and promote `lint:strict` to CI once we hit zero.

### ESLint posture

- `@typescript-eslint/no-explicit-any` is **error** — never commit new `any`.
  Use `unknown` + type guards, or a proper type. Tests that need `any` to
  assert on dynamic keys should use `// eslint-disable-next-line
@typescript-eslint/no-explicit-any` with a comment explaining why.
- All other TypeScript/React rules are **warn**. Fix new violations before
  pushing; don't add to the existing warning count.
- The 5 existing `eslint-disable-next-line react-hooks/exhaustive-deps`
  comments in `scheduler/index.tsx` and `drawings/*` are latent
  stale-closure risks. Each has an inline comment explaining why it's
  disabled. Do NOT add more — refactor to `useMemo` or `useEvent` instead.

## Architecture

- **Framework:** Next.js 16 App Router
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **State:** Zustand (global) + useSyncedState (per-module data)
- **Database:** Supabase PostgreSQL with RLS
- **Auth:** Supabase Auth (no demo bypass on configured deployments)

See [`docs/architecture.md`](./docs/architecture.md) for a full request-pipeline
diagram and the canonical schema reference in
[`supabase/CURRENT_SCHEMA.md`](./supabase/CURRENT_SCHEMA.md).

### Module Structure

Each of the 15 modules lives in `src/components/modules/`. Complex modules (BOQ, Scheduler, Vendors, Daily Ops, Procurement) are split into folder structures with `types.ts`, `index.tsx`, and per-view `.tsx` files.

### API Routes

All data writes go through `/api/{table}` routes built on `createCrudHandler`.
The pipeline is:

1. `requireAuth()` — session verification (cookie or Bearer)
2. `checkRateLimit()` — per-IP throttling (Upstash Redis)
3. `requireRole()` — RBAC check (PM / Site Engineer / Storekeeper / Foreman)
4. `verifyProjectAccess()` — explicit cross-project-write guard
5. `validateBody()` — zod schema validation
6. `upsertWithAudit()` / `deleteWithAudit()` — transactional write + audit entry

### Adding a New Module

1. Create `src/components/modules/your-module.tsx` (or folder)
2. Add to `MODULES` array in `src/lib/app-store.ts`
3. Add to `MODULE_RENDERERS` in `src/app/(workspace)/layout.tsx` (use `dynamic()` for lazy loading)
4. Add to `KEYBOARD_SHORTCUTS` if desired
5. Create API route at `src/app/api/your-table/route.ts` (use `createCrudHandler`)
6. Add the table name to `PROJECT_SCOPED_TABLES` in `src/lib/api-auth.ts`
7. Add SQL schema + RLS policies (see "Adding a migration" below)
8. Add the table to the `upsert_with_audit` / `delete_with_audit` allowlist
   via a new migration (re-create both functions with the new table in the
   `p_table NOT IN (...)` list)

## Database Migrations

Migrations live in `supabase/migrations/` and are named
`YYYYMMDDHHMMSS_description.sql` (zero-padded sequence number).

### Adding a migration

1. Pick the next sequence number — `ls supabase/migrations/ | tail -1`
   gives you the latest. The next file is `00000000000021_<desc>.sql`.
2. **Always use `CREATE OR REPLACE`** for functions, `ALTER TABLE ... ADD
COLUMN IF NOT EXISTS` for columns, and `DO $$ ... IF NOT EXISTS` blocks
   for constraints/indexes. Migrations must be **idempotent** — running
   them twice must not error.
3. **Update `supabase/CURRENT_SCHEMA.md`** if your migration modifies any
   security-critical function (`upsert_with_audit`, `delete_with_audit`,
   `mask_pii`, `recompute_cbs_subtree`, RLS helpers). The migration
   files are the source of truth, but `CURRENT_SCHEMA.md` is the
   consolidated reference a reviewer reads first.
4. **Test locally**: `supabase db reset` (or `supabase db push` against a
   fresh project) — all 21 migrations must apply cleanly in order.
5. **Add seed data** to `supabase/migrations/00000000000006_seed_data.sql`
   if the new table needs demo rows for the demo-mode UI.

### Migration checklist

- [ ] Idempotent (safe to re-run)
- [ ] `CURRENT_SCHEMA.md` updated if functions changed
- [ ] RLS policies added if the table is project-scoped
- [ ] Index on `project_id` if the table is project-scoped
- [ ] CHECK constraints on any financial columns (no negatives)
- [ ] Added to audit allowlist if the API route uses `upsertWithAudit`

## Testing

### Unit tests (Vitest)

- Live in `src/lib/__tests__/` (mirror the `src/lib/` structure)
- Filename: `*.test.ts` (or `*.test.tsx` for hooks/components)
- Run a single file: `bun run test -- src/lib/__tests__/audit.test.ts`
- Coverage: `bun run test:coverage` — reports to `./coverage/`

### Integration tests (Vitest)

- Live in `src/lib/__tests__/integration/`
- Mock `@/lib/supabase-server` and `@/lib/rate-limit` at the top of the
  file (see `crud-routes.test.ts` for the pattern)
- Parameterize over multiple route specs (see the `ROUTES` array in
  `crud-routes.test.ts`)

### E2E tests (Playwright)

- Live in `e2e/`
- Run locally: `bunx playwright test` (chromium only)
- Run all browsers: `PLAYWRIGHT_BROWSERS=all bunx playwright test`
  (chromium + firefox + webkit)
- In CI, all three browsers run. Firefox/WebKit need `bunx playwright
install --with-deps firefox webkit` once on a fresh machine.
- E2E currently runs in demo mode only. A real-Supabase Docker Compose
  path is a P2 TODO — see the code review.

## Security Checklist

Before adding any new API route or DB function:

- [ ] `requireAuth()` is the first call in the handler
- [ ] `requireRole()` is called for write operations
- [ ] `verifyProjectAccess()` is called if the table is in
      `PROJECT_SCOPED_TABLES`
- [ ] `validateBody()` runs a zod schema on every POST/PUT
- [ ] `upsertWithAudit()` is used (not `userClient.upsert()`) so the audit
      log captures the change
- [ ] The table is in the `upsert_with_audit` allowlist (migration required)
- [ ] RLS policies are added (SELECT for any project role, INSERT/UPDATE/DELETE
      for PM or PM+Site Engineer depending on the data sensitivity)
- [ ] No `service_role` key in client-side code (only `NEXT_PUBLIC_*` vars
      are safe to expose)
- [ ] PII fields (phone, PAN, GST) are added to `mask_pii()` if the table
      will be audited

## Pre-commit Hooks

`husky` + `lint-staged` run on every commit:

- `eslint --fix` on `*.{ts,tsx,js,jsx,mjs,cjs}`
- `prettier --write` on `*.{ts,tsx,js,jsx,mjs,cjs,json,md,css,html,yml,yaml}`

To bypass (only for WIP commits, never for PR-bound commits):

```bash
git commit --no-verify
```

## Audit Script

`scripts/audit.mjs` runs `bun audit --json` and enforces:

- HIGH/CRITICAL vulnerabilities in production deps → blocking (exit 1)
- LOW/MODERATE vulnerabilities → non-blocking warning (exit 0)
- Dev-only vulnerabilities → non-blocking warning (exit 0)

If a HIGH/CRITICAL vuln is blocking CI but the fix requires a major
version bump that isn't ready, add it to `KNOWN_BLOCKING_PENDING_UPGRADE`
in `scripts/audit.mjs` with a comment linking to the tracking issue.
This is a deliberate, documented exception — not a permanent bypass.
