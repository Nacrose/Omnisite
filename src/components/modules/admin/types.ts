// Re-export the seed data arrays so existing imports from './types' keep
// working. The seed data itself lives in '@/data/seed/admin' (master-data
// tables: materials / AVL vendors / roles) and '@/data/seed/vendors' (project
// locations + unified vendor list).
//
// NOTE: there are two `Vendor` types in flight:
//   • `Vendor` from '@/data/seed/admin'         — the legacy AVL entry (id, pan, gst, materials, brand, rating)
//   • `Vendor` from '@/lib/types/vendor'        — the new unified vendor record (category, bank, docs, workItems…)
// The legacy one stays the default `Vendor` export for backwards compat;
// new code that needs the unified shape should import it directly from
// '@/lib/types/vendor' rather than via this barrel.
export { MATERIALS, VENDORS, ROLES } from '@/data/seed/admin'
export { INITIAL_LOCATIONS, INITIAL_VENDORS } from '@/data/seed/vendors'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Cat = 'users' | 'materials' | 'vendors' | 'rates' | 'presets' | 'locations'

export type { Material, Vendor, Role, RatePreset } from '@/data/seed/admin'
export type { ProjectLocation } from '@/lib/types/vendor'
