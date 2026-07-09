import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { GoogleGenAI } from '@google/genai'

// NOTE: "gemini_doc" here refers to Google Meet's auto-generated transcript doc
// (the meeting notetaker), unrelated to the Gemini LLM API used below to parse it.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

const extractionSchema = {
  type: 'object',
  properties: {
    patient: {
      type: 'object',
      properties: {
        gender: { type: 'string', nullable: true, description: 'male, female, other, or null' },
        primary_concern: { type: 'string', nullable: true, description: "Most specific 1-sentence summary of the patient's main health concern with all relevant conditions mentioned" },
        medical_history: { type: 'string', nullable: true, description: 'All past diagnoses, surgeries, medications, family history as a paragraph' },
      },
    },
    qa_pairs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'Clinical question that this answer addresses' },
          answer: { type: 'string', description: 'Specific answer extracted from the consultation notes' },
        },
        required: ['question', 'answer'],
      },
    },
  },
  required: ['patient', 'qa_pairs'],
}

export async function POST(req: NextRequest) {
  try {
    const { gemini_doc, patient_id, session_id } = await req.json()
    if (!gemini_doc || !patient_id) {
      return NextResponse.json({ error: 'Missing gemini_doc or patient_id' }, { status: 400 })
    }

    // ── Extract structured data from the meeting transcript ───
    const response = await ai.models.generateContent({
      // Not flash-lite: measured directly hitting repeated 503 "high demand" errors
      // and 8-17s latency on its free tier right now, while standard flash was
      // consistently 0.6-1.2s with zero errors across the same test run.
      model: 'gemini-2.5-flash',
      contents: `Extract all clinical information from this consultation note:

${gemini_doc.slice(0, 4000)}

For qa_pairs, extract ALL clinical details as question-answer pairs covering:
- Current symptoms and complaints
- Diet and eating patterns
- Sleep quality and schedule
- Physical activity level
- Stress and mental health
- Gut health and digestion
- Hormonal or menstrual health
- Past treatments that worked or failed
- Lab results or test findings
- Lifestyle and work context

Extract as many qa_pairs as the document supports. Be specific and clinical in both questions and answers.`,
      config: {
        systemInstruction: 'You are a clinical data extractor. Extract structured information from a medical consultation note.',
        responseMimeType: 'application/json',
        responseSchema: extractionSchema,
        temperature: 0.1,
        maxOutputTokens: 2000,
        thinkingConfig: { thinkingBudget: 0 }, // this is a well-defined extraction
        // task, not reasoning — without this, Flash-Lite's default "thinking" adds
        // 13-17s of latency to a simple extraction (measured directly).
      },
    })

    const raw = response.text ?? ''
    console.log('Gemini parse raw:', raw.slice(0, 300))

    let extracted: {
      patient: { gender: string | null; primary_concern: string | null; medical_history: string | null }
      qa_pairs: { question: string; answer: string }[]
    }

    try {
      extracted = JSON.parse(raw)
    } catch (e) {
      return NextResponse.json({ error: `Parse failed: ${e instanceof Error ? e.message : e}. Raw: ${raw.slice(0, 200)}` }, { status: 500 })
    }

    // ── Update patient profile ────────────────────────────────
    const patientUpdate: Record<string, string | null> = {}
    if (extracted.patient?.gender) patientUpdate.gender = extracted.patient.gender
    if (extracted.patient?.primary_concern) patientUpdate.primary_concern = extracted.patient.primary_concern
    if (extracted.patient?.medical_history) patientUpdate.medical_history = extracted.patient.medical_history

    if (Object.keys(patientUpdate).length > 0) {
      await supabaseAdmin.from('patients').update(patientUpdate).eq('id', patient_id)
    }

    // ── Update session with Q&A pairs ─────────────────────────
    if (session_id && extracted.qa_pairs?.length > 0) {
      await supabaseAdmin.from('sessions').update({
        qa_pairs: extracted.qa_pairs,
        status: 'notes-added',
      }).eq('id', session_id)
    }

    return NextResponse.json({
      success: true,
      extracted: {
        patient: extracted.patient,
        qa_count: extracted.qa_pairs?.length ?? 0,
      }
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Parse Gemini error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
