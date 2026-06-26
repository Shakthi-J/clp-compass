import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import Groq from 'groq-sdk'

export const maxDuration = 60
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

function extractJSON(text: string): unknown {
  const clean = text.replace(/```json|```/g, '').trim()
  for (const t of [clean, text]) {
    try { return JSON.parse(t) } catch {}
    const arr = t.match(/\[[\s\S]*\]/)
    if (arr) { try { return JSON.parse(arr[0]) } catch {} }
  }
  throw new Error(`Cannot parse JSON: ${text.slice(0, 200)}`)
}

export async function POST(req: NextRequest) {
  try {
    const { session_id, patient_id, duration_months = 1 } = await req.json()
    if (!session_id || !patient_id) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

    const [{ data: session }, { data: patient }] = await Promise.all([
      supabaseAdmin.from('sessions').select('*').eq('id', session_id).single(),
      supabaseAdmin.from('patients').select('*').eq('id', patient_id).single(),
    ])
    if (!session || !patient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const qaPairs: { question: string; answer: string }[] = session.qa_pairs ?? []
    const qaContext = qaPairs.length > 0
      ? qaPairs.map((qa, i) => `Q${i+1}: ${qa.question}\nAnswer: ${qa.answer}`).join('\n\n')
      : ''

    const sessionNotes = [
      session.pre_meeting_notes ? `Pre-meeting: ${session.pre_meeting_notes}` : '',
      session.gemini_doc_raw ? `Meeting notes: ${session.gemini_doc_raw.slice(0, 500)}` : '',
      session.post_meeting_notes ? `Post-meeting: ${session.post_meeting_notes}` : '',
    ].filter(Boolean).join('\n')

    // ── KB Search ────────────────────────────────────────────
    console.log('=== INTERPRETATION START ===')
    console.log('Patient:', patient.full_name, '| Concern:', patient.primary_concern)

    const searchQuery = [
      patient.primary_concern, patient.medical_history,
      ...qaPairs.slice(0, 5).map(qa => qa.answer),
    ].filter(Boolean).join(' ').slice(0, 700)

    // KB search — full text search, no embedding needed at runtime
    // Embeddings were pre-built by the Python ingestion script
    let kbContext = ''
    try {
      // Extract keywords from patient concern + Q&A for text search
      const keywords = [
        patient.primary_concern,
        ...qaPairs.slice(0, 3).map(qa => qa.answer.slice(0, 80)),
      ].filter(Boolean).join(' ')

      // Use Postgres full-text search on kb_chunks content — no vector needed
      const { data: chunks } = await supabaseAdmin
        .from('kb_chunks')
        .select('content, document_id')
        .textSearch('content', keywords.split(' ').filter(w => w.length > 4).slice(0, 6).join(' | '), {
          type: 'websearch',
          config: 'english',
        })
        .limit(8)

      if (chunks && chunks.length > 0) {
        kbContext = chunks
          .map((c: { content: string }, i: number) => `[KB ${i+1}]: ${c.content.slice(0, 400)}`)
          .join('\n\n')
        console.log('KB text search:', chunks.length, 'chunks found')
      } else {
        // Fallback: just grab recent chunks relevant to the condition
        const { data: fallbackChunks } = await supabaseAdmin
          .from('kb_chunks')
          .select('content')
          .limit(6)

        if (fallbackChunks?.length) {
          kbContext = fallbackChunks
            .map((c: { content: string }, i: number) => `[KB ${i+1}]: ${c.content.slice(0, 300)}`)
            .join('\n\n')
          console.log('KB fallback: using', fallbackChunks.length, 'general chunks')
        }
      }
    } catch (e) {
      console.log('KB search error:', e instanceof Error ? e.message : e)
    }

    const patientProfile = `Name: ${patient.full_name} | Gender: ${patient.gender ?? 'N/A'} | Concern: ${patient.primary_concern ?? 'General health'} | History: ${patient.medical_history ?? 'None'}`

    // ── Call 1: Overview ─────────────────────────────────────
    const overviewRes = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: `You are the treating nutritionist at Clinic Living Plus, Bangalore. You are writing a personal letter directly to YOUR patient. 
Rules:
- Write entirely in second person: "you", "your" — never "the patient"
- Use definitive language: "Your gut is inflamed" not "may be inflamed"
- Reference their EXACT details from Q&A: their name, their specific symptoms, their actual diet, their real schedule
- Every sentence must feel like you personally know this person and wrote this just for them
- No hedging words: never use "may", "might", "could", "possibly", "likely"
- Sound like a doctor who has studied this patient's case, not a generic health article` },
        { role: 'user', content: `PATIENT: ${patientProfile}

Q&A (their exact words and details):
${qaContext || 'None.'}

SESSION NOTES:
${sessionNotes || 'None.'}

KB CLINICAL KNOWLEDGE:
${kbContext}

Write 2-3 paragraphs directly to ${patient.full_name} as their treating nutritionist.
- Open by acknowledging their SPECIFIC situation using their real details from Q&A
- Name their actual condition, their real symptoms, their actual lifestyle patterns
- Tell them exactly what is happening in their body right now (from KB knowledge) and why
- Tell them specifically what will change over ${duration_months} months: "By week 4, your energy will return. By month 2, your digestion will stabilize..."
- Use their name at least once
- Definitive, warm, authoritative. Like a doctor who truly knows them. Max 160 words.` }
      ],
      temperature: 0.6, max_tokens: 400,
    })
    const overview = overviewRes.choices[0]?.message?.content?.trim() ?? ''

    // ── Call 2: Lifestyle guidelines ─────────────────────────
    const lifestyleRes = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are the treating nutritionist writing a personal lifestyle prescription for YOUR patient. Write in second person only. Use their exact details. Be definitive — no hedging. Never say "the patient". Never mention KB.' },
        { role: 'user', content: `PATIENT: ${patientProfile}

Q&A (use their EXACT details):
${qaContext || 'None.'}

KB KNOWLEDGE:
${kbContext}

Write 4 lifestyle prescriptions directly to this patient using "you/your".
Use their real details: if they sleep at 1am, address that. If they skip lunch, address that. If they stopped exercising in February, address that.
Be specific and direct: "Your habit of eating dinner as your heaviest meal is disrupting your cortisol rhythm — shift your largest meal to lunch."

Each point starts with • and is 20-25 words. Cover: sleep, movement, eating timing, stress.
Return only 4 points. No hedging words.` }
      ],
      temperature: 0.4, max_tokens: 300,
    })
    const lifestyle_guidelines = lifestyleRes.choices[0]?.message?.content?.trim() ?? ''

    // ── Call 3: Clinical notes ────────────────────────────────
    const clinicalRes = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Clinical nutritionist writing notes for yourself. ONLY use KB and Q&A. Be specific and clinical.' },
        { role: 'user', content: `PATIENT: ${patientProfile}

Q&A:
${qaContext || 'None.'}

KB CLINICAL KNOWLEDGE:
${kbContext}

Write 4 precise clinical notes about this specific patient:
• Biomarkers to track: list specific tests relevant to their condition with target ranges
• Dietary protocol: their specific dietary intervention based on their current eating patterns from Q&A and KB protocols
• Supplements: 2-3 specific supplements with exact doses, timing, and why for this patient's condition
• Watch for: specific red flags or contraindications relevant to their history

Each starts with •. Use their real details. Clinical and precise. Return only 4 points.` }
      ],
      temperature: 0.3, max_tokens: 400,
    })
    const nutritionist_guidelines = clinicalRes.choices[0]?.message?.content?.trim() ?? ''

    // ── Call 4: Weekly schedule — cause + action format ───────
    const totalWeeks = duration_months * 4
    const weeklyRes = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Return only a valid JSON array. No markdown, no code fences. Write cause and actions directly to the patient in second person. No hedging words. Never mention KB or knowledge base. Sound like a doctor who knows this patient personally.' },
        { role: 'user', content: `PATIENT: ${patientProfile}

FULL Q&A FROM CONSULTATION:
${qaContext || 'None.'}

KB CLINICAL KNOWLEDGE:
${kbContext}

Create exactly ${totalWeeks} weekly plans as a JSON array written directly to this patient.

RULES:
- cause: Write in second person to the patient. Name their SPECIFIC symptoms from Q&A. Be definitive — no "may", "might", "could". Example: "Your long-standing constipation has created chronic gut inflammation that is directly suppressing your metabolism and causing the fatigue you wake up with every day."
- actions: Write as direct prescriptions. Specific and actionable. Reference their real situation. Example: "Wake up 30 minutes earlier than your usual 8:30am and drink warm water before your morning tea and paratha."
- Never say "the patient", never mention "KB" or "knowledge base"
- Each week tackles a distinct root cause building on the previous week

[{
  "week_number": 1,
  "focus_theme": "Specific theme for this patient's condition",
  "cause": "2-3 sentences directly to this patient explaining what is happening in their body right now and why, referencing their specific symptoms.",
  "actions": [
    "Specific direct action for them — 12-18 words",
    "Another specific action tied to their real situation",
    "Third action — concrete and measurable"
  ]
}]

Exactly ${totalWeeks} items. week_number 1 to ${totalWeeks}. Progression: weeks 1-4 gut/foundation, weeks 5-8 metabolism/energy, weeks 9+ optimization.`
        }
      ],
      temperature: 0.3, max_tokens: 2500,
    })

    const weeklyRaw = weeklyRes.choices[0]?.message?.content ?? ''
    let weeklySchedule: unknown[]
    try {
      weeklySchedule = extractJSON(weeklyRaw) as unknown[]
      if (!Array.isArray(weeklySchedule)) throw new Error('Not an array')
      console.log('Weeks generated:', weeklySchedule.length)
    } catch {
      return NextResponse.json({ error: `Weekly parse failed. Raw: ${weeklyRaw.slice(0, 300)}` }, { status: 500 })
    }

    const { data: roadmap, error: roadmapError } = await supabaseAdmin
      .from('roadmaps')
      .insert({ session_id, patient_id, overview, lifestyle_guidelines, nutritionist_guidelines, weekly_schedule: weeklySchedule, duration_months, status: 'draft' })
      .select().single()

    if (roadmapError) throw new Error(roadmapError.message)
    await supabaseAdmin.from('sessions').update({ status: 'interpreted' }).eq('id', session_id)
    console.log('=== DONE ===')

    return NextResponse.json({ success: true, roadmap_id: roadmap.id, roadmap: { ...roadmap, weekly_schedule: weeklySchedule } })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}