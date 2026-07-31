import { describe, it, expect } from 'vitest'
import { calculateCpm, type CpmTask } from '@/lib/cpm'

describe('CPM Algorithm', () => {
  it('should calculate correct critical path for a simple chain', () => {
    const tasks: CpmTask[] = [
      { id: 'A', duration: 5, predecessors: [] },
      { id: 'B', duration: 3, predecessors: ['A'] },
      { id: 'C', duration: 2, predecessors: ['B'] },
    ]

    const result = calculateCpm(tasks)

    expect(result.projectDuration).toBe(10) // 5 + 3 + 2
    expect(result.criticalPath).toEqual(['A', 'B', 'C'])
    expect(result.results['A'].totalFloat).toBe(0)
    expect(result.results['B'].totalFloat).toBe(0)
    expect(result.results['C'].totalFloat).toBe(0)
  })

  it('should identify the longer path as critical when there are parallel paths', () => {
    const tasks: CpmTask[] = [
      { id: 'A', duration: 2, predecessors: [] },
      { id: 'B', duration: 5, predecessors: ['A'] }, // longer path
      { id: 'C', duration: 1, predecessors: ['A'] }, // shorter path
      { id: 'D', duration: 3, predecessors: ['B', 'C'] },
    ]

    const result = calculateCpm(tasks)

    expect(result.projectDuration).toBe(10) // 2 + 5 + 3
    expect(result.criticalPath).toContain('B')
    expect(result.criticalPath).not.toContain('C')
    expect(result.results['C'].totalFloat).toBe(4) // C can slip 4 days
    expect(result.results['B'].totalFloat).toBe(0)
  })

  it('should handle milestones (duration 0)', () => {
    const tasks: CpmTask[] = [
      { id: 'A', duration: 5, predecessors: [] },
      { id: 'M', duration: 0, predecessors: ['A'] }, // milestone
      { id: 'B', duration: 3, predecessors: ['M'] },
    ]

    const result = calculateCpm(tasks)

    expect(result.projectDuration).toBe(8) // 5 + 0 + 3
    expect(result.results['M'].earliestStart).toBe(5)
    expect(result.results['M'].earliestFinish).toBe(5)
  })

  it('should handle tasks with no predecessors (all start at 0)', () => {
    const tasks: CpmTask[] = [
      { id: 'A', duration: 3, predecessors: [] },
      { id: 'B', duration: 5, predecessors: [] },
    ]

    const result = calculateCpm(tasks)

    expect(result.results['A'].earliestStart).toBe(0)
    expect(result.results['B'].earliestStart).toBe(0)
    expect(result.projectDuration).toBe(5) // max(3, 5)
  })

  it('should correctly calculate float for non-critical tasks', () => {
    const tasks: CpmTask[] = [
      { id: 'A', duration: 5, predecessors: [] },
      { id: 'B', duration: 2, predecessors: ['A'] },  // short task, lots of float
      { id: 'C', duration: 8, predecessors: ['A'] },  // long task, critical
      { id: 'D', duration: 1, predecessors: ['B', 'C'] },
    ]

    const result = calculateCpm(tasks)

    // A(5) → C(8) → D(1) = 14 total
    expect(result.projectDuration).toBe(14)
    // B has float: ES=5, EF=7, but D starts at 13, so LF for B = 13, LS = 11
    // Float = LS - ES = 11 - 5 = 6
    expect(result.results['B'].totalFloat).toBe(6)
    expect(result.results['C'].totalFloat).toBe(0)
  })
})
