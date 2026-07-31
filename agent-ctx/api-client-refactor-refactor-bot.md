# Task: api-client-refactor — Unified API Client

**Agent:** Refactor Bot (api client)
**Date:** OmniSite session
**Task ID:** api-client-refactor

## Goal

Route module writes through the existing REST API routes (`/api/boq`, `/api/tasks`, …) instead of having `useSyncedState` talk to Supabase directly from the browser. Adds server-side validation to the write path while preserving the existing localStorage fallback and Supabase realtime notifications.

## Files Changed

| File | Change |
|---|---|
| `src/lib/api-client.ts` | **NEW** — typed fetch wrapper (`fetchAll`, `upsertOne`, `deleteOne`) + `ApiClientError`. Pure HTTP, no Supabase import. Relative URLs only. |
| `src/lib/use-synced-state.ts` | **EDITED** — initial read and post-notification refetch now go through `fetchAll`; writes now go through `upsertOne` (with a prev-state diff so unchanged rows don't generate POSTs). Realtime subscription via the Supabase client is preserved (read-only notification path). localStorage fallback unchanged. |

## Design

### `src/lib/api-client.ts`

- `fetchAll<T>(endpoint): Promise<T[]>` — `GET /api/{endpoint}`, returns `[]` when the server returns `null` (Supabase returns `null` for empty selects).
- `upsertOne<T>(endpoint, item): Promise<T | undefined>` — `POST /api/{endpoint}` with `Content-Type: application/json`. Returns the first row of the server's response array (since `supabase.upsert(...).select()` returns an array).
- `deleteOne(endpoint, id): Promise<void>` — `DELETE /api/{endpoint}?id={id}`. Drains the response body so the connection can be reused.
- `ApiClientError` carries `status` (0 for network errors) and `endpoint` for easy debugging.
- All URLs are built via `buildUrl()`, which accepts either `boq` or `/api/boq` and appends query params as needed. Every URL is relative — works behind the Caddy gateway and on Vercel.
- Network failures are caught and re-thrown as `ApiClientError` with status `0`, so callers don't have to handle the `TypeError` that `fetch()` throws on offline/DNS failure.

### `src/lib/use-synced-state.ts`

- New `TABLE_TO_ENDPOINT` map: `boq_items → boq`, `tasks → tasks`, `workers → workers`, `equipment → equipment`, `cbs_nodes → cbs-nodes`, `qs_items → qs-items`, `chat_messages → chat-messages`. Falls back to the table name itself, so adding a new table+route pair requires no change here.
- Initial load (`load()` inside `useEffect`): replaced `supabase.from(table).select('*')` with `fetchAll(apiEndpoint)`.
- Realtime subscription: kept the `supabase.channel(...).on('postgres_changes', ...).subscribe()` exactly as before, but the callback now calls `fetchAll(apiEndpoint)` instead of doing a direct Supabase `select`. The Supabase client is used only to receive the notification — the actual read still goes through the API.
- Writes (`setState`): replaced the per-item `supabase.from(table).upsert(...)` call with `upsertOne(apiEndpoint, {...row, id})`. Added a prev-state diff (compare JSON serialization) so unchanged rows don't generate POSTs — this preserves the original "upsert everything with an id" behavior but skips redundant network calls.
- localStorage backup save (`setLocalState(newValue)`) preserved.
- localStorage fallback (when `!isSupabaseConfigured()`) preserved verbatim — no Supabase client access, no fetch calls, just `usePersistentState`.
- Cleanup function uses `supabase!.removeChannel(channel)` (non-null assertion) to match the original pattern and satisfy TS strict null checks across the closure boundary.

## Verification

```
$ cd /home/z/my-project && bun run lint
$ eslint .
(no output — 0 errors, 0 warnings)

$ npx tsc --noEmit
(no output — 0 errors)
```

## Constraints honored

- ✅ Did NOT break the localStorage fallback — the `else` branch in `setState` and the entire `usePersistentState` integration are unchanged.
- ✅ Did NOT break the real-time subscriptions — `supabase.channel(...).on('postgres_changes', ...).subscribe()` is preserved verbatim; only the callback's data-fetching mechanism changed (Supabase `select` → API `fetchAll`).
- ✅ The API client is the write path (`upsertOne` in `setState`) and the read path (`fetchAll` in `load` and in the realtime callback). Supabase realtime is only the notification path.
- ✅ All fetch URLs are relative (`/api/{endpoint}`) — no absolute URLs anywhere. Works behind the Caddy gateway and on Vercel.

## Notes for future work

- `deleteOne` is exported from `api-client.ts` but not yet wired into `useSyncedState` (the current hook semantics are "upsert items with ids" — items removed from the local array are not currently deleted server-side). It's available for module-level use (e.g. a "Delete row" context-menu action could call `deleteOne('boq', id)` directly).
- The `TABLE_TO_ENDPOINT` map could be moved to a shared config file if more endpoints are added, but inlining it here keeps the change minimal.
- The diff-based upsert uses `JSON.stringify` for equality, which is O(n) per item but is dwarfed by the network round-trip it saves.
