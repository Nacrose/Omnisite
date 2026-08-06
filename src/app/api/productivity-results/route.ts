import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createCrudHandler } from '@/lib/crud-handler'

const schema = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  status: z.string().optional(),
  version: z.number().optional(),
})

const handler = createCrudHandler({
  table: 'productivity_results',
  pk: 'id',
  schema,
})

export async function GET(req: NextRequest) { return handler.GET(req) }
export async function POST(req: NextRequest) { return handler.POST(req) }
export async function DELETE(req: NextRequest) { return handler.DELETE(req) }
