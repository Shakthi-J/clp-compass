import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// GET — generate next question based on patient + existing answers
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

  const existingQA: { question: string; answer: string }[] = session.qa_pairs ?? []
  const answeredCount = existingQA.length

  // Fixed question bank — clinical and specific
  const questionBank = [
    `What are ${patient.full_name}'s top 3 health complaints right now in order of priority?`,
    `How is ${patient.full_name}'s sleep quality — hours per night, any disturbances, energy on waking?`,
    `Describe their current diet — meal timings, any foods they avoid, cravings or emotional eating patterns?`,
    `What is their current physical activity level — type, frequency, how they feel during and after exercise?`,
    `Any history of gut issues — bloating, acidity, constipation, loose stools, frequency?`,
    `What medications or supplements are they currently taking?`,
    `How are their stress levels and what are the main stressors — work, family, financial?`,
    `Any hormonal concerns — thyroid, menstrual irregularities, PCOS, testosterone issues?`,
    `What are their weight history and body composition goals?`,
    `What does a typical day look like from waking to sleeping — routine, work type, screen time?`,
    `Any food allergies, intolerances, or strong dislikes the plan must avoid?`,
    `What has the patient tried before that did not work — previous diets, supplements, treatments?`,
  ]

  // Generate a dynamic follow-up if standard questions are exhausted
  if (answeredCount >= questionBank.length) {
    // Generate a custom follow-up based on the answers so far
    const answerSummary = existingQA.map((qa, i) => `Q${i+1}: ${qa.question}\nA: ${qa.answer}`).join('\n\n')
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a clinical nutritionist conducting a patient intake. Ask ONE specific follow-up question based on the answers given. Return only the question text, nothing else.' },
        { role: 'user', content: `Patient: ${patient.full_name}, Concern: ${patient.primary_concern}\n\nAnswers so far:\n${answerSummary}\n\nAsk one more specific clinical question to fill gaps in understanding.` }
      ],
      temperature: 0.7,
      max_tokens: 100,
    })
    return NextResponse.json({
      question: completion.choices[0]?.message?.content?.trim(),
      question_number: answeredCount + 1,
      is_complete: false,
    })
  }

  // Check if we have enough to generate (minimum 5 answered)
  const isComplete = answeredCount >= 5

  return NextResponse.json({
    question: questionBank[answeredCount],
    question_number: answeredCount + 1,
    total_questions: questionBank.length,
    is_complete: isComplete && answeredCount === questionBank.length,
  })
}

// POST — save an answer
export async function POST(req: NextRequest) {
  const { session_id, question, answer } = await req.json()

  if (!session_id || !question || !answer?.trim()) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const { data: session } = await supabaseAdmin.from('sessions').select('qa_pairs').eq('id', session_id).single()
  const existing: { question: string; answer: string }[] = session?.qa_pairs ?? []

  const updated = [...existing, { question, answer: answer.trim() }]

  await supabaseAdmin.from('sessions').update({ qa_pairs: updated, status: 'notes-added' }).eq('id', session_id)

  return NextResponse.json({ success: true, total_answered: updated.length })
}
