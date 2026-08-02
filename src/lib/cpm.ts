/**
 * Critical Path Method (CPM) implementation.
 *
 * Supports all 4 dependency link types:
 *   - FS (Finish-to-Start): successor starts after predecessor finishes
 *   - SS (Start-to-Start):  successor starts after predecessor starts
 *   - FF (Finish-to-Finish): successor finishes after predecessor finishes
 *   - SF (Start-to-Finish):  successor finishes after predecessor starts
 *
 * Lag (in days, can be negative for lead/acceleration) is applied per link.
 *
 * Algorithm:
 * 1. Forward pass: compute ES and EF based on dependency types + lag
 * 2. Backward pass: compute LS and LF based on successor constraints
 * 3. Float = LS - ES (if 0, task is critical)
 *
 * Cycle detection: if Kahn's topological sort leaves tasks unsorted (i.e.
 * sorted.length < tasks.length), the dependency graph contains a cycle.
 * Those tasks would otherwise default to ES=0/EF=0/LS=0/LF=0/float=0 and
 * be incorrectly marked critical — masking the real critical path. We
 * throw a descriptive Error so the caller can surface it (the scheduler
 * module's cpmResult useMemo catches this and falls back to seed-decorated
 * critical flags with a console.warn).
 */

export type LinkType = 'FS' | 'SS' | 'FF' | 'SF'

export interface CpmDependency {
  /** Predecessor task ID. */
  predecessorId: string
  /** Link type (default: FS). */
  linkType?: LinkType
  /** Lag in days (can be negative for lead). */
  lag?: number
}

export interface CpmTask {
  id: string
  duration: number // in days (0 for milestones)
  /**
   * Predecessor task IDs (FS-only, backward compat).
   * If you need SS/FF/SF links or lag, use `dependencies` instead.
   */
  predecessors?: string[]
  /** Full dependency links with type + lag. Takes precedence over `predecessors`. */
  dependencies?: CpmDependency[]
}

export interface CpmResult {
  earliestStart: number
  earliestFinish: number
  latestStart: number
  latestFinish: number
  totalFloat: number
  isCritical: boolean
}

export interface CpmOutput {
  results: Record<string, CpmResult>
  criticalPath: string[] // ordered list of task IDs on the critical path
  projectDuration: number // total project duration in days
}

/**
 * Compute the earliest start of a successor given a predecessor's
 * computed ES/EF and the dependency link type + lag.
 *
 * Returns the minimum ES constraint imposed by this single link.
 */
function computeLinkConstraint(
  linkType: LinkType,
  lag: number,
  predES: number,
  predEF: number
): number {
  switch (linkType) {
    case 'FS':
      // Successor can start after predecessor finishes + lag
      return predEF + lag
    case 'SS':
      // Successor can start after predecessor starts + lag
      return predES + lag
    case 'FF':
      // Successor finishes after predecessor finishes + lag
      // ES_succ = constraint - duration_succ (handled by caller: returns the
      // finish constraint; caller converts to start by subtracting duration)
      // We return the EF constraint here; caller will subtract duration.
      return predEF + lag // This is the EF constraint, not ES
    case 'SF':
      // Successor finishes after predecessor starts + lag
      // Similarly, this is an EF constraint.
      return predES + lag // EF constraint
    default:
      return predEF + lag // default to FS
  }
}

/**
 * Check if a link type produces a finish constraint (FF, SF) rather than
 * a start constraint (FS, SS).
 */
function isFinishConstraint(linkType: LinkType): boolean {
  return linkType === 'FF' || linkType === 'SF'
}

