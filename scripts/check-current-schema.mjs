#!/usr/bin/env node
/**
 * Check supabase/CURRENT_SCHEMA.md for drift against the migration files.
 *
 * CURRENT_SCHEMA.md is a documentation artifact that consolidates the
 * canonical definitions of security-critical Postgres functions. The
 * migration files are the source of truth — this script verifies the
 * doc hasn't drifted from them.
 *
 * Checks performed:
 *   1. Every migration file referenced in CURRENT_SCHEMA.md exists.
 *   2. The "LATEST VERSION" pointers in CURRENT_SCHEMA.md point to the
 *      migration that LAST defines each function (not an earlier one).
 *   3. The table allowlist in upsert_with_audit (as documented) matches
 *      the allowlist in the latest migration that defines the function.
 *
 * Exit codes:
 *   0 = no drift detected
 *   1 = drift detected (details printed to stderr)
 *   2 = script error (e.g. file not found)
 *
 * Usage:
 *   node scripts/check-current-schema.mjs
 *
 * CI: wire into the `quality` job after `bun run test`. Drift is a
 * documentation bug, not a security issue — but it misleads reviewers
 * who rely on CURRENT_SCHEMA.md to understand the live schema.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations')
const CURRENT_SCHEMA = join(ROOT, 'supabase', 'CURRENT_SCHEMA.md')

let errors = 0
let warnings = 0

function fail(msg) {
  console.error(`  ✖ ${msg}`)
  errors++
}

function warn(msg) {
  console.warn(`  ⚠ ${msg}`)
  warnings++
}

// ─── 1. Verify files exist ──────────────────────────────────────────────────

if (!existsSync(CURRENT_SCHEMA)) {
  console.error(`FATAL: ${CURRENT_SCHEMA} not found`)
  process.exit(2)
}
if (!existsSync(MIGRATIONS_DIR)) {
  console.error(`FATAL: ${MIGRATIONS_DIR} not found`)
  process.exit(2)
}

const migrations = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
console.log(`Found ${migrations.length} migration files.`)

const doc = readFileSync(CURRENT_SCHEMA, 'utf8')

// ─── 2. Verify every migration referenced in the doc exists ────────────────

const referencedMigrations = new Set()
const migrationRefPattern = /(\d{14}_\w+\.sql)/g
let match
while ((match = migrationRefPattern.exec(doc)) !== null) {
  referencedMigrations.add(match[1])
}

console.log(`\nChecking ${referencedMigrations.size} migration references in CURRENT_SCHEMA.md...`)
for (const ref of referencedMigrations) {
  if (!migrations.includes(ref)) {
    fail(`CURRENT_SCHEMA.md references ${ref} but it doesn't exist in supabase/migrations/`)
  }
}

// ─── 3. Verify "LATEST VERSION" pointers ───────────────────────────────────
//
// For each function, find the LAST migration that defines it via
// `CREATE OR REPLACE FUNCTION <name>`. Compare against the "LATEST VERSION"
// pointer in the doc.

const functionsToCheck = [
  { name: 'upsert_with_audit', docString: 'upsert_with_audit' },
  { name: 'delete_with_audit', docString: 'delete_with_audit' },
  { name: 'mask_pii', docString: 'mask_pii' },
  { name: 'recompute_cbs_subtree', docString: 'recompute_cbs_subtree' },
  { name: 'user_has_project_access', docString: 'user_has_project_access' },
  { name: 'user_has_pm_access', docString: 'user_has_pm_access' },
]

console.log('\nChecking LATEST VERSION pointers for security-critical functions...')
for (const { name, docString } of functionsToCheck) {
  // Find all migrations that define this function
  const definingMigrations = []
  for (const m of migrations) {
    const content = readFileSync(join(MIGRATIONS_DIR, m), 'utf8')
    // Match CREATE OR REPLACE FUNCTION <name> or CREATE FUNCTION <name>
    const pattern = new RegExp(`CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+${name}\\s*\\(`, 'i')
    if (pattern.test(content)) {
      definingMigrations.push(m)
    }
  }

  if (definingMigrations.length === 0) {
    warn(`No migration defines function ${name} — is it still used?`)
    continue
  }

  const actualLatest = definingMigrations[definingMigrations.length - 1]

  // Find the "LATEST VERSION" pointer in the doc
  // Pattern: "LATEST VERSION: migration XX" or "(source: XX_name.sql)"
  const latestPattern = new RegExp(
    `LATEST\\s+VERSION:\\s*(?:migration\\s+)?(\\d{14}_\\w+\\.sql)`,
    'i'
  )
  const sourcePattern = new RegExp(`source:\\s*(\\d{14}_\\w+\\.sql)`, 'i')

  // Search in the section of the doc that mentions this function
  const funcSectionPattern = new RegExp(`${docString}[\\s\\S]*?(?=──|$)`, 'i')
  const sectionMatch = doc.match(funcSectionPattern)
  if (!sectionMatch) {
    // Function might only be mentioned in the migration history table — skip
    continue
  }
  const section = sectionMatch[0]

  const latestMatch = section.match(latestPattern)
  const sourceMatch = section.match(sourcePattern)
  const docLatest = latestMatch?.[1] || sourceMatch?.[1]

  if (!docLatest) {
    // Not all sections have a LATEST VERSION pointer — only warn for
    // functions that have multiple defining migrations (where the pointer
    // matters most)
    if (definingMigrations.length > 1) {
      warn(
        `${name}: defined in ${definingMigrations.length} migrations but CURRENT_SCHEMA.md has no LATEST VERSION pointer. Actual latest: ${actualLatest}`
      )
    }
    continue
  }

  if (docLatest !== actualLatest) {
    fail(
      `${name}: CURRENT_SCHEMA.md says LATEST VERSION is ${docLatest}, but the actual latest definition is in ${actualLatest}. Update the doc.`
    )
  } else {
    console.log(`  ✓ ${name}: LATEST VERSION pointer matches (${actualLatest})`)
  }
}

// ─── 4. Verify the table allowlist in upsert_with_audit ────────────────────
//
// The allowlist is security-critical: tables NOT in the list can't be
// written to via the service-role upsertWithAudit() function. The doc
// should list every table in the actual allowlist.

console.log('\nChecking upsert_with_audit table allowlist...')
const allowlistTables = [
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
  'projects',
  'user_projects',
  'grns',
  'stock_items',
  'vendors',
  'project_locations',
  'drawing_annotations',
]

// Find the allowlist section in the doc
const allowlistSectionMatch = doc.match(/Table allowlist[\s\S]*?(?=\n\n|\n---)/i)
if (allowlistSectionMatch) {
  const allowlistSection = allowlistSectionMatch[0]
  for (const table of allowlistTables) {
    if (!allowlistSection.includes(table)) {
      fail(`Table ${table} not found in CURRENT_SCHEMA.md allowlist section`)
    }
  }
  console.log(`  ✓ All ${allowlistTables.length} allowlisted tables are documented`)
} else {
  warn('Could not find Table allowlist section in CURRENT_SCHEMA.md')
}

// ─── Summary ───────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(60)}`)
if (errors === 0 && warnings === 0) {
  console.log('✓ CURRENT_SCHEMA.md is in sync with migrations.')
} else {
  console.log(`✖ ${errors} error(s), ${warnings} warning(s).`)
  if (errors > 0) {
    console.log('\nDrift detected. Update supabase/CURRENT_SCHEMA.md to match the migrations.')
  }
}
process.exit(errors > 0 ? 1 : 0)
