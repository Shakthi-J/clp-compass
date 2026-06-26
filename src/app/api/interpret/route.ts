import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getEmbedding } from '@/lib/embeddings'
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

    let queryEmbedding: number[]
    try {
      queryEmbedding = await getEmbedding(searchQuery)
      console.log('Embedding OK, dims:', queryEmbedding.length)
    } catch (e) {
      return NextResponse.json({ error: `Embedding failed: ${e instanceof Error ? e.message : e}` }, { status: 500 })
    }

    const { data: chunks, error: kbError } = await supabaseAdmin.rpc('match_kb_chunks', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_threshold: 0.2,
      match_count: 8,
    })
    if (kbError) return NextResponse.json({ error: `KB search failed: ${kbError.message}` }, { status: 500 })
    console.log('KB chunks:', chunks?.length ?? 0)

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ error: `No KB content found for: ${patient.primary_concern}. Add relevant documents to the knowledge base.` }, { status: 400 })
    }

    const kbContext = chunks
      .map((c: { content: string }, i: number) => `[KB ${i+1}]: ${c.content.slice(0, 400)}`)
      .join('\n\n')

    const patientProfile = `Name: ${patient.full_name} | Gender: ${patient.gender ?? 'N/A'} | Concern: ${patient.primary_concern ?? 'General health'} | History: ${patient.medical_history ?? 'None'}`

    // ── Call 1: Overview (Enhanced for deep positive framing) ────────────────
    const overviewRes = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: `You are the treating head nutritionist at Clinic Living Plus, Bangalore. You are writing an inspiring, deeply personalized health vision statement directly to YOUR patient. 
Rules:
- Write entirely in second person: "you", "your" — never "the patient".
- Tone: Highly motivational, deeply empathetic, yet clinical and definitive. No hedging words like "may", "might", "could".
- Empower them: Frame their body not as broken, but as working hard to heal. Frame changes as exciting upgrades rather than restrictions.` },
        { role: 'user', content: `PATIENT: ${patientProfile}
Q&A: ${qaContext || 'None.'}
SESSION NOTES: ${sessionNotes || 'None.'}
KB CLINICAL KNOWLEDGE: ${kbContext}

Write 2-3 paragraphs directly to ${patient.full_name}:
1. Acknowledge their specific symptoms/rhythm intimately using their exact details. Validate how they've been feeling.
2. Paint a vivid picture of what is happening inside their biology right now based on the KB (e.g., sluggish liver, high cortisol), but immediately switch to a triumphant framing of how we are going to reverse it.
3. Outline their transformative timeline: "By Week 2, your morning fog clears. By Month 2, your digestive fire stabilizes..." Make them desperate to start this roadmap. Use their name. Max 175 words.` }
      ],
      temperature: 0.6, max_tokens: 400,
    })
    const overview = overviewRes.choices[0]?.message?.content?.trim() ?? ''

    // ── Call 2: Lifestyle guidelines ─────────────────────────
    const lifestyleRes = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are the treating nutritionist writing a personal lifestyle prescription for YOUR patient. Write in second person only. Use their exact details. Be definitive — no hedging. Never say "the patient". Never mention KB.' },
        { role: 'user', content: `PATIENT: ${patientProfile}\nQ&A:\n${qaContext || 'None.'}\nKB KNOWLEDGE:\n${kbContext}

Write 4 lifestyle prescriptions directly to this patient using "you/your". Use their real lifestyle flaws (late sleep, long sitting, meal skipping) to build corrective habits.
Format as: "• [Empowering Alternative]: [Brief clinical reason tied to their schedule]"
Each point must be 20-25 words. Cover: sleep, movement, eating timing, stress. Return only 4 points.` }
      ],
      temperature: 0.4, max_tokens: 300,
    })
    const lifestyle_guidelines = lifestyleRes.choices[0]?.message?.content?.trim() ?? ''

    // ── Call 3: Clinical notes ────────────────────────────────
    const clinicalRes = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Clinical nutritionist writing notes for yourself. ONLY use KB and Q&A. Be specific and clinical.' },
        { role: 'user', content: `PATIENT: ${patientProfile}\nQ&A:\n${qaContext || 'None.'}\nKB CLINICAL KNOWLEDGE:\n${kbContext}

Write 4 precise clinical notes about this specific patient:
• Biomarkers to track: list specific tests relevant to their condition with target ranges
• Dietary protocol: their specific dietary intervention based on their current eating patterns from Q&A and KB protocols
• Supplements: 2-3 specific supplements with exact doses, timing, and why for this patient's condition
• Watch for: specific red flags or contraindications relevant to their history

Each starts with •. Return only 4 points.` }
      ],
      temperature: 0.3, max_tokens: 400,
    })
    const nutritionist_guidelines = clinicalRes.choices[0]?.message?.content?.trim() ?? ''

    // ── Call 4: Weekly schedule — (Enhanced for Gamification and Visual Journey) ───────
    const totalWeeks = duration_months * 4
    const weeklyRes = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Return only a valid JSON array. No markdown wraps, no code block backticks. Write directly to the patient in second person. Use absolute, encouraging, authoritative language.' },
        { role: 'user', content: `PATIENT: ${patientProfile}\nFULL Q&A:\n${qaContext || 'None.'}\nKB CLINICAL KNOWLEDGE:\n${kbContext}

Create exactly ${totalWeeks} weekly plans as a JSON array for the patient's winding roadmap.

CRITICAL ENGAGEMENT RULES:
1. focus_theme: Must look like an epic, gamified quest milestone (e.g., "Igniting the Digestive Fire", "Unlocking Deep REM Sleep", "The Cellular Energy Shift"). Make it sound exciting!
2. Week 1 Strategy: Ensure actions for Week 1 include immediate "Quick Wins" that take less than 2 minutes but make them feel fantastic, building psychological momentum.
3. Language styling: Avoid negative restriction words like "Stop", "Don't", "Quit", "Avoid". Instead use abundance/crowding-out terms (e.g., "Crowd out your midday crash by introducing...", "Upgrade your late night rhythm by swapping...").
4. Context: Blend clinical precision with Indian/Bangalore lifestyle context where applicable (e.g., handling Swiggy habits, balancing white rice/roti, late IT sector shifts).

JSON Schema to follow exactly:
[{
  "week_number": 1,
  "focus_theme": "Exciting, gamified title for this milestone",
  "cause": "2 sentences directly explaining the physiological root cause behind their symptom, ensuring they understand the 'why'. No hedging.",
  "actions": [
    "Action 1 (Quick momentum win, active phrasing) — 12-18 words",
    "Action 2 (Dietary crowd-out action) — 12-18 words",
    "Action 3 (Lifestyle/timing action) — 12-18 words"
  ]
}]

Generate exactly ${totalWeeks} items. Progress through phases: weeks 1-4 foundation, weeks 5-8 integration/energy, weeks 9+ optimization.`
        }
      ],
      temperature: 0.4, max_tokens: 3000,
    })

    const weeklyRaw = weeklyRes.choices[0]?.message?.content ?? ''
    let weeklySchedule: unknown[]
    try {
      weeklySchedule = extractJSON(weeklyRaw) as unknown[]
      if (!Array.isArray(weeklySchedule)) throw new Error('Not an array')
      console.log('Weeks generated successfully:', weeklySchedule.length)
    } catch {
      return NextResponse.json({ error: `Weekly parse failed. Raw text length: ${weeklyRaw.length}` }, { status: 500 })
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
    console.error('Error in route:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}