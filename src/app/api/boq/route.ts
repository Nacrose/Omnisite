import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase-server'

// GET /api/boq — fetch all BOQ items
export async function GET() {
  const { data, error } = await supabase
    .from('boq_items')
    .select('*')
    .order('code', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// POST /api/boq — upsert a BOQ item
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await supabase
    .from('boq_items')
    .upsert(body)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

// DELETE /api/boq — delete a BOQ item by id
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('boq_items')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
