/**
 * Critical Path Method (CPM) implementation.
 * Calculates earliest start, earliest finish, latest start, latest finish,
 * total float, and identifies critical path tasks.
 *
 * Based on standard CPM algorithm:
 * 1. Forward pass: ES = max(EF of predecessors), EF = ES + duration
 * 2. Backward pass: LF = min(LS of successors), LS = LF - duration
 * 3. Float = LS - ES (if 0, task is critical)
 */

export interface CpmTask {
  id: string
  duration: number // in days (0 for milestones)
  predecessors: string[] // task IDs that must finish before this one starts
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

export function calculateCpm(tasks: CpmTask[]): CpmOutput {
  const taskMap = new Map<string, CpmTask>()
  for (const t of tasks) {
    taskMap.set(t.id, t)
  }

  // Topological sort (Kahn's algorithm)
  const inDegree = new Map<string, number>()
  const adjList = new Map<string, string[]>() // predecessor → successors

  for (const t of tasks) {
    if (!inDegree.has(t.id)) inDegree.set(t.id, 0)
    if (!adjList.has(t.id)) adjList.set(t.id, [])
    for (const pred of t.predecessors) {
      if (!adjList.has(pred)) adjList.set(pred, [])
      adjList.get(pred)!.push(t.id)
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

  // Forward pass: calculate ES and EF
  const es = new Map<string, number>() // earliest start
  const ef = new Map<string, number>() // earliest finish

  for (const id of sorted) {
    const task = taskMap.get(id)!
    let maxPredEF = 0
    for (const pred of task.predecessors) {
      maxPredEF = Math.max(maxPredEF, ef.get(pred) || 0)
    }
    es.set(id, maxPredEF)
    ef.set(id, maxPredEF + task.duration)
  }

  // Project duration = max EF
  const projectDuration = Math.max(0, ...Array.from(ef.values()))

  // Backward pass: calculate LS and LF
  const ls = new Map<string, number>() // latest start
  const lf = new Map<string, number>() // latest finish

  // Process in reverse topological order
  for (let i = sorted.length - 1; i >= 0; i--) {
    const id = sorted[i]
    const task = taskMap.get(id)!

    // Find successors
    const successors = tasks.filter(t => t.predecessors.includes(id))
    let minSuccLS = projectDuration
    for (const succ of successors) {
      minSuccLS = Math.min(minSuccLS, ls.get(succ.id) ?? projectDuration)
    }

    lf.set(id, minSuccLS)
    ls.set(id, minSuccLS - task.duration)
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
