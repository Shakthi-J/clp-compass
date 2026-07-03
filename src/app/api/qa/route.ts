import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')
  const patientId = searchParams.get('patient_id')
  if (!sessionId || !patientId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const [{ data: session }, { data: patient }] = await Promise.all([
    supabaseAdmin.from('sessions').select('*').eq('id', sessionId).single(),
    supabaseAdmin.from('patients').select('*').eq('id', patientId).single(),
  ])
  if (!session || !patient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existingQA: { question: string; answer: string; mode?: string }[] = session.qa_pairs ?? []
  const coachAnsweredCount = existingQA.filter(qa => qa.mode === 'ai-asks').length
  // No hard limit — coaches can continue as long as they want

  const geminiContext = session.gemini_doc_raw?.slice(0, 3000) ?? ''
  const extractedQA = existingQA.filter(qa => qa.mode !== 'ai-asks').map(qa => `${qa.question}: ${qa.answer}`).join('\n')
  const coachAnswers = existingQA.filter(qa => qa.mode === 'ai-asks').map((qa, i) => `Q${i+1}: ${qa.question} → ${qa.answer}`).join('\n')

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      {
        role: 'system',
        content: `You are a clinical nutritionist. Generate ONE short clinical question (max 10 words) with 3 specific multiple-choice options relevant to this patient.
The question must uncover something NOT already known from the doc.
Focus on treatment decisions, not symptoms already documented.
Return ONLY in this exact format (no extra text):
QUESTION: [max 10 words]
A: [specific option]
B: [specific option]  
C: [specific option, often "None of the above" or "Other"]`
      },
      {
        role: 'user',
        content: `Patient: ${patient.full_name}, Concern: ${patient.primary_concern ?? 'General health'}
GEMINI DOC: ${geminiContext || 'None.'}
EXTRACTED: ${extractedQA || 'None.'}
ALREADY ASKED: ${coachAnswers || 'None.'}
Generate next treatment-focused question with 3 choices:`
      }
    ],
    temperature: 0.5,
    max_tokens: 100,
  })

  const raw = completion.choices[0]?.message?.content?.trim() ?? ''
  const questionMatch = raw.match(/QUESTION:\s*(.+)/i)
  const aMatch = raw.match(/A:\s*(.+)/i)
  const bMatch = raw.match(/B:\s*(.+)/i)
  const cMatch = raw.match(/C:\s*(.+)/i)

  return NextResponse.json({
    question: questionMatch?.[1]?.trim() ?? raw,
    options: [aMatch?.[1]?.trim(), bMatch?.[1]?.trim(), cMatch?.[1]?.trim()].filter(Boolean),
    question_number: coachAnsweredCount + 1,
    is_complete: false,
  })
}

export async function POST(req: NextRequest) {
  const { session_id, question, answer } = await req.json()
  if (!session_id || !question || !answer?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const { data: session } = await supabaseAdmin.from('sessions').select('qa_pairs').eq('id', session_id).single()
  const existing: { question: string; answer: string; mode?: string }[] = session?.qa_pairs ?? []
  const updated = [...existing, { question, answer: answer.trim(), mode: 'ai-asks' }]
  await supabaseAdmin.from('sessions').update({ qa_pairs: updated, status: 'notes-added' }).eq('id', session_id)
  return NextResponse.json({ success: true, total_answered: updated.length })
}
