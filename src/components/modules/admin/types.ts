import type { Material, Vendor, Role, RatePreset } from '@/data/seed/admin'

// Re-export the seed data arrays so existing imports from './types' keep
// working. The seed data itself lives in '@/data/seed/admin'.
export { MATERIALS, VENDORS, ROLES } from '@/data/seed/admin'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Cat = 'users' | 'materials' | 'vendors' | 'rates' | 'presets'

export type { Material, Vendor, Role, RatePreset } from '@/data/seed/admin'
