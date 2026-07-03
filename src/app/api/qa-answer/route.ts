import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { question, patient_id, session_id } = await req.json()
    if (!question?.trim()) return NextResponse.json({ error: 'No question' }, { status: 400 })

    // Get patient context
    const { data: patient } = await supabaseAdmin
      .from('patients')
      .select('full_name, primary_concern, medical_history')
      .eq('id', patient_id)
      .single()

    // Search KB for relevant content using keywords from the question
    let kbContext = ''
    try {
      const stopWords = new Set(['what','does','how','why','when','should','can','will','the','and','for','with','this','that','give','tell','me','about','is','are'])
      const keywords = question
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w: string) => w.length > 3 && !stopWords.has(w))
        .slice(0, 6)
        .join(' | ')

      if (keywords) {
        const { data: chunks } = await supabaseAdmin
          .from('kb_chunks')
          .select('content')
          .textSearch('content', keywords, { type: 'websearch', config: 'english' })
          .limit(5)

        if (chunks?.length) {
          kbContext = chunks.map((c: { content: string }, i: number) => `[${i+1}] ${c.content.slice(0, 300)}`).join('\n\n')
        }
      }
    } catch {}

    // Get session Q&A for additional context
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('qa_pairs, gemini_doc_raw')
      .eq('id', session_id)
      .single()

    const sessionContext = session?.gemini_doc_raw?.slice(0, 400) ?? ''
    const qaContext = (session?.qa_pairs ?? [])
      .slice(0, 5)
      .map((qa: { question: string; answer: string }) => `Q: ${qa.question}\nA: ${qa.answer}`)
      .join('\n')

    const res = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are a clinical nutrition expert at Clinic Living Plus, Bangalore. Answer the nutritionist's question specifically about their patient based on:
1. The patient's profile and session data
2. Knowledge base excerpts (clinical books and guidelines)
Be specific, clinical, and actionable. 2-4 sentences max. Never mention "KB" or "knowledge base" — speak as if you naturally know this.`
        },
        {
          role: 'user',
          content: `Patient: ${patient?.full_name}, Concern: ${patient?.primary_concern ?? 'General health'}
${sessionContext ? `Session context: ${sessionContext}` : ''}
${qaContext ? `Previous Q&A:\n${qaContext}` : ''}
${kbContext ? `Clinical knowledge:\n${kbContext}` : ''}

Nutritionist's question: ${question}

Answer directly and clinically:`
        }
      ],
      temperature: 0.4,
      max_tokens: 300,
    })

    const answer = res.choices[0]?.message?.content?.trim() ?? ''
    return NextResponse.json({ answer })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
