import type { Task } from './types'

/**
 * Resource leveling — a peak-smoothing heuristic.
 *
 * For each non-critical leaf task, finds the earliest start week (>= the
 * task's original start) where shifting the task there does not increase the
 * maximum weekly resource load. Critical tasks are never moved (they're on
 * the critical path; moving them delays the project).
 *
 * This is a simplified leveling pass:
 *  - Dependencies are NOT re-validated — but if a candidate shift would
 *    move a task to start BEFORE its FS predecessors finish, we skip that
 *    candidate. This prevents the most common dependency violation (audit
 *    S10). The caller should still re-run CPM after leveling to recompute
 *    float/critical flags.
 *  - "Resource load" = count of resource codes assigned to active tasks in
 *    that week (not headcount-weighted). This keeps the heuristic O(n*weeks).
 *  - Hammock / Summary / Milestone tasks are skipped (they don't consume
 *    resources directly).
 *  - Summary task `start` AND `duration` are recomputed after leveling so
 *    the summary bar visually covers its shifted children (audit S6 —
 *    previously only `start` was updated, leaving the summary bar
 *    disconnected from its children).
 *
 * Returns the leveled task tree (same shape as input), a log of shifts for
 * the UI to surface to the user, and a list of any dependency violations
 * that could not be avoided (e.g. a non-critical task whose original start
 * already violates an FS link — we don't move it further into violation).
 */
export interface LevelingShift {
  id: string
  name: string
  fromStart: number
  toStart: number
  deltaWeeks: number
}

export interface LevelingViolation {
  id: string
  name: string
  predecessorId: string
  predecessorFinish: number
  taskStart: number
  violationWeeks: number
}

export interface LevelingResult {
  leveledTasks: Task[]
  shifts: LevelingShift[]
  violations: LevelingViolation[]
  peakLoadBefore: number
  peakLoadAfter: number
}

/**
 * Compute the project horizon (in weeks) from the actual task tree.
 * Uses the latest (start + duration) across all tasks, with a minimum
 * of 52 weeks. This replaces the hardcoded `const TOTAL_WEEKS = 52`
 * that silently truncated any project longer than one year — the same
 * issue flagged in the very first audit and untouched through eight
 * rounds of scheduler work.
 *
 * The horizon is computed once per `levelResources` call (not per
 * render) so it's stable for the duration of the leveling pass.
 */
function computeHorizon(tasks: Task[]): number {
  let max = 52 // minimum floor — most projects are at least a year
  const walk = (items: Task[]) => {
    for (const t of items) {
      const finish = t.start + t.duration
      if (finish > max) max = finish
      if (t.children) walk(t.children)
    }
  }
  walk(tasks)
  // Add a small buffer (4 weeks) so the leveling candidate-shift loop
  // has room to shift tasks forward past the current project end.
  return max + 4
}

function flattenLeaves(tasks: Task[]): Task[] {
  const out: Task[] = []
  const walk = (items: Task[]) => {
    for (const t of items) {
      if (t.children && t.children.length > 0) {
        walk(t.children)
      } else if (t.type === 'Work' || t.type === 'Hammock') {
        // Include Hammock tasks in the leaf set — they have durations and
        // resources (e.g. seed T-301 has resources: ['L-3']), so their
        // load contributes to the weekly peak. Previously only Work tasks
        // were included, so Hammock resources were invisible to leveling
        // (audit R6-2). Hammock tasks are still NOT shift candidates
        // (they're anchored to other tasks), but their load is counted.
        out.push(t)
      }
    }
  }
  walk(tasks)
  return out
}

function weeklyLoad(leaves: Task[], horizon: number): number[] {
  const load = new Array(horizon).fill(0)
  for (const t of leaves) {
    // Null guard: rows loaded from Supabase (or a freshly-seeded Task tree
    // without resources populated) may have `resources === undefined`.
    // `t.resources.length` would throw "Cannot read properties of
    // undefined (reading 'length')" — see H4 in the audit. Coalescing to
    // [] makes the load contribution zero, which is correct (no resources
    // means no peak contribution).
    const resources = t.resources ?? []
    for (let w = t.start; w < t.start + t.duration && w < horizon; w++) {
      load[w] += resources.length
    }
  }
  return load
}

