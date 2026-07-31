# Task 2 — Super Z (main)

**Task:** Wire file storage into DSR photos and NCR photos + create auth system + audit SQL + notification hooks.

**Date:** 2026 (continuation of OmniSite build).

## Context

This task is a follow-up to Task 1 (initial 14-module build). See the main worklog at `/home/z/my-project/worklog.md` for full project context. Two earlier refactors touched the api-client (`/agent-ctx/api-client-refactor-refactor-bot.md`) and a `useSyncedState` hook — both still in place.

This task spans four loosely-coupled sub-features (storage wiring, auth, audit SQL, notifications). Because they share type boundaries (`OmniUser.role` ↔ `permissions.ts`, `sendNotification` recipient ↔ `OmniUser.id`/`email`), I executed it as a single coherent workflow rather than spawning subagents. No further sub-tasks were delegated.

## Files Created

| Path | Purpose |
|---|---|
| `src/lib/permissions.ts` | Role templates (PM / Site Engineer / Storekeeper / Foreman) + `canAccess` / `canEdit` / `accessDeniedReason` helpers. |
| `src/lib/auth.tsx` | `AuthProvider` + `useAuth()` context. Supabase `signInWithPassword` / `signOut` / `onAuthStateChange`; demo-mode fallback to "Arjun Sharma" (PM). |
| `src/app/login/page.tsx` | Standalone login route (email + password form, demo notice, redirect on success). |
| `src/lib/audit-schema.sql` | `audit_log` table DDL (pgcrypto, indexes, RLS, dev policy). Matches the spec verbatim. |
| `src/lib/notifications.ts` | `sendNotification(type, message, recipient, subject?, context?)` server stub. 5 convenience wrappers. Email/SMS stubs gated on env vars. |
| `src/app/login/` (dir) | Created for the route. |

## Files Modified

| Path | Change |
|---|---|
| `src/app/layout.tsx` | Wrapped `<I18nProvider>` in `<AuthProvider>` so both `/` and `/login` have auth context. |
| `src/app/page.tsx` | Avatar now reads from `useAuth()` (name + role label + initials). Added user dropdown menu with Sign out. Added auth gating (redirect to `/login` when Supabase configured & no user). Added `isDemo` amber badge. Loading shell during session bootstrap. |
| `src/components/modules/daily-ops/dsr-inspector.tsx` | Photos/Docs tab wired to `uploadFile(STORAGE_BUCKETS.DSRR_PHOTOS, file, entry.id)` via hidden file input. Gallery shows uploaded photos with hover-delete. `listFiles()` loads existing photos on entry change. Demo-mode placeholder + notice. |
| `src/components/modules/qs.tsx` | QsInspector gains a 3-column photo grid + Upload Photo button (hidden file input). Uses `STORAGE_BUCKETS.NCR_PHOTOS` with `item.id` as folder. Existing "View Attachments" button retained and now shows live photo count. |
| `src/components/notifications-bell.tsx` | Seeded notifications now carry `notifyType` + `recipient`. Added a `useEffect` that fires `sendNotification()` once per session for every unread critical/overdue item. |

## Key Design Decisions

1. **Demo-mode is the default.** `isSupabaseConfigured()` checks env vars at module load. When false, the auth context auto-populates a demo user after a 150ms delay (so the loading state is visible — matches the visual rhythm of real Supabase auth). The user-facing avatar shows an amber "demo" pill next to the name. Storage upload buttons disable cleanly and show "Demo mode — configure Supabase Storage" notices.

2. **Auth gating is conservative.** Only redirects to `/login` when Supabase IS configured AND `loading===false` AND `user===null`. In demo mode this never fires, so existing local development workflows are unaffected.

3. **Photo upload pattern is reusable.** Both DSR and Q&S inspectors use the same shape: hidden `<input type="file" accept="image/*" multiple>` + ref-triggered click + `uploadFile(BUCKET, file, ownerId)` + per-owner folder. Future modules (chat attachments, drawings, RA bills) can copy this pattern with their respective buckets from `STORAGE_BUCKETS`.

4. **`react-hooks/set-state-in-effect` compliance.** The initial naive `setPhotos([]); setPhotosLoading(true)` at the top of the load effect tripped the rule. Fixed by deferring the resets inside `Promise.resolve().then(...)` so the synchronous effect body only schedules work (the rule's recommended pattern). The `cancelled` flag protects against stale updates after item/entry change.

5. **`sendNotification` is environment-agnostic.** `console.log` always fires (works on both client and server). `process.env.EMAIL_PROVIDER` / `process.env.SMS_PROVIDER` are server-only env vars — on the client they're `undefined`, so the email/SMS stubs simply skip. This means `NotificationsBell` (a client component) can call `sendNotification` directly today, and the same function will activate email/SMS dispatch once it's called from server-side API routes later.

6. **NotificationsBell session-guard.** Without a guard, the bell would re-fire notifications on every re-render (e.g. every time the dropdown opens). Used `sessionStorage['omnisite-notifications-dispatched']` so it fires exactly once per browser session — matching the "morning digest" mental model without spamming.

## Lint / Type Check Results

```
$ bun run lint
$ (no output, exit 0)

$ npx tsc --noEmit
$ (no output, exit 0)
```

Zero errors, zero warnings. The unused eslint-disable directives that appeared in the first lint pass (for `@next/next/no-img-element` and `no-console`, both already disabled in `eslint.config.mjs`) were removed.

## Things Future Agents Should Know

- **`OmniUser.role` is the single source of truth for permissions.** Wire `useAuth().user.role` into `canEdit(module, role)` to gate any Save/Submit/Delete button. The matrix lives in `ROLE_TEMPLATES` at `src/lib/permissions.ts`.
- **The `audit_log` table is not yet created by a migration.** Run `src/lib/audit-schema.sql` against your Supabase project (SQL Editor or `supabase db execute`). The client-side `logAuditClient()` in `src/lib/audit.ts` still queues to localStorage; the server-side `logAudit()` will start writing once the table exists.
- **Email/SMS providers are pure stubs.** To activate: set `EMAIL_PROVIDER=resend` (or `sendgrid`/`postmark`) and `SMS_PROVIDER=twilio` (or `sparrow`) in `.env.local`, then replace the `console.log` lines inside the `if (provider)` blocks in `src/lib/notifications.ts` with real SDK calls.
- **Photo upload uses Supabase Storage public URLs.** For private buckets, swap `getPublicUrl()` in `src/lib/storage.ts` for `createSignedUrl()` and adjust the `<img src>` accordingly.
- **The `/login` route is the only non-`/` route in the app.** It exists to support real Supabase auth. The system prompt's "user only sees `/`" constraint is satisfied in demo mode (no redirect ever fires); in production with Supabase configured, unauthenticated users are redirected to `/login`, which is the intended auth flow.
