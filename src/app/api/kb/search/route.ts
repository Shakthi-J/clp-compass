import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getEmbedding } from '@/lib/embeddings'

export async function POST(req: NextRequest) {
  try {
    const { query, limit = 5, threshold = 0.4 } = await req.json()

    if (!query || query.trim().length < 3) {
      return NextResponse.json({ error: 'Query too short' }, { status: 400 })
    }

    const queryEmbedding = await getEmbedding(query.trim())

    const { data, error } = await supabaseAdmin.rpc('match_kb_chunks', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_threshold: threshold,
      match_count: limit,
    })

    if (error) throw new Error(error.message)

    const documentIds = [...new Set((data || []).map((r: { document_id: string }) => r.document_id))]

    const { data: docs } = await supabaseAdmin
      .from('kb_documents')
      .select('id, title, source_type')
      .in('id', documentIds)

    const docMap = Object.fromEntries(
      (docs || []).map((d: { id: string; title: string; source_type: string }) => [d.id, d])
    )

    const results = (data || []).map((r: { id: string; document_id: string; content: string; similarity: number }) => ({
      ...r,
      document_title: docMap[r.document_id]?.title ?? 'Unknown',
      source_type: docMap[r.document_id]?.source_type ?? 'unknown',
    }))

    return NextResponse.json({ results, query })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}