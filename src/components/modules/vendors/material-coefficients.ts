// ─── Material coefficient lookup (shared) ───────────────────────────────────
//
// Theoretical material usage = composite work done × coefficient.
// Composite work is measured in RMT (running metres) of drain or tunnel
// advance — the `actualQty` of the SC's `composite` BOQ item.
//
// Coefficients come from the design mix norms:
//  - Cement (M-CEM-OPC):            5.7 bags/rmt  (0.4 cum PCC × 4.5 + 0.6 cum RCC × 6.5)
//  - Steel (M-STEEL-TMT16,
//           M-STEEL-ISMB150):        0.095 mt/rmt  (rebar)
//  - Aggregate (M-AGG-20):           0.9 cum/rmt   (0.4 × 0.9 PCC + 0.6 × 0.9 RCC)
//  - Sand (M-SAND-R):                0.45 cum/rmt  (0.4 × 0.45 PCC + 0.6 × 0.45 RCC)
//
// Tunneling-specific materials (M-SHOTCRETE, M-ROCKBOLT3) have per-SC
// coefficients derived from the `designPattern` on the matching conditional
// SC item (expected qty per rm of advance for the rock class in question).
//
// This lookup was previously duplicated across three vendor tabs:
//   • material-tab.tsx      (most complete, with comments)
//   • running-bill-tab.tsx  (patched once to add aggregate + sand)
//   • performance-tab.tsx   (stale — only cement + steel, missing aggregate
//                             and sand so they were always charged back in full)
// Consolidated here so all three tabs agree by construction.

import type { Subcontractor } from './types'

/**
 * Resolve the material coefficient (qty per unit of composite work, e.g. per
 * RMT of drain or tunnel advance) for the given material code.
 *
 * For tunneling materials whose coefficient depends on the SC's design
 * pattern, pass the SC so the matching conditional item's `designPattern`
 * can be read.
 *
 * Returns `undefined` if no coefficient is known for the code — callers
 * should treat that as "no theoretical baseline" (theoretical = 0 and the
 * UI surfaces 'N/A' rather than flagging the material as over-used).
 */
export function getMaterialCoefficient(
  code: string,
  sc?: Pick<Subcontractor, 'isTunneling' | 'items'>
): number | undefined {
  // Drain (RCC/PCC) coefficients — constant per material code.
  if (code === 'M-CEM-OPC') {
    // PCC: 0.40 cum/rmt × 4.5 bags + RCC: 0.60 cum/rmt × 6.5 bags = 5.7 bags/rmt
    return 5.7
  }
  if (code === 'M-STEEL-TMT16' || code === 'M-STEEL-ISMB150') {
    // Drain rebar ~0.095 mt/rmt.
    // (Tunnel steel rib M-STEEL-ISMB150 would use 0.037 mt/rmt, but this
    // branch matches first — preserved as-is to avoid changing business
    // logic. Revisit if tunneling SCs start reporting steel rib over-use.)
    return 0.095
  }
  if (code === 'M-AGG-20') {
    // PCC agg 0.4 × 0.9 + RCC agg 0.6 × 0.9 = 0.9 cum/rmt
    return 0.4 * 0.9 + 0.6 * 0.9
  }
  if (code === 'M-SAND-R') {
    // PCC sand 0.4 × 0.45 + RCC sand 0.6 × 0.45 = 0.45 cum/rmt
    return 0.4 * 0.45 + 0.6 * 0.45
  }

  // Tunneling-specific materials — depend on the SC's design pattern.
  if (sc?.isTunneling) {
    if (code === 'M-SHOTCRETE') {
      // Pattern comes from the SC-TUN-SHOT conditional item.
      return sc.items.find((i) => i.code === 'SC-TUN-SHOT')?.designPattern
    }
    if (code === 'M-ROCKBOLT3') {
      // Pattern comes from the SC-TUN-BOLT conditional item.
      return sc.items.find((i) => i.code === 'SC-TUN-BOLT')?.designPattern
    }
  }

  return undefined
}

/**
 * Compute the theoretical material usage for a given material code against a
 * quantity of composite work done (e.g. total RMT of drain or tunnel advance).
 *
 * Returns 0 when no coefficient is known (callers can detect this case by
 * first calling `getMaterialCoefficient` and checking for `undefined`).
 */
export function computeTheoreticalUsage(
  code: string,
  totalRmt: number,
  sc?: Pick<Subcontractor, 'isTunneling' | 'items'>
): number {
  const coeff = getMaterialCoefficient(code, sc)
  return coeff ? coeff * totalRmt : 0
}
