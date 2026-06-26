'use client'
import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Loader2, Sparkles, CheckCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewSessionPage() {
  const router = useRouter()
  const params = useParams()
  const patientId = params.id as string

  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<{ qa_count: number; patient: Record<string, string> } | null>(null)
  const [parseError, setParseError] = useState('')
  const [error, setError] = useState('')

  const [sessionType, setSessionType] = useState('first-meet')
  const [geminiDoc, setGeminiDoc] = useState('')
  const [preNotes, setPreNotes] = useState('')
  const [postNotes, setPostNotes] = useState('')

  // Step 1: Save session first, get session ID back
  // Step 2: Parse Gemini doc against that session ID
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Save session
      const sessionRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          session_type: sessionType,
          gemini_doc_raw: geminiDoc || null,
          pre_meeting_notes: preNotes || null,
          post_meeting_notes: postNotes || null,
        }),
      })
      const sessionJson = await sessionRes.json()
      if (!sessionRes.ok) { setError(sessionJson.error || 'Failed to save session'); setLoading(false); return }

      const sessionId = sessionJson.id

      // Auto-parse Gemini doc if present
      if (geminiDoc.trim().length > 100) {
        setParsing(true)
        const parseRes = await fetch('/api/parse-gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gemini_doc: geminiDoc,
            patient_id: patientId,
            session_id: sessionId,
          }),
        })
        const parseJson = await parseRes.json()
        setParsing(false)

        if (!parseRes.ok) {
          setParseError(`Auto-extract warning: ${parseJson.error}`)
          // Still redirect even if parse fails
        } else {
          setParsed(parseJson.extracted)
          // Small delay to show success state
          await new Promise(r => setTimeout(r, 1200))
        }
      }

      router.push(`/patients/${patientId}/sessions/${sessionId}`)
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <Link href={`/patients/${patientId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Patient
      </Link>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>New Session</h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>
          Paste the Gemini meeting doc — AI will automatically extract the patient profile and clinical Q&A.
        </p>
      </div>

      {/* How it works banner */}
      <div style={{ background: '#F2F9EC', border: '1px solid #C8E9A8', borderRadius: 10, padding: '14px 18px', marginBottom: 22, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Sparkles size={18} color="#538A22" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#3a6118', marginBottom: 3 }}>AI Auto-Extract</div>
          <div style={{ fontSize: 12, color: '#538A22', lineHeight: 1.6 }}>
            Paste the full Gemini meeting document below. AI will extract the patient's health concern, medical history, and all clinical details as Q&A pairs — ready for roadmap generation.
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, padding: 28, border: '1px solid #e5e7eb' }}>

        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Session Type</label>
          <select value={sessionType} onChange={e => setSessionType(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, background: '#fff' }}>
            <option value="first-meet">First Meet</option>
            <option value="follow-up">Follow-up</option>
            <option value="review">Review</option>
          </select>
        </div>

        {/* Gemini doc — main input */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
            Gemini Meeting Document <span style={{ color: '#538A22', fontWeight: 400, fontSize: 12 }}>← paste here for auto-extract</span>
          </label>
          <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
            Copy the full text from your Google Meet Gemini notes and paste below
          </p>
          <textarea
            value={geminiDoc}
            onChange={e => setGeminiDoc(e.target.value)}
            rows={10}
            placeholder="Paste the full Gemini meeting document here...

The AI will automatically extract:
• Patient's primary health concern
• Medical history and past diagnoses  
• Lifestyle patterns (diet, sleep, stress, activity)
• Gut health and symptoms
• Lab results and clinical findings
• All Q&A pairs for roadmap generation"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '2px solid #C8E9A8', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, background: '#fafff8' }}
          />
        </div>

        {/* Optional notes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Pre-Meeting Notes <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
            <textarea value={preNotes} onChange={e => setPreNotes(e.target.value)} rows={3}
              placeholder="Your thoughts before the session..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Post-Meeting Notes <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
            <textarea value={postNotes} onChange={e => postNotes(e.target.value)} rows={3}
              placeholder="Observations after the session..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical' }} />
          </div>
        </div>

        {/* Status messages */}
        {parsing && (
          <div style={{ background: '#F2F9EC', border: '1px solid #C8E9A8', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Loader2 size={16} color="#538A22" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#3a6118' }}>AI is extracting clinical data...</div>
              <div style={{ fontSize: 12, color: '#538A22', marginTop: 2 }}>Reading patient profile, symptoms, lifestyle patterns from Gemini doc</div>
            </div>
          </div>
        )}

        {parsed && !parsing && (
          <div style={{ background: '#F2F9EC', border: '1px solid #C8E9A8', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircle size={16} color="#538A22" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#3a6118' }}>Extracted successfully</div>
              <div style={{ fontSize: 12, color: '#538A22', marginTop: 2 }}>
                Patient profile updated · {parsed.qa_count} Q&A pairs generated · Ready for roadmap
              </div>
            </div>
          </div>
        )}

        {parseError && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400e' }}>
            ⚠️ {parseError} — session saved, but check patient profile manually.
          </div>
        )}

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => router.back()}
            style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 14, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading || parsing}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 8, background: '#538A22', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: (loading || parsing) ? 'not-allowed' : 'pointer', opacity: (loading || parsing) ? 0.7 : 1 }}>
            {loading || parsing
              ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> {parsing ? 'Extracting...' : 'Saving...'}</>
              : <><Sparkles size={15} /> Save & Auto-Extract</>
            }
          </button>
        </div>
      </form>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}