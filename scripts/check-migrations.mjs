#!/usr/bin/env node
/**
 * Verify all migration files have been applied to the live Supabase DB.
 *
 * Connects to Supabase via the service role key (server-side only, never
 * exposed to the client) and checks:
 *   1. The `supabase_migrations` table exists (Supabase tracks applied
 *      migrations there automatically when `supabase db push` is used).
 *   2. Every file in supabase/migrations/ has a corresponding row in
 *      supabase_migrations with version matching the file's numeric prefix.
 *   3. No migration file is missing from the live DB (unapplied).
 *
 * Exit codes:
 *   0 = all migrations applied (or Supabase not configured → skip)
 *   1 = drift detected (some migrations not applied)
 *   2 = script error (e.g. network failure, missing env vars)
 *
 * Usage:
 *   node scripts/check-migrations.mjs
 *
 * CI: wire into the `quality` job. Drift means the deployment will fail
 * on first write with cryptic "function upsert_with_audit does not exist"
 * errors — better to catch it at deploy time than at user-time.
 *
 * Env vars required:
 *   NEXT_PUBLIC_SUPABASE_URL      — project URL
 *   SUPABASE_SERVICE_ROLE_KEY     — service role key (bypasses RLS)
 *
 * If either is missing, the script exits 0 with a warning (don't fail CI
 * for repos that haven't configured Supabase yet — the .env.example says
 * this is optional for demo mode).
 */

import { readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// ─── 1. Skip if Supabase isn't configured ──────────────────────────────────
// Demo mode (no env vars) is valid — don't fail CI. The .env.example
// documents Supabase as optional.
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.log('⚠ Supabase env vars not configured — skipping migration check.')
  console.log('  Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to enable.')
  process.exit(0)
}

// ─── 2. List local migration files ─────────────────────────────────────────
if (!existsSync(MIGRATIONS_DIR)) {
  console.error(`FATAL: ${MIGRATIONS_DIR} not found`)
  process.exit(2)
}

const localMigrations = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => {
    // Extract the 14-digit numeric prefix + the rest of the name.
    // The Supabase migrations table stores `version` as the 14-digit
    // prefix (string), and `name` as the full filename.
    const match = f.match(/^(\d{14})_(.+)$/)
    return match ? { file: f, version: match[1], name: match[2] } : { file: f, version: f, name: f }
  })

console.log(`Found ${localMigrations.length} local migration files.`)

// ─── 3. Fetch applied migrations from the live DB ──────────────────────────
// The supabase_migrations table is created by the Supabase CLI when
// `supabase db push` runs. It tracks (version, name, statements, migrations).
// We read it via the REST API (PostgREST) so we don't need a postgres client.
//
// The service role key bypasses RLS so we can read the table even though
// it's not in the public API allowlist.

const migrationsTableUrl = `${SUPABASE_URL}/rest/v1/supabase_migrations?select=version,name&order=version.asc&limit=1000`

let appliedMigrations
try {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000) // 10s budget
  const res = await fetch(migrationsTableUrl, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Accept: 'application/json',
    },
    signal: controller.signal,
  })
  clearTimeout(timeout)

  if (!res.ok) {
    if (res.status === 404) {
      // The supabase_migrations table doesn't exist — means `supabase db push`
      // was never run on this DB. Treat as: zero migrations applied.
      console.error('✖ supabase_migrations table not found on the live DB.')
      console.error('  Run `supabase db push` to apply migrations, then re-run this check.')
      process.exit(1)
    }
    const bodyText = await res.text().catch(() => '<no body>')
    console.error(`✖ Failed to fetch supabase_migrations: HTTP ${res.status}`)
    console.error(`  ${bodyText.slice(0, 200)}`)
    process.exit(2)
  }
  appliedMigrations = await res.json()
} catch (e) {
  console.error(
    `✖ Network error fetching supabase_migrations: ${e instanceof Error ? e.message : String(e)}`
  )
  console.error('  Is the Supabase URL reachable from this host?')
  process.exit(2)
}

if (!Array.isArray(appliedMigrations)) {
  console.error('✖ Unexpected response shape from supabase_migrations (not an array).')
  console.error(`  Got: ${JSON.stringify(appliedMigrations).slice(0, 200)}`)
  process.exit(2)
}

console.log(`Found ${appliedMigrations.length} applied migrations on the live DB.`)

// Build a lookup by version (the 14-digit prefix) for fast comparison.
const appliedByVersion = new Map()
for (const row of appliedMigrations) {
  if (row && typeof row.version === 'string') {
    appliedByVersion.set(row.version, row)
  }
}

// ─── 4. Compare ─────────────────────────────────────────────────────────────
let missing = 0
let extra = 0
const missingFiles = []
const extraApplied = []

for (const local of localMigrations) {
  if (!appliedByVersion.has(local.version)) {
    missing++
    missingFiles.push(local.file)
  }
}

// Also check for applied migrations that don't exist locally (a sign that
// someone applied a migration on the live DB but didn't commit the file).
const localVersions = new Set(localMigrations.map((m) => m.version))
for (const applied of appliedMigrations) {
  if (applied?.version && !localVersions.has(applied.version)) {
    extra++
    extraApplied.push(applied.version)
  }
}

// ─── 5. Also verify the upsert_with_audit allowlist matches the latest
// local migration (lightweight proxy for "is the schema current?").
// We don't query the function definition itself — instead we check that
// every table referenced in api-auth.ts TABLE_WRITE_ROLES has its row in
// the live information_schema. This catches the "migration 23 typo" class
// of bug where the migration ran but the function definition is broken.
//
// Skipped for now — adding it would require enumerating tables here and
// keeping the list in sync with api-auth.ts. The local-migrations-vs-applied
// check above is the main signal; deeper checks can come later.

console.log(`\n${'='.repeat(60)}`)
if (missing === 0 && extra === 0) {
  console.log(`✓ All ${localMigrations.length} migrations are applied to the live DB.`)
  process.exit(0)
}

if (missing > 0) {
  console.error(`✖ ${missing} migration(s) NOT applied to the live DB:`)
  for (const f of missingFiles) {
    console.error(`    - ${f}`)
  }
  console.error('')
  console.error('  Run `supabase db push` to apply the missing migrations.')
}

if (extra > 0) {
  console.warn(`⚠ ${extra} migration(s) applied to the live DB but not in the local files:`)
  for (const v of extraApplied) {
    console.warn(`    - ${v}`)
  }
  console.warn('')
  console.warn('  Someone applied a migration directly to the DB without committing the file.')
  console.warn('  Either commit the migration file or roll back the live DB.')
}

process.exit(missing > 0 ? 1 : 0)
