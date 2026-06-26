import KnowledgeBaseClient from './KnowledgeBaseClient'
import { supabase } from '@/lib/supabase'

export const revalidate = 0

export default async function KnowledgeBasePage() {
  const { data: documents } = await supabase
    .from('kb_documents')
    .select('id, title, source_type, tags, created_at')
    .order('created_at', { ascending: false })

  return <KnowledgeBaseClient initialDocuments={documents ?? []} />
}