/**
 * For each leaf task with FS dependencies, compute the latest finish week
 * of all its FS predecessors. A candidate start is only valid if it's >=
 * this value (FS = successor starts after predecessor finishes).
 *
 * SS/FF/SF links are intentionally NOT enforced here — the leveling
 * heuristic would need full CPM data to validate them, and we want to
 * keep leveling O(n*weeks). The CPM re-run after leveling will surface
 * any remaining violations as negative float.
 */
function buildFsPredecessorFinishMap(
  leaves: Task[]
): Map<string, { predecessorId: string; finish: number }[]> {
  const taskById = new Map<string, Task>()
  for (const l of leaves) taskById.set(l.id, l)
  const m = new Map<string, { predecessorId: string; finish: number }[]>()
  for (const l of leaves) {
    if (!l.dependencies) continue
    const fsPreds: { predecessorId: string; finish: number }[] = []
    for (const dep of l.dependencies) {
      if ((dep.linkType || 'FS') !== 'FS') continue
      const pred = taskById.get(dep.predecessorId)
      if (!pred) continue // predecessor not in our leaf set (e.g. Summary) — skip
      const predFinish = pred.start + pred.duration + (dep.lagWeeks || 0)
      fsPreds.push({ predecessorId: pred.id, finish: predFinish })
    }
    if (fsPreds.length > 0) m.set(l.id, fsPreds)
  }
  return m
}

