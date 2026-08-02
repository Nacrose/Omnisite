import type { CbsNode } from '@/components/modules/financials/types'

/**
 * Seed CBS (Cost Breakdown Structure) tree for the demo project.
 *
 * Used as the initial tree rendered by the Financials module and as the
 * fallback when a flat-rows rebuild yields no roots.
 */
export const CBS: CbsNode[] = [
  {
    code: '1',
    name: 'Bridge Works',
    budget: 285_000_000,
    committed: 268_000_000,
    actual: 142_500_000,
    forecast: 278_000_000,
    marginPct: 2.4,
    level: 0,
    children: [
      {
        code: '1.1',
        name: 'Foundation',
        budget: 84_000_000,
        committed: 82_000_000,
        actual: 48_300_000,
        forecast: 80_500_000,
        marginPct: 4.2,
        level: 1,
      },
      {
        code: '1.2',
        name: 'Substructure',
        budget: 112_000_000,
        committed: 108_000_000,
        actual: 64_200_000,
        forecast: 110_800_000,
        marginPct: 1.1,
        level: 1,
      },
      {
        code: '1.3',
        name: 'Superstructure',
        budget: 89_000_000,
        committed: 78_000_000,
        actual: 30_000_000,
        forecast: 86_700_000,
        marginPct: 2.6,
        level: 1,
      },
    ],
  },
  {
    code: '2',
    name: 'Road Works',
    budget: 145_000_000,
    committed: 138_000_000,
    actual: 82_300_000,
    forecast: 142_500_000,
    marginPct: 1.7,
    level: 0,
    children: [
      {
        code: '2.1',
        name: 'Earthwork',
        budget: 38_000_000,
        committed: 36_500_000,
        actual: 28_400_000,
        forecast: 37_200_000,
        marginPct: 2.1,
        level: 1,
      },
      {
        code: '2.2',
        name: 'Pavement',
        budget: 89_000_000,
        committed: 84_500_000,
        actual: 48_700_000,
        forecast: 87_800_000,
        marginPct: 1.3,
        level: 1,
      },
      {
        code: '2.3',
        name: 'Signage & Markings',
        budget: 18_000_000,
        committed: 17_000_000,
        actual: 5_200_000,
        forecast: 17_500_000,
        marginPct: 2.8,
        level: 1,
      },
    ],
  },
  {
    code: '3',
    name: 'Drainage',
    budget: 57_400_000,
    committed: 54_200_000,
    actual: 18_400_000,
    forecast: 56_800_000,
    marginPct: 1.0,
    level: 0,
  },
]
