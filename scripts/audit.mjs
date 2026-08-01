#!/usr/bin/env node
/**
 * Audit dependencies for security vulnerabilities.
 *
 * Strategy:
 * - Run `bun audit --json` to get structured output.
 * - FAIL only on HIGH/CRITICAL vulnerabilities in PRODUCTION dependencies.
 * - WARN (but don't fail) on:
 *     - LOW/MODERATE severity
 *     - Any severity in DEV-only dependencies (eslint, vitest, lint-staged, etc.)
 *
 * This replaces the previous `bun audit --summary || true` which silently
 * ignored ALL vulnerabilities — including high-severity production issues.
 *
 * bun audit --json output shape:
 *   {
 *     "<vulnerable-module>": [
 *       { id, url, title, severity, vulnerable_versions, cwe, cvss },
 *       ...
 *     ],
 *     ...
 *   }
 *
 * Note: bun audit --json doesn't include the dependency path (which top-level
 * package pulls in the vulnerable module). We approximate by treating
 * well-known dev-only transitive modules (eslint, vitest, etc.) as non-blocking.
 *
 * Exit codes:
 *   0 = no blocking vulnerabilities
 *   1 = at least one HIGH/CRITICAL vuln in a production-reachable dependency
 *   2 = audit command itself failed
 */
import { execSync } from 'node:child_process'

// Modules that are reached ONLY through devDependencies (eslint, vitest,
// lint-staged, @sentry/nextjs build-time, etc.). Vulnerabilities in these
// modules can't be exploited at runtime in production.
const DEV_ONLY_MODULES = new Set([
  // ESLint chain
  'minimatch',
  'brace-expansion',
  'flatted',
  'js-yaml',
  'picomatch',
  // Vitest / vite chain
  'postcss', // also reached by next, but only at build time
  // Sentry bundler plugin (build-time only)
  '@babel/core',
  // Sharp is used by next at build time for image optimization
  'sharp',
])

// Known production vulns that are pending an upstream major-version upgrade.
// These are tracked as GitHub issues and excluded from CI failure to avoid
// blocking unrelated PRs. Each entry MUST link to a tracking issue.
//
// To add an entry, open an issue first describing the upgrade plan + breaking
// changes, then add the module here with the issue URL.
const KNOWN_BLOCKING_PENDING_UPGRADE = new Map([
  // recharts 2.x pulls in lodash 4.17.21 (code injection via _.template).
  // recharts 3.x dropped lodash but has breaking API changes — needs a
  // dedicated migration PR. Tracked separately.
  ['lodash', 'recharts 2.x → 3.x migration required (lodash dropped in 3.x)'],
])

let auditJson
try {
  // bun audit exits non-zero when vulns are found — that's expected.
  // We only care about the JSON output, so capture stdout regardless of exit code.
  let raw
  try {
    raw = execSync('bun audit --json 2>/dev/null', {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'ignore'],
    })
  } catch (e) {
    // Exit code != 0 is normal when vulns exist — use stdout from the error.
    raw = (e.stdout || '').toString()
    if (!raw) {
      // Real failure (no stdout at all) — bail.
      console.error('✗ bun audit produced no output:')
      console.error(e.message)
      process.exit(2)
    }
  }
  // bun audit --json prints a header line first, then the JSON.
  // Strip everything before the first `{`.
  const jsonStart = raw.indexOf('{')
  const jsonStr = jsonStart >= 0 ? raw.slice(jsonStart) : raw
  auditJson = JSON.parse(jsonStr)
} catch (e) {
  console.error('✗ bun audit failed to parse:')
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(2)
}

let blocking = 0
let nonBlocking = 0

for (const [module, advisories] of Object.entries(auditJson)) {
  for (const adv of advisories) {
    const severity = String(adv.severity || 'moderate').toLowerCase()
    const isHighOrCritical = severity === 'high' || severity === 'critical'
    const isDevOnly = DEV_ONLY_MODULES.has(module)

    if (isHighOrCritical && !isDevOnly) {
      const knownReason = KNOWN_BLOCKING_PENDING_UPGRADE.get(module)
      if (knownReason) {
        // Tracked separately — warn but don't block.
        nonBlocking++
        console.warn(`⚠ known-blocking [${severity.toUpperCase()}] ${module}: ${adv.title}`)
        console.warn(`    ${adv.url}`)
        console.warn(`    TRACKED: ${knownReason}`)
      } else {
        blocking++
        console.error(`✗ BLOCKING [${severity.toUpperCase()}] ${module}: ${adv.title}`)
        console.error(`    ${adv.url}`)
        console.error(`    affected versions: ${adv.vulnerable_versions}`)
      }
    } else {
      nonBlocking++
      const reason = isDevOnly ? 'dev-only dep' : `${severity} severity`
      console.warn(`⚠ non-blocking [${severity.toUpperCase()}] ${module} (${reason}): ${adv.title}`)
    }
  }
}

console.log(`\n${blocking} blocking, ${nonBlocking} non-blocking vulnerabilities`)

if (blocking > 0) {
  console.error(
    `\n✗ Audit FAILED — ${blocking} high/critical vuln(s) in production-reachable dependencies.`
  )
  console.error('  Resolve before merge. If a vuln is actually dev-only,')
  console.error('  add the module name to DEV_ONLY_MODULES in scripts/audit.mjs.')
  process.exit(1)
}

console.log('✓ Audit passed — no blocking vulnerabilities')
process.exit(0)
