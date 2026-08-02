import { describe, it, expect } from 'vitest'
import { calculateCpm, type CpmTask } from '@/lib/cpm'

describe('CPM Algorithm — FS (Finish-to-Start)', () => {
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
      { id: 'B', duration: 5, predecessors: ['A'] },
      { id: 'C', duration: 1, predecessors: ['A'] },
      { id: 'D', duration: 3, predecessors: ['B', 'C'] },
    ]
    const result = calculateCpm(tasks)
    expect(result.projectDuration).toBe(10) // 2 + 5 + 3
    expect(result.criticalPath).toContain('B')
    expect(result.criticalPath).not.toContain('C')
    expect(result.results['C'].totalFloat).toBe(4)
    expect(result.results['B'].totalFloat).toBe(0)
  })

  it('should handle milestones (duration 0)', () => {
    const tasks: CpmTask[] = [
      { id: 'A', duration: 5, predecessors: [] },
      { id: 'M', duration: 0, predecessors: ['A'] },
      { id: 'B', duration: 3, predecessors: ['M'] },
    ]
    const result = calculateCpm(tasks)
    expect(result.projectDuration).toBe(8)
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
    expect(result.projectDuration).toBe(5)
  })

  it('should correctly calculate float for non-critical tasks', () => {
    const tasks: CpmTask[] = [
      { id: 'A', duration: 5, predecessors: [] },
      { id: 'B', duration: 2, predecessors: ['A'] },
      { id: 'C', duration: 8, predecessors: ['A'] },
      { id: 'D', duration: 1, predecessors: ['B', 'C'] },
    ]
    const result = calculateCpm(tasks)
    expect(result.projectDuration).toBe(14)
    expect(result.results['B'].totalFloat).toBe(6)
    expect(result.results['C'].totalFloat).toBe(0)
  })
})

describe('CPM Algorithm — SS (Start-to-Start)', () => {
  it('SS link: successor starts after predecessor starts', () => {
    const tasks: CpmTask[] = [
      { id: 'A', duration: 10, predecessors: [] },
      { id: 'B', duration: 5, dependencies: [{ predecessorId: 'A', linkType: 'SS', lag: 2 }] },
    ]
    const result = calculateCpm(tasks)
    // B can start 2 days after A starts (ES_A = 0, so ES_B = 2)
    expect(result.results['B'].earliestStart).toBe(2)
    // B finishes at 2 + 5 = 7
    expect(result.results['B'].earliestFinish).toBe(7)
    // Project duration = max(EF_A=10, EF_B=7) = 10
    expect(result.projectDuration).toBe(10)
  })

  it('SS with no lag: both start at same time', () => {
    const tasks: CpmTask[] = [
      { id: 'A', duration: 5, predecessors: [] },
      { id: 'B', duration: 3, dependencies: [{ predecessorId: 'A', linkType: 'SS', lag: 0 }] },
    ]
    const result = calculateCpm(tasks)
    expect(result.results['B'].earliestStart).toBe(0)
  })
})

describe('CPM Algorithm — FF (Finish-to-Finish)', () => {
  it('FF link: successor finishes after predecessor finishes', () => {
    const tasks: CpmTask[] = [
      { id: 'A', duration: 5, predecessors: [] },
      { id: 'B', duration: 3, dependencies: [{ predecessorId: 'A', linkType: 'FF', lag: 1 }] },
    ]
    const result = calculateCpm(tasks)
    // A finishes at 5. B must finish at >= 5 + 1 = 6.
    // B duration 3, so B must start at >= 6 - 3 = 3.
    expect(result.results['B'].earliestFinish).toBe(6)
    expect(result.results['B'].earliestStart).toBe(3)
  })
})

describe('CPM Algorithm — SF (Start-to-Finish)', () => {
  it('SF link: successor finishes after predecessor starts', () => {
    const tasks: CpmTask[] = [
      { id: 'A', duration: 10, predecessors: [] },
      { id: 'B', duration: 3, dependencies: [{ predecessorId: 'A', linkType: 'SF', lag: 2 }] },
    ]
    const result = calculateCpm(tasks)
    // A starts at 0. B must finish at >= 0 + 2 = 2.
    // B duration 3, so B must start at >= 2 - 3 = -1, but clamped to 0.
    expect(result.results['B'].earliestFinish).toBeGreaterThanOrEqual(2)
  })
})

describe('CPM Algorithm — Lag', () => {
  it('FS with positive lag delays successor', () => {
    const tasks: CpmTask[] = [
      { id: 'A', duration: 5, predecessors: [] },
      { id: 'B', duration: 3, dependencies: [{ predecessorId: 'A', linkType: 'FS', lag: 2 }] },
    ]
    const result = calculateCpm(tasks)
    // A finishes at 5. B starts at 5 + 2 = 7.
    expect(result.results['B'].earliestStart).toBe(7)
  })

  it('FS with negative lag (lead) accelerates successor', () => {
    const tasks: CpmTask[] = [
      { id: 'A', duration: 5, predecessors: [] },
      { id: 'B', duration: 3, dependencies: [{ predecessorId: 'A', linkType: 'FS', lag: -2 }] },
    ]
    const result = calculateCpm(tasks)
    // A finishes at 5. B starts at 5 - 2 = 3.
    expect(result.results['B'].earliestStart).toBe(3)
  })
})

describe('CPM Algorithm — Mixed dependencies', () => {
  it('handles a mix of FS and SS links', () => {
    const tasks: CpmTask[] = [
      { id: 'A', duration: 10, predecessors: [] },
      { id: 'B', duration: 5, dependencies: [{ predecessorId: 'A', linkType: 'SS', lag: 3 }] },
      { id: 'C', duration: 2, predecessors: ['B'] }, // FS from B
    ]
    const result = calculateCpm(tasks)
    // B starts at 3 (SS+lag from A). B finishes at 3+5=8.
    // C starts at 8 (FS from B). C finishes at 8+2=10.
    expect(result.results['B'].earliestStart).toBe(3)
    expect(result.results['C'].earliestStart).toBe(8)
  })

  it('backward compat: predecessors field still works as FS', () => {
    const tasks: CpmTask[] = [
      { id: 'A', duration: 5, predecessors: [] },
      { id: 'B', duration: 3, predecessors: ['A'] },
    ]
    const result = calculateCpm(tasks)
    expect(result.results['B'].earliestStart).toBe(5) // FS: starts after A finishes
  })
})
