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
 *  - Dependencies are NOT re-validated (the caller should re-run CPM after).
 *  - "Resource load" = count of resource codes assigned to active tasks in
 *    that week (not headcount-weighted). This keeps the heuristic O(n*weeks).
 *  - Hammock / Summary / Milestone tasks are skipped (they don't consume
 *    resources directly).
 *
 * Returns the leveled task tree (same shape as input) and a log of shifts
 * for the UI to surface to the user.
 */
export interface LevelingShift {
  id: string
  name: string
  fromStart: number
  toStart: number
  deltaWeeks: number
}

export interface LevelingResult {
  leveledTasks: Task[]
  shifts: LevelingShift[]
  peakLoadBefore: number
  peakLoadAfter: number
}

const TOTAL_WEEKS = 52

function flattenLeaves(tasks: Task[]): Task[] {
  const out: Task[] = []
  const walk = (items: Task[]) => {
    for (const t of items) {
      if (t.children && t.children.length > 0) {
        walk(t.children)
      } else if (t.type === 'Work') {
        out.push(t)
      }
    }
  }
  walk(tasks)
  return out
}

function weeklyLoad(leaves: Task[]): number[] {
  const load = new Array(TOTAL_WEEKS).fill(0)
  for (const t of leaves) {
    for (let w = t.start; w < t.start + t.duration && w < TOTAL_WEEKS; w++) {
      load[w] += t.resources.length
    }
  }
  return load
}

export function levelResources(tasks: Task[]): LevelingResult {
  const leaves = flattenLeaves(tasks)
  const loadBefore = weeklyLoad(leaves)
  const peakBefore = Math.max(1, ...loadBefore)

  // Work on a mutable copy of leaves (shallow clone each leaf so we can
  // reassign .start without mutating the input).
  const workLeaves = leaves.map((l) => ({ ...l }))

  // Sort by start week ascending so earlier tasks get first dibs on their
  // optimal slot. Critical tasks stay put.
  workLeaves.sort((a, b) => a.start - b.start)

  const shifts: LevelingShift[] = []

  for (const leaf of workLeaves) {
    if (leaf.critical) continue
    if (leaf.duration === 0) continue // milestone-like

    const originalStart = leaf.start
    let bestStart = originalStart
    let bestPeak = peakBefore

    // Try shifting forward by 0..8 weeks (bounded to avoid infinite loops
    // and to respect the project horizon).
    for (let delta = 0; delta <= 8; delta++) {
      const candidateStart = originalStart + delta
      if (candidateStart + leaf.duration > TOTAL_WEEKS) break

      // Temporarily move the leaf, recompute load, find the new peak.
      leaf.start = candidateStart
      const candidateLoad = weeklyLoad(workLeaves)
      const candidatePeak = Math.max(...candidateLoad)

      // Prefer the candidate if it strictly reduces the peak, or matches the
      // peak but shifts fewer weeks (delta=0 wins ties).
      if (candidatePeak < bestPeak || (candidatePeak === bestPeak && delta === 0)) {
        bestPeak = candidatePeak
        bestStart = candidateStart
      }
    }

    leaf.start = bestStart
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

  const loadAfter = weeklyLoad(workLeaves)
  const peakAfter = Math.max(...loadAfter)

  // Rebuild the task tree with the updated start weeks. We walk the original
  // tree and replace leaf starts from the workLeaves map.
  const leafStarts = new Map(workLeaves.map((l) => [l.id, l.start]))
  const rebuild = (items: Task[]): Task[] =>
    items.map((t) => {
      if (t.children && t.children.length > 0) {
        const newChildren = rebuild(t.children)
        // Summary start = min child start.
        const minChildStart = Math.min(...newChildren.map((c) => c.start))
        return { ...t, start: minChildStart, children: newChildren }
      }
      const newStart = leafStarts.get(t.id) ?? t.start
      return { ...t, start: newStart }
    })

  const leveledTasks = rebuild(tasks)
  return {
    leveledTasks,
    shifts,
    peakLoadBefore: peakBefore,
    peakLoadAfter: peakAfter,
  }
}
