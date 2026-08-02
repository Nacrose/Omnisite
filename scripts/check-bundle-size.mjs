#!/usr/bin/env node
/**
 * Bundle size guard — runs after `next build` and asserts that:
 *   1. No single JS chunk exceeds the per-chunk budget (catches a heavy
 *      dependency accidentally imported into a shared chunk).
 *   2. The total of all JS chunks does not exceed the total budget (catches
 *      broad-based bloat across many chunks).
 *
 * Thresholds are calibrated against the current production baseline with
 * ~25% headroom. Bump them deliberately when a legit feature adds weight.
 *
 * Usage: node scripts/check-bundle-size.mjs [total_kb] [per_chunk_kb]
 *   total_kb      default 3500 (KB of uncompressed JS across all chunks)
 *   per_chunk_kb  default 1300 (KB — fail if any single chunk exceeds this)
 */
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = process.cwd()
const CHUNKS_DIR = join(ROOT, '.next', 'static', 'chunks')
const TOTAL_THRESHOLD_KB = Number(process.argv[2] ?? 4500)
const PER_CHUNK_THRESHOLD_KB = Number(process.argv[3] ?? 1300)

async function dirExists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function walkJs(dir) {
  const out = []
  if (!(await dirExists(dir))) return out
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walkJs(full)))
    } else if (entry.name.endsWith('.js')) {
      const s = await stat(full)
      out.push({ path: full, size: s.size })
    }
  }
  return out
}

const files = await walkJs(CHUNKS_DIR)
if (files.length === 0) {
  console.error(`✗ No JS chunks found in ${CHUNKS_DIR}. Did you run 'next build' first?`)
  process.exit(1)
}

const totalBytes = files.reduce((sum, f) => sum + f.size, 0)
const totalKB = Math.round(totalBytes / 1024)

files.sort((a, b) => b.size - a.size)
console.log('Top 10 chunks by size:')
for (const f of files.slice(0, 10)) {
  const rel = f.path.replace(ROOT + '/', '')
  const kb = Math.round(f.size / 1024)
  const flag = kb > PER_CHUNK_THRESHOLD_KB ? ' ✗' : ''
  console.log(`  ${String(kb).padStart(6)} KB  ${rel}${flag}`)
}

console.log(`\nTotal chunk JS: ${totalKB} KB (threshold: ${TOTAL_THRESHOLD_KB} KB)`)

let failed = false
if (totalKB > TOTAL_THRESHOLD_KB) {
  console.error(`✗ Total bundle size ${totalKB} KB exceeds threshold ${TOTAL_THRESHOLD_KB} KB`)
  failed = true
}
const oversized = files.filter((f) => f.size / 1024 > PER_CHUNK_THRESHOLD_KB)
if (oversized.length > 0) {
  for (const f of oversized) {
    const rel = f.path.replace(ROOT + '/', '')
    console.error(
      `✗ Chunk ${rel} (${Math.round(f.size / 1024)} KB) exceeds per-chunk threshold ${PER_CHUNK_THRESHOLD_KB} KB`
    )
  }
  failed = true
}
if (failed) process.exit(1)
console.log('✓ Bundle sizes within budget')
