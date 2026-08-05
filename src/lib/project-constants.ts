/**
 * Shared project-level constants used across modules.
 *
 * `PROJECT_EPOCH` is a fallback used only when no per-project start date is
 * supplied. Callers that know the active project should pass its `startDate`
 * (from the `projects` table or the `PROJECTS` array in project-switcher.tsx)
 * into `getTodayWeek(epoch)`. The hardcoded constant exists so demo-mode and
 * tests still produce a deterministic "today" line on the Gantt chart.
 */

/**
 * Fallback epoch when no per-project start date is available.
 *
 * Historical note: previously this was hardcoded to week `16` in the Scheduler,
 * which kept the red "today" marker pinned forever. Replaced with a real date
 * so the marker moves forward as real time passes.
 */
export const DEFAULT_PROJECT_EPOCH = new Date('2026-04-01')

/**
 * @deprecated Use `getTodayWeek(epoch)` with the active project's start date
 *             instead of reading this constant directly. Retained for
 *             backwards compatibility with callers that don't yet thread the
 *             project through.
 */
export const PROJECT_EPOCH = DEFAULT_PROJECT_EPOCH

export const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000

/**
 * Compute the current week offset from a project epoch.
 *
 * @param maxWeeks Optional upper bound (e.g. the project's total planned
 *                 duration in weeks) — the result is clamped to
 *                 `[0, maxWeeks]` so the "today" line never overshoots the
 *                 Gantt's right edge.
 * @param epoch    Optional project start date. Defaults to
 *                 `DEFAULT_PROJECT_EPOCH` for backwards compatibility.
 *                 Callers should pass the active project's `startDate` so the
 *                 "today" line is correct for projects that didn't start on
 *                 2026-04-01.
 */
export function getTodayWeek(maxWeeks?: number, epoch?: Date): number {
  const start = epoch ?? DEFAULT_PROJECT_EPOCH
  const week = Math.max(0, Math.floor((Date.now() - start.getTime()) / MS_PER_WEEK))
  return maxWeeks != null ? Math.min(maxWeeks, week) : week
}

// ─── DoR (Department of Roads) default rate-analysis coefficients ────────
// These are the standard percentage additions applied to direct cost when
// building a rate analysis row for Nepali public works. They live here (not
// inline in `boq/handlers.ts`) so they can be referenced from a single
// source of truth when the RA Inspector's user-editable coefficients become
// the source of truth — at which point these become the *fallback* values.
//
// Breakdown (per DoR convention):
//   - 2.5%  contractor's profit
//   - 1.5%  insurance
//   - 3.5%  overhead (small tools, supervision, contingency)
//   - 7.5%  total percentage additions on direct cost
//   - 15%   overhead on (direct + percentage additions) — applied separately
//           to avoid compounding on the contractor's margin.
export const DOR_PCT_ADD = 0.075 // 2.5% + 1.5% + 3.5%
export const DOR_OVERHEAD_RATE = 0.15 // 15% on (direct + pctAdd)
