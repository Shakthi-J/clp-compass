import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')
  const patientId = searchParams.get('patient_id')

  let query = supabaseAdmin.from('roadmaps').select('*').order('created_at', { ascending: false })
  if (sessionId) query = query.eq('session_id', sessionId)
  if (patientId) query = query.eq('patient_id', patientId)

  const { data, error } = await query.limit(1).single()
  if (error) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(data)
}