export function calculateCpm(tasks: CpmTask[]): CpmOutput {
  const taskMap = new Map<string, CpmTask>()
  for (const t of tasks) {
    taskMap.set(t.id, t)
  }

  // Normalize dependencies: merge `predecessors` (FS-only) and `dependencies`
  const normalizedDeps = new Map<string, CpmDependency[]>()
  for (const t of tasks) {
    const deps: CpmDependency[] = []
    if (t.dependencies && t.dependencies.length > 0) {
      deps.push(...t.dependencies)
    }
    if (t.predecessors && t.predecessors.length > 0) {
      for (const predId of t.predecessors) {
        // Don't duplicate if already in dependencies
        if (!deps.some((d) => d.predecessorId === predId)) {
          deps.push({ predecessorId: predId, linkType: 'FS', lag: 0 })
        }
      }
    }
    normalizedDeps.set(t.id, deps)
  }

  // Topological sort (Kahn's algorithm)
  const inDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>() // predecessor → successors

  for (const t of tasks) {
    if (!inDegree.has(t.id)) inDegree.set(t.id, 0)
    if (!adjList.has(t.id)) adjList.set(t.id, [])
  }

  for (const t of tasks) {
    const deps = normalizedDeps.get(t.id) || []
    for (const dep of deps) {
      if (!adjList.has(dep.predecessorId)) adjList.set(dep.predecessorId, [])
      adjList.get(dep.predecessorId)!.push(t.id)
      inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1)
    }
  }

  const sorted: string[] = []
  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  while (queue.length > 0) {
    const id = queue.shift()!
    sorted.push(id)
    for (const successor of adjList.get(id) || []) {
      inDegree.set(successor, (inDegree.get(successor) || 0) - 1)
      if (inDegree.get(successor) === 0) queue.push(successor)
    }
  }

  // Cycle detection (audit S4): if Kahn's algorithm leaves tasks unsorted,
  // the dependency graph contains a cycle. Without this check, cyclic tasks
  // would default to ES=0/EF=0/LS=0/LF=0/float=0 and be incorrectly marked
  // critical — masking the real critical path. Throw a descriptive Error
  // listing the cyclic task ids so the user can break the loop.
  if (sorted.length < taskMap.size) {
    const cyclic = Array.from(taskMap.keys()).filter((id) => !sorted.includes(id))
    throw new Error(
      `CPM cycle detected: ${cyclic.length} task(s) form a dependency loop — ${cyclic.join(', ')}. ` +
        `Break the cycle (remove one of the dependency links) and re-run.`
    )
  }

  // Forward pass: calculate ES and EF using dependency types + lag
  const es = new Map<string, number>() // earliest start
  const ef = new Map<string, number>() // earliest finish

  for (const id of sorted) {
    const task = taskMap.get(id)!
    const deps = normalizedDeps.get(id) || []

    let maxStartConstraint = 0
    let maxFinishConstraint = 0
    let hasFinishConstraint = false

    for (const dep of deps) {
      const predES = es.get(dep.predecessorId) || 0
      const predEF = ef.get(dep.predecessorId) || 0
      const linkType = dep.linkType || 'FS'
      const lag = dep.lag || 0

      if (isFinishConstraint(linkType)) {
        // FF or SF: produces a finish constraint
        const finishConstraint = computeLinkConstraint(linkType, lag, predES, predEF)
        maxFinishConstraint = Math.max(maxFinishConstraint, finishConstraint)
        hasFinishConstraint = true
      } else {
        // FS or SS: produces a start constraint
        const startConstraint = computeLinkConstraint(linkType, lag, predES, predEF)
        maxStartConstraint = Math.max(maxStartConstraint, startConstraint)
      }
    }

    // ES = max of all start constraints
    let taskES = maxStartConstraint

    // If there are finish constraints (FF/SF), convert to start:
    // EF >= finishConstraint → ES >= finishConstraint - duration
    if (hasFinishConstraint) {
      taskES = Math.max(taskES, maxFinishConstraint - task.duration)
    }

    es.set(id, taskES)
    ef.set(id, taskES + task.duration)
  }

  // Project duration = max EF
  const projectDuration = Math.max(0, ...Array.from(ef.values()))

  // Backward pass: calculate LS and LF
  const ls = new Map<string, number>() // latest start
  const lf = new Map<string, number>() // latest finish

  // Build reverse adjacency: for each task, who are its successors and
  // what link type connects them?
  const successorLinks = new Map<
    string,
    { successorId: string; linkType: LinkType; lag: number }[]
  >()
  for (const t of tasks) {
    const deps = normalizedDeps.get(t.id) || []
    for (const dep of deps) {
      if (!successorLinks.has(dep.predecessorId)) {
        successorLinks.set(dep.predecessorId, [])
      }
      successorLinks.get(dep.predecessorId)!.push({
        successorId: t.id,
        linkType: dep.linkType || 'FS',
        lag: dep.lag || 0,
      })
    }
  }

  for (let i = sorted.length - 1; i >= 0; i--) {
    const id = sorted[i]
    const task = taskMap.get(id)!

    const links = successorLinks.get(id) || []
    let minFinishConstraint = projectDuration
    let minStartConstraint = projectDuration
    let hasStartConstraint = false

    for (const link of links) {
      const succLS = ls.get(link.successorId) ?? projectDuration
      const succLF = lf.get(link.successorId) ?? projectDuration
      const lag = link.lag

      switch (link.linkType) {
        case 'FS':
          // LF_pred <= LS_succ - lag
          minFinishConstraint = Math.min(minFinishConstraint, succLS - lag)
          break
        case 'SS':
          // LS_pred <= LS_succ - lag
          minStartConstraint = Math.min(minStartConstraint, succLS - lag)
          hasStartConstraint = true
          break
        case 'FF':
          // LF_pred <= LF_succ - lag
          minFinishConstraint = Math.min(minFinishConstraint, succLF - lag)
          break
        case 'SF':
          // LS_pred <= LF_succ - lag
          minStartConstraint = Math.min(minStartConstraint, succLF - lag)
          hasStartConstraint = true
          break
      }
    }

    // LF = min of all finish constraints
    let taskLF = minFinishConstraint

    // If there are start constraints (SS/SF), convert to finish:
    // LS <= startConstraint → LF <= startConstraint + duration
    if (hasStartConstraint) {
      taskLF = Math.min(taskLF, minStartConstraint + task.duration)
    }

    lf.set(id, taskLF)
    ls.set(id, taskLF - task.duration)
  }

  // Calculate float and critical path
  const results: Record<string, CpmResult> = {}
  const criticalPath: string[] = []

  for (const id of sorted) {
    const taskEs = es.get(id) || 0
    const taskEf = ef.get(id) || 0
    const taskLs = ls.get(id) || 0
    const taskLf = lf.get(id) || 0
    const float = taskLs - taskEs

    results[id] = {
      earliestStart: taskEs,
      earliestFinish: taskEf,
      latestStart: taskLs,
      latestFinish: taskLf,
      totalFloat: float,
      isCritical: float === 0,
    }

    if (float === 0 && taskMap.get(id)!.duration > 0) {
      criticalPath.push(id)
    }
  }

  return { results, criticalPath, projectDuration }
}
