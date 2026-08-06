/**
 * Unit conversion service.
 *
 * Server-side wrapper for the Postgres fn_convert_unit function.
 * Also includes a client-side fallback that reads from the units
 * and unit_conversions tables via the API.
 */

import { supabase } from '@/lib/supabase'

export interface Unit {
  id: string
  code: string
  name: string
  unit_type: string
  is_base_unit: boolean
}

export interface UnitConversion {
  id: string
  from_unit_id: string
  to_unit_id: string
  material_code: string | null
  factor: number
}

// ─── Client-side unit conversion ────────────────────────────────────────────
//
// Fetches conversion factors from the API and applies them client-side.
// For server-side calls, use the Postgres function fn_convert_unit directly.

const conversionCache = new Map<string, number>()

/**
 * Convert a quantity from one unit to another.
 *
 * @param materialCode The material code (e.g. 'M-CEM-OPC') for material-specific conversions
 * @param fromUnitCode Source unit code (e.g. 'BAG')
 * @param toUnitCode Target unit code (e.g. 'KG')
 * @param quantity The quantity to convert
 * @returns The converted quantity, or null if no conversion found
 */
export async function convertUnit(
  materialCode: string | null,
  fromUnitCode: string,
  toUnitCode: string,
  quantity: number
): Promise<number | null> {
  if (fromUnitCode === toUnitCode) return quantity

  const cacheKey = `${materialCode || 'global'}:${fromUnitCode}:${toUnitCode}`
  if (conversionCache.has(cacheKey)) {
    return quantity * conversionCache.get(cacheKey)!
  }

  if (!supabase) return null

  // Look up unit IDs
  const { data: fromUnit } = await supabase
    .from('units')
    .select('id')
    .eq('code', fromUnitCode)
    .single()

  const { data: toUnit } = await supabase
    .from('units')
    .select('id')
    .eq('code', toUnitCode)
    .single()

  if (!fromUnit || !toUnit) return null

  // Look up conversion factor (material-specific first, then global)
  const { data: conv } = await supabase
    .from('unit_conversions')
    .select('factor')
    .eq('from_unit_id', fromUnit.id)
    .eq('to_unit_id', toUnit.id)
    .or(`material_code.is.null,material_code.eq.${materialCode || ''}`)
    .eq('is_active', true)
    .order('material_code', { ascending: false, nullsFirst: false })
    .limit(1)
    .single()

  if (!conv) return null

  conversionCache.set(cacheKey, conv.factor)
  return quantity * conv.factor
}

/**
 * Get all available units (for dropdowns).
 */
export async function getUnits(): Promise<Unit[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('units')
    .select('*')
    .eq('is_active', true)
    .order('name')
  return data || []
}

/**
 * Clear the conversion cache (after admin edits).
 */
export function clearConversionCache() {
  conversionCache.clear()
}
