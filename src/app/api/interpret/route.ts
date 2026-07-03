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
    const roadmapInstructions = session.roadmap_instructions ?? ''

    const fullQA = qaPairs.map((qa, i) => `Q${i+1}: ${qa.question}\nAnswer: ${qa.answer}`).join('\n\n')
    const geminiSnippet = session.gemini_doc_raw?.slice(0, 800) ?? ''

    // ── KB Search ────────────────────────────────────────────
    let kbContext = ''
    let kbSources: { title: string; source_type: string; chunk_preview: string }[] = []
    try {
      const stopWords = new Set(['the','patient','is','are','was','with','and','has','have','been','their','they','this','that','from','for','not','but','can','also','more','very','some','into','over','after','history','experiencing','currently'])
      const rawText = [patient.primary_concern, patient.medical_history, ...qaPairs.slice(0, 5).map(qa => qa.answer)].filter(Boolean).join(' ')
      const keywords = [...new Set(rawText.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w)).slice(0, 10))].join(' | ')
      console.log('KB keywords:', keywords)

      // Search per keyword to get chunks from DIFFERENT books
      const keywordList = keywords.split(' | ').filter(Boolean)
      const allChunks: {content: string; document_id: string}[] = []

      for (const kw of keywordList.slice(0, 6)) {
        const { data: kwChunks } = await supabaseAdmin
          .from('kb_chunks').select('content, document_id')
          .textSearch('content', kw, { type: 'websearch', config: 'english' })
          .limit(3)
        if (kwChunks?.length) {
          for (const chunk of kwChunks) {
            const docChunkCount = allChunks.filter((c: {document_id:string}) => c.document_id === chunk.document_id).length
            if (docChunkCount < 2) allChunks.push(chunk)
          }
        }
      }

      const chunks = allChunks.slice(0, 10)

      if (chunks?.length) {
        const docIds = [...new Set(chunks.map((c: {document_id:string}) => c.document_id))]
        const { data: docs } = await supabaseAdmin.from('kb_documents').select('id, title, source_type').in('id', docIds)
        const docMap = Object.fromEntries((docs ?? []).map((d: {id:string;title:string;source_type:string}) => [d.id, d]))
        kbContext = chunks.map((c: {content:string}, i: number) => `[KB ${i+1}]: ${c.content.slice(0, 350)}`).join('\n\n')
        kbSources = docIds.map(id => ({ title: docMap[id]?.title ?? 'Unknown', source_type: docMap[id]?.source_type ?? 'unknown', chunk_preview: chunks.find((c: {document_id:string}) => c.document_id === id)?.content?.slice(0, 80) ?? '' }))
        console.log('KB chunks:', chunks.length, 'from', docIds.length, 'books:', kbSources.map(s => s.title.split('(')[0].trim()).join(', '))
      } else {
        const { data: fb } = await supabaseAdmin.from('kb_chunks').select('content, document_id').limit(6)
        if (fb?.length) {
          const docIds = [...new Set(fb.map((c: {document_id:string}) => c.document_id))]
          const { data: docs } = await supabaseAdmin.from('kb_documents').select('id, title, source_type').in('id', docIds)
          const docMap = Object.fromEntries((docs ?? []).map((d: {id:string;title:string;source_type:string}) => [d.id, d]))
          kbContext = fb.map((c: {content:string}, i: number) => `[KB ${i+1}]: ${c.content.slice(0, 300)}`).join('\n\n')
          kbSources = docIds.map(id => ({ title: docMap[id]?.title ?? 'Unknown', source_type: docMap[id]?.source_type ?? 'unknown', chunk_preview: fb.find((c: {document_id:string}) => c.document_id === id)?.content?.slice(0, 80) ?? '' }))
          console.log('KB fallback:', fb.length, 'chunks')
        }
      }
    } catch (e) { console.log('KB error:', e) }

    // ── STEP 1: Extract specific patient facts ────────────────
    // This is the key step — pull exact facts before generating
    console.log('Step 1: Extracting patient facts...')
    const factsRes = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Extract specific clinical facts from the consultation. Return only a bullet list of specific, measurable, named facts. No generalisations. Only what is explicitly stated.' },
        { role: 'user', content: `Patient: ${patient.full_name}, ${patient.gender ?? ''}, Concern: ${patient.primary_concern}

Gemini meeting notes:
${geminiSnippet}

Q&A:
${fullQA || 'None'}

Extract every specific fact mentioned:
- Exact symptoms (with duration, frequency, severity)
- Exact diet details (what they eat, when, how much)
- Exact lifestyle (sleep times, work hours, exercise history)
- Exact medical history (conditions, dates, medications, test results)
- Exact measurements (weight, height, lab values)
- Specific habits (good and bad)
- What has worked or failed before

Return as a bullet list. Every point must be specific and sourced from the data above. NO generalisations.` }
      ],
      temperature: 0.1,
      max_tokens: 600,
    })
    const patientFacts = factsRes.choices[0]?.message?.content?.trim() ?? ''
    console.log('Facts extracted:', patientFacts.slice(0, 200))

    // ── STEP 2: Overview ─────────────────────────────────────
    const overviewRes = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: `You are ${patient.full_name}'s treating nutritionist at Clinic Living Plus. Write directly to her/him.
STRICT RULES:
- Every sentence MUST reference a specific fact from the PATIENT FACTS list below
- Use exact details: their real food, their real symptoms, their real schedule
- FORBIDDEN words: "may", "might", "could", "possibly", "often", "many people", "typically", "generally"
- If you write something not in the facts list, delete it
- Tone: warm, direct, like a doctor who knows them personally` },
        { role: 'user', content: `PATIENT FACTS (use ONLY these):
${patientFacts}

NUTRITIONIST INSTRUCTIONS:
${roadmapInstructions || 'Focus on root cause healing based on their specific condition.'}

KB CLINICAL KNOWLEDGE:
${kbContext || 'Use clinical expertise.'}

Write 2 paragraphs directly to ${patient.full_name}.
Paragraph 1: Describe exactly what is happening in their body right now — using their specific symptoms, test results, eating patterns from the facts list.
Paragraph 2: Tell them exactly what will change over ${duration_months} months — specific to their condition and goals.
Use "you" throughout. Reference their real details. No generic health advice.` }
      ],
      temperature: 0.5,
      max_tokens: 400,
    })
    const overview = overviewRes.choices[0]?.message?.content?.trim() ?? ''

    // ── STEP 3: Lifestyle guidelines ─────────────────────────
    const lifestyleRes = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Clinical nutritionist. Write 4 lifestyle prescriptions directly to the patient. Each must reference a specific fact from their consultation. No generic advice.' },
        { role: 'user', content: `PATIENT FACTS:
${patientFacts}

KB:
${kbContext || 'Use expertise.'}

Write 4 lifestyle changes for this specific patient.
Each must:
- Start with • 
- Reference their actual habit/pattern (e.g. "Your habit of sleeping at 1am..." not "You should sleep earlier")
- Give a specific, actionable change
- Explain why in 1 sentence based on their condition
- Be 20-25 words

Return only 4 bullet points. No intro, no outro.` }
      ],
      temperature: 0.3,
      max_tokens: 300,
    })
    const lifestyle_guidelines = lifestyleRes.choices[0]?.message?.content?.trim() ?? ''

    // ── STEP 4: Clinical notes ────────────────────────────────
    const clinicalRes = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Clinical nutritionist writing notes. Use only patient facts and KB. Be specific and clinical.' },
        { role: 'user', content: `PATIENT FACTS:
${patientFacts}

KB:
${kbContext || 'Use expertise.'}

Write 4 clinical notes:
• Biomarkers: specific tests to track for this patient's exact condition with target ranges
• Diet protocol: specific dietary intervention based on their actual eating patterns
• Supplements: 2-3 specific supplements with exact doses, timing, and clinical reason for this patient
• Red flags: specific warning signs to watch for given their history

Each starts with •. Specific to this patient. No generic statements.` }
      ],
      temperature: 0.2,
      max_tokens: 400,
    })
    const nutritionist_guidelines = clinicalRes.choices[0]?.message?.content?.trim() ?? ''

    // ── STEP 5: Weekly schedule ───────────────────────────────
    // Handle short durations: 0.25 = 1 week, 0.5 = 2 weeks
    const totalWeeks = duration_months < 1
      ? Math.round(duration_months * 4)
      : duration_months * 4
    const weeklyRes = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Return only a valid JSON array. No markdown. Write cause and actions directly to the patient using their specific facts. Never write generic health advice.' },
        { role: 'user', content: `PATIENT FACTS (the only source of truth — use these specific details):
${patientFacts}

KB CLINICAL KNOWLEDGE:
${kbContext || 'Use expertise.'}

NUTRITIONIST INSTRUCTIONS:
${roadmapInstructions || `Weeks 1-${Math.ceil(totalWeeks/3)}: address root causes from facts. Weeks ${Math.ceil(totalWeeks/3)+1}-${Math.ceil(totalWeeks*2/3)}: build on improvements. Weeks ${Math.ceil(totalWeeks*2/3)+1}-${totalWeeks}: optimise and sustain.`}

Create exactly ${totalWeeks} weekly plans.

RULES:
- cause: Must reference a SPECIFIC fact from the patient's data. Say "Your [specific symptom/habit] is causing [specific effect]" — not "Gut inflammation can cause weight gain"
- actions: Must be specific to this patient's life. Reference their real food, real schedule, real habits. "Replace your morning paratha with..." not "Eat healthier in the morning"
- Each week must feel written for THIS patient, not for anyone with this condition
- Never use: "many people", "typically", "often", "may", "might", "could"

[{
  "week_number": 1,
  "focus_theme": "Specific theme tied to their condition",
  "cause": "2 sentences directly to patient using their specific facts. Name their real symptom and explain the exact mechanism.",
  "actions": [
    "Specific action referencing their real life — 12-18 words",
    "Another action from their specific situation",
    "Third action tied to their exact habits or schedule"
  ]
}]

Exactly ${totalWeeks} items.` }
      ],
      temperature: 0.3,
      max_tokens: 2500,
    })

    const weeklyRaw = weeklyRes.choices[0]?.message?.content ?? ''
    let weeklySchedule: unknown[]
    try {
      weeklySchedule = extractJSON(weeklyRaw) as unknown[]
      if (!Array.isArray(weeklySchedule)) throw new Error('Not an array')
      console.log('Weeks:', weeklySchedule.length)
    } catch {
      return NextResponse.json({ error: `Weekly parse failed. Raw: ${weeklyRaw.slice(0, 300)}` }, { status: 500 })
    }

    // ── Save ─────────────────────────────────────────────────
    const { data: roadmap, error: roadmapError } = await supabaseAdmin
      .from('roadmaps')
      .insert({ session_id, patient_id, overview, lifestyle_guidelines, nutritionist_guidelines, weekly_schedule: weeklySchedule, kb_sources: kbSources, duration_months, status: 'draft' })
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