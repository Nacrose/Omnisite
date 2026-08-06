#!/usr/bin/env node
/**
 * Backup all OmniSite business tables to a JSON file.
 *
 * Connects to Supabase via the service role key (server-side only, bypasses
 * RLS so we get every row regardless of project membership) and dumps every
 * business table listed in api-auth.ts to a timestamped JSON file under
 * backups/.
 *
 * The output is a single self-contained JSON file:
 *   backups/omnisite-backup-YYYY-MM-DDTHH-MM-SS.json
 *
 * Structure:
 *   {
 *     "metadata": {
 *       "createdAt": "2026-08-06T07:30:00.000Z",
 *       "supabaseUrl": "https://xxx.supabase.co",
 *       "tableCount": 21,
 *       "rowCount": 4523,
 *       "schemaVersion": "29 migrations"
 *     },
 *     "tables": {
 *       "boq_items": [{...}, {...}],
 *       "tasks": [...],
 *       ...
 *     }
 *   }
 *
 * Restore: there is no built-in restore — the JSON is human-readable and
 * can be loaded into a fresh Supabase project via a one-off script. The
 * README documents the manual restore process.
 *
 * Why JSON and not pg_dump?
 *   - pg_dump requires direct postgres access (not available on Vercel).
 *   - The Supabase Dashboard has its own pg_dump UI for full DB backups.
 *   - This script covers the "I want to export my project data to a file"
 *     use case from the operator's laptop or CI, without elevated DB access.
 *
 * Exit codes:
 *   0 = backup succeeded
 *   1 = partial failure (some tables errored, but at least one succeeded)
 *   2 = script error (e.g. env vars missing, network failure before any
 *       table could be backed up)
 *
 * Usage:
 *   node scripts/backup.mjs                       # all tables
 *   node scripts/backup.mjs --out custom.json    # custom output path
 *   node scripts/backup.mjs --table boq_items     # only one table
 *
 * Env vars required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Cron (Vercel):
 *   Add to vercel.json crons[].path = '/api/cron/backup' (a separate
 *   endpoint that calls this script via child_process.execSync). Daily
 *   frequency recommended. Out of scope for this commit — see P1-17.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const BACKUPS_DIR = join(ROOT, 'backups')

// ─── CLI args ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
let customOut
let onlyTable
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out' && argv[i + 1]) {
    customOut = argv[++i]
  } else if (argv[i] === '--table' && argv[i + 1]) {
    onlyTable = argv[++i]
  } else if (argv[i] === '--help' || argv[i] === '-h') {
    console.log('Usage: node scripts/backup.mjs [--out path] [--table name]')
    console.log('')
    console.log('Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(0)
  }
}

// ─── Env vars ───────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✖ Supabase env vars not configured.')
  console.error('  Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  console.error('  (Demo mode is not supported — there is no DB to back up.)')
  process.exit(2)
}

// ─── Tables to back up ──────────────────────────────────────────────────────
// Mirrors the allowlist in api-auth.ts TABLE_WRITE_ROLES + PROJECT_SCOPED_TABLES
// (excluding user_projects which would leak auth.users UUIDs — back it up
// separately if needed for user-role restoration). audit_log is excluded
// because it grows unbounded and is more useful as a per-record diff log
// than a full backup; restore the audit_log from the source DB if needed.
const TABLES = [
  'projects',
  'boq_items',
  'tasks',
  'dsr_entries',
  'cbs_nodes',
  'requisitions',
  'purchase_orders',
  'drawings',
  'letters',
  'qs_items',
  'equipment',
  'subcontractors',
  'workers',
  'chat_messages',
  'grns',
  'stock_items',
  'vendors',
  'project_locations',
  'drawing_annotations',
  'rfis',
  'material_issue_notes',
]

if (onlyTable) {
  if (!TABLES.includes(onlyTable)) {
    console.error(`✖ Unknown table: ${onlyTable}`)
    console.error(`  Valid tables: ${TABLES.join(', ')}`)
    process.exit(2)
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
async function fetchTable(name) {
  // PostgREST pagination — 1000 rows per page, walk until empty.
  // The service role bypasses RLS, so we get every row regardless of
  // project membership.
  const allRows = []
  let offset = 0
  const PAGE_SIZE = 1000
  let page = 0
  // Hard cap to prevent an infinite loop if a misconfigured DB returns
  // the same page forever. 100 pages × 1000 rows = 100k row ceiling per
  // table — adjust if a real project exceeds this.
  const MAX_PAGES = 100

  while (page < MAX_PAGES) {
    const url = `${SUPABASE_URL}/rest/v1/${name}?select=*&limit=${PAGE_SIZE}&offset=${offset}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000) // 30s per page
    try {
      const res = await fetch(url, {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Accept: 'application/json',
          // PostgREST returns total row count in this header when
          // Prefer: count=exact is set. Useful for progress reporting.
          Prefer: 'count=exact',
        },
        signal: controller.signal,
      })
      clearTimeout(timeout)

      if (!res.ok) {
        const bodyText = await res.text().catch(() => '<no body>')
        throw new Error(`HTTP ${res.status}: ${bodyText.slice(0, 200)}`)
      }

      const rows = await res.json()
      if (!Array.isArray(rows)) {
        throw new Error('response is not an array')
      }
      if (rows.length === 0) break
      allRows.push(...rows)
      if (rows.length < PAGE_SIZE) break // last page
      offset += PAGE_SIZE
      page++
    } catch (e) {
      clearTimeout(timeout)
      throw e
    }
  }
  return allRows
}

// ─── Run ────────────────────────────────────────────────────────────────────
console.log(`OmniSite backup`)
console.log(`  URL:   ${SUPABASE_URL}`)
console.log(`  Key:   ${SERVICE_KEY.slice(0, 12)}...${SERVICE_KEY.slice(-4)}`)
console.log(`  Tables: ${onlyTable ? onlyTable : TABLES.length + ' (all)'}`)
console.log('')

if (!existsSync(BACKUPS_DIR)) {
  mkdirSync(BACKUPS_DIR, { recursive: true })
}

const tables = onlyTable ? [onlyTable] : TABLES
const result = {
  metadata: {
    createdAt: new Date().toISOString(),
    supabaseUrl: SUPABASE_URL,
    tableCount: tables.length,
    rowCount: 0,
    schemaVersion: 'see supabase/migrations/',
  },
  tables: {},
}

const errors = []
for (const table of tables) {
  process.stdout.write(`  ${table.padEnd(28)} `)
  try {
    const rows = await fetchTable(table)
    result.tables[table] = rows
    result.metadata.rowCount += rows.length
    console.log(`✓ ${rows.length} rows`)
  } catch (e) {
    console.log(`✖ ${e instanceof Error ? e.message : String(e)}`)
    errors.push({ table, error: e instanceof Error ? e.message : String(e) })
  }
}

// ─── Write the backup file ─────────────────────────────────────────────────
const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const outPath = customOut || join(BACKUPS_DIR, `omnisite-backup-${timestamp}.json`)
writeFileSync(outPath, JSON.stringify(result, null, 2))
console.log('')
console.log(`✓ Backup written: ${outPath}`)
console.log(`  ${result.metadata.rowCount} rows across ${tables.length} tables`)

if (errors.length > 0) {
  console.error('')
  console.error(`⚠ ${errors.length} table(s) failed:`)
  for (const { table, error } of errors) {
    console.error(`    - ${table}: ${error}`)
  }
  process.exit(1)
}
process.exit(0)
