import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import ShareClient from '@/components/ShareClient'

export default async function SharePage({ params }: { params: Promise<{ roadmapId: string }> }) {
  const { roadmapId } = await params

  const { data: roadmap } = await supabaseAdmin
    .from('roadmaps')
    .select('*, patients(full_name, gender, primary_concern)')
    .eq('id', roadmapId)
    .single()

  if (!roadmap) notFound()

  return <ShareClient roadmap={roadmap} />
}
