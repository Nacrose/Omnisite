# Changelog

All notable changes to OmniSite are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-08-01

### Added

- 15 construction management modules: Dashboard, BOQ & Rate Analysis, Scheduler,
  Daily Operations, Equipment, Procurement, Financials, Subcontractor, Drawings,
  Correspondence, Q&S, Reports, Time & Attendance, Admin, Chat
- Supabase Auth with RLS (row-level security) per-project policies
- RBAC via `requireRole` — PM, Site Engineer, Storekeeper, Foreman
- Real CPM (Critical Path Method) scheduling with FS/SS/FF/SF dependency links
- 3-way match (PO vs GRN vs Invoice) for procurement payment gating
- CBS (Cost Breakdown Structure) with DB-level parent rollup trigger
- FIDIC-compliant audit trail with transactional `upsert_with_audit()`
- Nepali i18n (139 keys) + Bikram Sambat calendar support
- Real-time collaboration via Supabase Realtime (presence + channel cache)
- URL-based routing — every module has a shareable deep link
- Rate limiting via Upstash Redis
- CSP with per-request nonce (no `unsafe-inline`)
- 277 vitest tests + 4 Playwright e2e tests
- CI pipeline: lint + tsc + test + audit + build + size-check + e2e
- Prettier + husky + lint-staged pre-commit hook

### Security

- Role resolved from `user_projects` table (DB-backed), not `user_metadata`
- CBS + subcontractor writes require PM role at both API and DB (RLS) level
- Proxy fails closed on Supabase outage (redirects to /login)
- Explicit `onConflict` on every `.upsert()` call
- Sanitized error logging (no DB internals in console)
- Demo-mode defense-in-depth: demo users can't write to real DB

### Known Limitations

- MAX_PAGES cap of 2000 rows per table (surfaced via toast when hit)
- `unsafe-inline` remains in `style-src` (Next.js CSS injection requires it)

### Limitations resolved since v1.0.0

The following were listed as Known Limitations in v1.0.0 but have since been fixed:

- ~~Search index reads from localStorage (bridge — ideally subscribes to React state)~~ — Fixed: command palette now reads live React state via `useSyncedState` (commit `75314f5`)
- ~~No signed URLs for storage objects (uses public URLs — see L8)~~ — Fixed: all 6 storage buckets now use signed URLs with 1-hour TTL (commit `b117475`)