export function levelResources(tasks: Task[]): LevelingResult {
  // Compute the project horizon dynamically from the task tree so
  // projects longer than 52 weeks aren't silently truncated (the
  // hardcoded `TOTAL_WEEKS = 52` was flagged in the first audit and
  // survived eight rounds — now fixed).
  const horizon = computeHorizon(tasks)
  const leaves = flattenLeaves(tasks)
  const loadBefore = weeklyLoad(leaves, horizon)
  const peakBefore = Math.max(1, ...loadBefore)

  // Map each leaf to its FS predecessors' finish weeks so we can reject
  // candidate shifts that would violate FS dependencies (audit S10).
  const fsPredFinishMap = buildFsPredecessorFinishMap(leaves)

  // Work on a mutable copy of leaves (shallow clone each leaf so we can
  // reassign .start without mutating the input).
  const workLeaves = leaves.map((l) => ({ ...l }))

  // Sort by start week ascending so earlier tasks get first dibs on their
  // optimal slot. Critical tasks stay put.
  workLeaves.sort((a, b) => a.start - b.start)

  const shifts: LevelingShift[] = []
  const violations: LevelingViolation[] = []

  // Build a quick id → workLeaf map so we can read the latest predecessor
  // finish as we iterate (predecessors may have been shifted earlier in
  // the loop, so we re-read on every candidate).
  const workLeafById = new Map(workLeaves.map((l) => [l.id, l]))

  for (const leaf of workLeaves) {
    if (leaf.critical) continue
    if (leaf.duration === 0) continue // milestone-like
    // Only Work tasks are shift candidates. Hammock tasks are anchored to
    // other tasks (their duration is quantity-driven, not time-driven), so
    // shifting them would break their semantic meaning. They're in the
    // leaf set only so their resources contribute to the weekly load
    // (audit R6-2).
    if (leaf.type !== 'Work') continue

    const originalStart = leaf.start
    let bestStart = originalStart
    let bestPeak = peakBefore

    // FS predecessor finish constraint — candidate start must be >= this.
    // (Re-read on every candidate because a predecessor earlier in the
    // loop may have shifted.)
    const fsPreds = fsPredFinishMap.get(leaf.id) || []

    // Try shifting forward by 0..8 weeks (bounded to avoid infinite loops
    // and to respect the project horizon).
    for (let delta = 0; delta <= 8; delta++) {
      const candidateStart = originalStart + delta
      if (candidateStart + leaf.duration > horizon) break

      // Reject candidates that would violate any FS dependency.
      // (SS/FF/SF not enforced — see buildFsPredecessorFinishMap comment.)
      let violates = false
      for (const pred of fsPreds) {
        const predLeaf = workLeafById.get(pred.predecessorId)
        const predFinish = predLeaf != null ? predLeaf.start + predLeaf.duration : pred.finish
        if (candidateStart < predFinish) {
          violates = true
          break
        }
      }
      if (violates) continue

      // Temporarily move the leaf, recompute load, find the new peak.
      leaf.start = candidateStart
      const candidateLoad = weeklyLoad(workLeaves, horizon)
      const candidatePeak = Math.max(...candidateLoad)

      // Prefer the candidate if it strictly reduces the peak, or matches the
      // peak but shifts fewer weeks (delta=0 wins ties).
      if (candidatePeak < bestPeak || (candidatePeak === bestPeak && delta === 0)) {
        bestPeak = candidatePeak
        bestStart = candidateStart
      }
    }

    leaf.start = bestStart

    // Check for REMAINING violations post-leveling (audit R3-4 —
    // previously we checked originalStart BEFORE the candidate loop, so
    // violations that leveling fixed were still reported in the toast.
    // Now we check bestStart AFTER the candidate loop, so only violations
    // that leveling could NOT fix are reported.)
    for (const pred of fsPreds) {
      const predLeaf = workLeafById.get(pred.predecessorId)
      const predFinish = predLeaf != null ? predLeaf.start + predLeaf.duration : pred.finish
      if (bestStart < predFinish) {
        violations.push({
          id: leaf.id,
          name: leaf.name,
          predecessorId: pred.predecessorId,
          predecessorFinish: predFinish,
          taskStart: bestStart,
          violationWeeks: predFinish - bestStart,
        })
      }
    }

    if (bestStart !== originalStart) {
      shifts.push({
        id: leaf.id,
        name: leaf.name,
        fromStart: originalStart,
        toStart: bestStart,
        deltaWeeks: bestStart - originalStart,
      })
    }
  }

  const loadAfter = weeklyLoad(workLeaves, horizon)
  const peakAfter = Math.max(...loadAfter)

  // Dedup violations by task id — if a task has multiple FS predecessors
  // and more than one violates, we'd get multiple entries for the same
  // task. Keep only the worst (largest violationWeeks) per task so the
  // toast's "N violations" count matches the number of distinct tasks
  // the user needs to fix (audit R4-6).
  const worstPerTask = new Map<string, LevelingViolation>()
  for (const v of violations) {
    const existing = worstPerTask.get(v.id)
    if (!existing || v.violationWeeks > existing.violationWeeks) {
      worstPerTask.set(v.id, v)
    }
  }
  const dedupedViolations = Array.from(worstPerTask.values())

  // Rebuild the task tree with the updated start weeks. We walk the original
  // tree and replace leaf starts from the workLeaves map.
  const leafStarts = new Map(workLeaves.map((l) => [l.id, l.start]))
  const rebuild = (items: Task[]): Task[] =>
    items.map((t) => {
      if (t.children && t.children.length > 0) {
        const newChildren = rebuild(t.children)
        // Summary start = min child start, duration = max child finish −
        // min child start (audit S6 — previously only `start` was updated,
        // leaving the summary bar visually disconnected from its children
        // after leveling shifted them).
        const minChildStart = Math.min(...newChildren.map((c) => c.start))
        const maxChildFinish = Math.max(...newChildren.map((c) => c.start + c.duration))
        return {
          ...t,
          start: minChildStart,
          duration: Math.max(0, maxChildFinish - minChildStart),
          children: newChildren,
        }
      }
      const newStart = leafStarts.get(t.id) ?? t.start
      return { ...t, start: newStart }
    })

  const leveledTasks = rebuild(tasks)
  return {
    leveledTasks,
    shifts,
    violations: dedupedViolations,
    peakLoadBefore: peakBefore,
    peakLoadAfter: peakAfter,
  }
}
