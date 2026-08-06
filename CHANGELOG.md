# Changelog

All notable changes to OmniSite are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-beta] — 2026-08-06

### Added

- 4 new DB migrations (28-31): `rfis`, `material_issue_notes`,
  `notifications`, `worker_attendance` — all with RLS, audit allowlist,
  realtime publication, and seed data.
- 7 new API routes: `/api/rfis`, `/api/material-issue-notes`,
  `/api/notifications`, `/api/worker-attendance`, `/api/health`,
  `/api/cron/notifications-scan`, `/api/onboarding/create-first-project`.
- `/onboarding` wizard — 3-step flow that creates a project + auto-assigns
  PM role. Replaces the README's manual SQL INSERT instruction.
- Self-service password reset via Supabase's `resetPasswordForEmail()`.
- `/api/health` endpoint for uptime monitors (200 + degraded in demo
  mode, 503 only when Supabase is configured but unreachable).
- Vercel cron config for daily notifications scan (9am UTC).
- `check-migrations.mjs` script — verifies all migration files are
  applied to the live DB via the `supabase_migrations` tracking table.
- `backup.mjs` script — dumps all business tables to a timestamped JSON
  file under `backups/`.
- Global error toast on `ApiClientError` with dedup + 6-char error ID
  for support correlation.
- CSRF defense via Origin header check on all POST/DELETE routes.
- Timing-safe `CRON_SECRET` comparison via `crypto.timingSafeEqual`.
- Upload validation (size, MIME, extension) for all 6 storage buckets.
  Signed URLs for `drawings` + `dsr-photos` (previously public).
- Per-day attendance logging + multi-day payroll CSV export.
- Reports module ships real templates (4) + live data widgets (S-Curve
  chart, BOQ table, photo log from DSR).
- Equipment document vault: uploads now persist to `equip.docs` (were
  vanishing on reload). Added expiry date input + delete button.
- Billing hold wired for real: Running Bill tab blocks bill generation
  when `sc.billingHold` is true. Visual hold indicator + disabled button.
- RA data persists to `boq_items.ra_data` JSONB column via
  `useSyncedState` (previously localStorage-only, never reached Supabase).
- 46 new i18n keys (EN + NP) for onboarding, auth, notifications, T&A.
- Invite-user modal: focus trap + `role="dialog"` + `aria-modal`.
- Input validation hardening: `nullableUuid`, `cappedText`, `nonNeg`
  helpers applied to BOQ, RFI, MIN, worker_attendance schemas.

### Security

- P0: Migration 23 `TIMESTAMITTZ` typo fixed (broke `supabase db push`).
- P0: Cross-project UPDATE hole closed (project_id mutation rejected).
- P0: PK hijack via INSERT path closed (service-role existence check).
- P0: Scheduler resource add/remove silent data loss fixed.
- P0: `approval_requests` RLS `WITH CHECK` now requires `role = 'PM'`.
- P1: 3-way match tolerance check fixed (was exact `===`).
- P1: Billing hold: PATCH→POST, persist holdId, active project ID.
- P1: NCR create button + CAP content validation.
- P1: Invites `listUsers()` PII leak replaced with targeted lookup.
- P1: chat-media upload bypass (empty extension list) closed.
- P1: Onboarding route uses `upsertWithAudit` (audit trail).
- P1: Broadcast notification markRead guard (don't mark shared rows).
- CSRF: `checkOrigin` on all write paths.
- Cron: `upsertWithAudit` for notification inserts (audit trail).
- Reset button: `clearAllPersistentState` now clears ALL `omnisite-*`
  keys (including new tables + per-item RA state).

### Known Limitations

- MAX_PAGES cap of 2000 rows per table (surfaced via toast when hit)
- `unsafe-inline` remains in `style-src` (Next.js CSS injection requires it)

### Limitations resolved since v1.0.0

- ~~Search index reads from localStorage~~ — Fixed (commit `75314f5`)
- ~~No signed URLs for storage objects~~ — Fixed (commit `b117475`)

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
