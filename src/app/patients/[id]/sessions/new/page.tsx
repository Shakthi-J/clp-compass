'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

export default function NewSessionPage() {
  const router = useRouter()
  const params = useParams()
  const patientId = params.id as string

  const [sessionType, setSessionType] = useState<'first-meet' | 'follow-up' | 'review'>('first-meet')
  const [geminiDoc, setGeminiDoc] = useState('')
  const [preNotes, setPreNotes] = useState('')
  const [showGemini, setShowGemini] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<{ qa_count: number } | null>(null)
  const [sessionCount, setSessionCount] = useState(0)

  // Check if this patient has existing sessions
  useEffect(() => {
    fetch(`/api/sessions?patient_id=${patientId}`)
      .then(r => r.json())
      .then(data => {
        const count = Array.isArray(data) ? data.length : 0
        setSessionCount(count)
        if (count > 0) setSessionType('follow-up')
      })
      .catch(() => {})
  }, [patientId])

  const isFirstSession = sessionCount === 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const sessionRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          session_type: sessionType,
          gemini_doc_raw: geminiDoc || null,
          pre_meeting_notes: preNotes || null,
        }),
      })
      const sessionJson = await sessionRes.json()
      if (!sessionRes.ok) { setError(sessionJson.error || 'Failed'); setLoading(false); return }

      const sessionId = sessionJson.id

      // Auto-parse Gemini doc if pasted
      if (geminiDoc.trim().length > 100) {
        setParsing(true)
        const parseRes = await fetch('/api/parse-gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gemini_doc: geminiDoc, patient_id: patientId, session_id: sessionId }),
        })
        const parseJson = await parseRes.json()
        setParsing(false)
        if (parseRes.ok) setParsed(parseJson.extracted)
      }

      router.push(`/patients/${patientId}/sessions/${sessionId}`)
    } catch {
      setError('Network error — try again')
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <Link href={`/patients/${patientId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Patient
      </Link>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>
          {isFirstSession ? 'Start First Session' : 'New Session'}
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          {isFirstSession
            ? 'Paste the Gemini meeting doc — AI will extract everything automatically.'
            : 'Add session notes or paste the Gemini doc from your meeting.'
          }
        </p>
      </div>

      {/* Flow steps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
        {(isFirstSession
          ? ['Start Session', 'Paste Gemini Doc', 'Generate Roadmap']
          : ['Add Session', 'Paste Gemini Doc', 'Update Roadmap']
        ).map((step, i, arr) => (
          <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? '#538A22' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: i === 0 ? '#fff' : '#9ca3af', flexShrink: 0 }}>{i + 1}</div>
              <span style={{ fontSize: 12, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? '#538A22' : '#9ca3af', whiteSpace: 'nowrap' }}>{step}</span>
            </div>
            {i < arr.length - 1 && <div style={{ flex: 1, height: 1, background: '#e5e7eb', margin: '0 8px' }} />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb' }}>

        {/* Session type */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Session Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['first-meet', 'follow-up', 'review'] as const).map(t => (
              <button key={t} type="button" onClick={() => setSessionType(t)} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid', borderColor: sessionType === t ? '#538A22' : '#e5e7eb', background: sessionType === t ? '#F2F9EC' : '#fff', color: sessionType === t ? '#538A22' : '#6b7280', textTransform: 'capitalize' }}>
                {t.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Pre-session notes */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Pre-Session Notes <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span>
          </label>
          <textarea
            value={preNotes}
            onChange={e => setPreNotes(e.target.value)}
            rows={3}
            placeholder={isFirstSession
              ? "Any observations before the session starts — patient background, referral notes..."
              : "Notes before the follow-up — what you want to check on, concerns from last session..."
            }
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical' }}
          />
        </div>

        {/* Gemini doc */}
<div style={{ marginBottom: 20 }}>
  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
    Gemini Meeting Document <span style={{ fontSize: 11, fontWeight: 400, color: '#538A22', marginLeft: 8 }}>← paste to auto-extract everything</span>
  </label>
  <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Copy from your Google Meet Gemini notes — AI extracts patient profile, symptoms, diet, habits and generates Q&A automatically</p>
  <textarea
    value={geminiDoc}
    onChange={e => setGeminiDoc(e.target.value)}
    rows={10}
    placeholder="Paste the full Gemini meeting document here..."
    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '2px solid #C8E9A8', fontSize: 13, resize: 'vertical', background: '#fafff8' }}
  />
</div>

        {/* Status messages */}
        {parsing && (
          <div style={{ background: '#F2F9EC', border: '1px solid #C8E9A8', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={14} color="#538A22" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: '#3a6118', fontWeight: 600 }}>AI is extracting clinical data from the Gemini doc...</span>
          </div>
        )}
        {parsed && (
          <div style={{ background: '#F2F9EC', border: '1px solid #C8E9A8', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#3a6118', fontWeight: 600 }}>
            ✅ Extracted {parsed.qa_count} Q&A pairs — patient profile updated
          </div>
        )}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 14 }}>{error}</div>
        )}

        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: '12px', background: '#538A22', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Saving...' : isFirstSession ? 'Save & Extract from Gemini Doc' : 'Save & Extract from Gemini Doc'}
        </button>
      </form>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}