/**
 * Pure helpers extracted from use-synced-state.ts.
 *
 * These functions have no side effects and no dependency on the Supabase
 * client or React — they're safe to unit-test in isolation and to import
 * from non-hook contexts (e.g. server-side utilities).
 *
 * Re-exported from use-synced-state.ts for backwards compatibility —
 * existing imports from '@/lib/use-synced-state' keep working. New code
 * should import from '@/lib/use-synced-state-helpers' directly.
 */

/**
 * Map a Supabase table name to its REST API endpoint slug.
 *
 * The API routes live at `/api/{slug}/route.ts`. Most slugs match the table
 * name verbatim (e.g. `tasks` → `/api/tasks`), but a few differ because the
 * URL convention is kebab-case while Postgres table names are snake_case
 * (e.g. `cbs_nodes` → `/api/cbs-nodes`).
 *
 * Without these explicit entries, `endpointFor(table)` returns the table
 * name verbatim, which previously caused silent 404s in Supabase mode for
 * `requisitions`, `purchase_orders`, etc. — data round-tripped to
 * localStorage but never reached the server.
 */
export const TABLE_TO_ENDPOINT: Record<string, string> = {
  boq_items: 'boq',
  tasks: 'tasks',
  workers: 'workers',
  equipment: 'equipment',
  cbs_nodes: 'cbs-nodes',
  qs_items: 'qs-items',
  chat_messages: 'chat-messages',
  drawing_annotations: 'drawing-annotations',
  // Tables below were previously missing — without these entries,
  // `endpointFor(table)` returned the table name verbatim, so POSTs to
  // `/api/requisitions` (etc.) hit a 404 in Supabase mode and silently
  // fell back to localStorage. The migration to useSyncedState for these
  // modules looked correct but data never actually round-tripped.
  purchase_orders: 'purchase-orders',
  stock_items: 'stock-items',
  project_locations: 'project-locations',
  user_projects: 'user-projects',
  dsr_entries: 'dsr-entries',
  letters: 'letters',
  grns: 'grns',
  vendors: 'vendors',
  requisitions: 'requisitions',
  drawings: 'drawings',
  subcontractors: 'subcontractors',
}

/**
 * Resolve the REST API endpoint slug for a given Supabase table name.
 * Falls back to the table name verbatim when no explicit mapping exists
 * (which is correct for tables like `tasks`, `workers`, `letters`).
 */
export function endpointFor(table: string): string {
  return TABLE_TO_ENDPOINT[table] ?? table
}

/**
 * Convert a snake_case string to camelCase.
 * e.g. 'has_ra' → 'hasRa', 'parent_id' → 'parentId', 'created_at' → 'createdAt'
 */
export function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

/**
 * Convert a camelCase string to snake_case.
 * e.g. 'hasRa' → 'has_ra', 'parentId' → 'parent_id'
 */
export function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
}

/**
 * Shallow field-by-field equality check for two record-shaped objects.
 *
 * Used by `useSyncedState`'s `setState` to skip unchanged rows before
 * queueing an upsert — a Map-based replacement for the previous
 * `JSON.stringify` comparison (which was both slow for large arrays and
 * didn't preserve key insertion order across runs).
 *
 * Only compares own enumerable keys at depth 1. Nested objects (e.g. an
 * `ra_data` JSONB column) are compared by reference, not by deep equality.
 * This is intentional: the upsert path JSON-serializes the row anyway, so
 * a reference-different but structurally-equal nested object would still
 * produce the same payload — skipping it is a no-op.
 */
export function shallowEqualRecords(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): boolean {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false
  }
  return true
}

/**
 * Configuration for `useSyncedState`.
 */
export interface SyncConfig {
  /** Map app field names to DB column names. e.g., { desc: 'description', hasRA: 'has_ra' } */
  fieldMap?: Record<string, string>
  /** The primary key column name in the DB (default: 'id') */
  primaryKey?: string
  /**
   * Maximum number of pages (200 rows each) to fetch on initial mount.
   * Defaults to 3 (600 rows). Increase for tables that genuinely need the
   * full dataset on first paint (e.g. BOQ, where tree operations require
   * all rows to be present in memory). When the cap is hit, `truncated`
   * flips to true and the `loadMore()` callback fetches the next page.
   */
  maxPages?: number
}
