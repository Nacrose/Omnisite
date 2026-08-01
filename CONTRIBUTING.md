# Contributing to OmniSite

## Development Setup

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000)

Without Supabase env vars, the app runs in demo mode (localStorage fallback).

## Code Quality

Before submitting a PR:

```bash
bun run lint      # ESLint — must be 0 errors
npx tsc --noEmit  # TypeScript — must be 0 errors
bun run test      # Vitest — all tests must pass
```

CI runs these on every push/PR automatically.

## Architecture

- **Framework:** Next.js 16 App Router
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **State:** Zustand (global) + useSyncedState (per-module data)
- **Database:** Supabase PostgreSQL with RLS
- **Auth:** Supabase Auth (no demo bypass on configured deployments)

### Module Structure

Each of the 15 modules lives in `src/components/modules/`. Complex modules (BOQ, Scheduler, Subcontractor, Daily Ops, Procurement) are split into folder structures with `types.ts`, `index.tsx`, and per-view `.tsx` files.

### API Routes

All data writes go through `/api/{table}` routes with:

1. `requireAuth()` — session verification
2. `checkRateLimit()` — per-IP throttling
3. `validateBody()` — zod schema validation
4. `createUserClient()` — RLS-enforced Supabase client
5. `logAudit()` — audit trail

### Adding a New Module

1. Create `src/components/modules/your-module.tsx` (or folder)
2. Add to `MODULES` array in `src/lib/app-store.ts`
3. Add to `MODULE_RENDERERS` in `src/app/page.tsx` (use `dynamic()` for lazy loading)
4. Add to `KEYBOARD_SHORTCUTS` if desired
5. Create API route at `src/app/api/your-table/route.ts`
6. Add SQL schema + RLS policies

## Security

- Never use the service-role key for user-facing queries — use `createUserClient(accessToken)`
- The service-role key is reserved for `logAudit()` only
- All API routes must call `requireAuth()` before any data access
- Input validation via zod is mandatory on all POST handlers
