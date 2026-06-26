import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Make a roadmap publicly shareable — returns share token
export async function POST(req: NextRequest) {
  const { roadmap_id } = await req.json()
  if (!roadmap_id) return NextResponse.json({ error: 'Missing roadmap_id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('roadmaps')
    .update({ status: 'final' })
    .eq('id', roadmap_id)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ share_url: `/share/${data.id}` })
}
