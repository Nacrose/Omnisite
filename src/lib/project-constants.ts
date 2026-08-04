/**
 * Shared project-level constants used across modules.
 *
 * These are placeholder values — when project settings land, replace
 * these with values fetched from the project record (e.g. start date,
 * duration). Until then, both the Scheduler and Dashboard import from
 * this single source so they can never drift apart.
 */

// TODO: replace with real project epoch once project settings exist.
// For now, use a fixed epoch so the TODAY line is deterministic and moves
// forward as real time passes (previously hardcoded to `16`, which kept
// the red marker pinned at week 16 forever).
export const PROJECT_EPOCH = new Date('2026-04-01') // approx project start

export const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

/**
 * Compute the current week offset from the project epoch.
 * Clamped to [0, ∞) so a date before the epoch doesn't produce a
 * negative week.
 */
export function getTodayWeek(maxWeeks?: number): number {
  const week = Math.max(0, Math.floor((Date.now() - PROJECT_EPOCH.getTime()) / MS_PER_WEEK))
  return maxWeeks != null ? Math.min(maxWeeks, week) : week
}
