'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Wand2, Loader2, ArrowLeft, Share2, ExternalLink, Check } from 'lucide-react'
import Link from 'next/link'

type WeeklyPlan = {
  week_number: number
  focus_theme: string
  cause: string
  actions: string[]
  milestone?: string
}

type KbSource = { title: string; source_type: string; chunk_preview: string }

type Roadmap = {
  id: string
  overview: string
  lifestyle_guidelines: string
  nutritionist_guidelines: string
  weekly_schedule: WeeklyPlan[]
  kb_sources: KbSource[]
  duration_months: number
}

const DURATION_OPTIONS = [
  { label: '1 Week', months: 0.25 },
  { label: '2 Weeks', months: 0.5 },
  { label: '1 Month', months: 1 },
  { label: '2 Months', months: 2 },
  { label: '3 Months', months: 3 },
  { label: '6 Months', months: 6 },
]

export default function InterpretPage() {
  const params = useParams()
  const patientId = params.id as string
  const sessionId = params.sessionId as string

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [error, setError] = useState('')
  const [duration, setDuration] = useState(1)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function loadExisting() {
      try {
        const res = await fetch(`/api/roadmaps?session_id=${sessionId}`)
        if (res.ok) {
          const json = await res.json()
          if (json?.id) setRoadmap(json)
        }
      } catch {}
      finally { setFetching(false) }
    }
    loadExisting()
  }, [sessionId])

  async function generateRoadmap() {
    setLoading(true)
    setError('')
    setShareUrl(null)
    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, patient_id: patientId, duration_months: duration }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Generation failed'); return }
      setRoadmap(json.roadmap)
    } catch { setError('Network error — try again') }
    finally { setLoading(false) }
  }

  async function handleShare() {
    if (!roadmap) return
    setSharing(true)
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roadmap_id: roadmap.id }),
      })
      const json = await res.json()
      const fullUrl = window.location.origin + json.share_url
      setShareUrl(fullUrl)
      navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
    finally { setSharing(false) }
  }

  if (fetching) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <Loader2 size={28} color="#538A22" style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ maxWidth: 860 }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Back */}
      <Link href={`/patients/${patientId}/sessions/${sessionId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft size={14} /> Back to Session
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>Patient Roadmap</h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 3 }}>Generate → Share with patient → They get a checklist</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!roadmap && DURATION_OPTIONS.map(({ label, months }) => (
            <button key={label} onClick={() => setDuration(months)}
              style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: duration === months ? '#538A22' : '#d1d5db', background: duration === months ? '#F2F9EC' : '#fff', color: duration === months ? '#538A22' : '#6b7280' }}>
              {label}
            </button>
          ))}
          {roadmap ? (
            <>
              <button onClick={handleShare} disabled={sharing}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {sharing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : copied ? <Check size={13} /> : <Share2 size={13} />}
                {copied ? 'Link Copied!' : 'Share with Patient'}
              </button>
              {shareUrl && (
                <a href={shareUrl} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, background: '#F2F9EC', color: '#538A22', border: '1px solid #C8E9A8', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                  <ExternalLink size={13} /> Preview
                </a>
              )}
              <button onClick={() => { setRoadmap(null); setShareUrl(null) }}
                style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>
                ↺ Regenerate
              </button>
            </>
          ) : (
            <button onClick={generateRoadmap} disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#538A22', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1 }}>
              {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={15} />}
              {loading ? 'Generating...' : 'Generate Roadmap'}
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{error}</div>}
      {loading && <div style={{ background: '#F2F9EC', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#538A22', marginBottom: 16 }}>🔍 Searching KB → 🧠 Interpreting → ✍️ Writing plan (~30s)...</div>}

      {!roadmap && !loading && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '48px 24px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>
          <Wand2 size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontSize: 15, fontWeight: 500, color: '#374151' }}>No roadmap yet</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Select a duration above and click Generate Roadmap</p>
        </div>
      )}

      {roadmap && (
        <div>
          {/* Share banner */}
          {shareUrl && (
            <div style={{ background: '#F2F9EC', border: '1px solid #C8E9A8', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Check size={16} color="#538A22" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#3a6118' }}>Share link copied to clipboard</div>
                <div style={{ fontSize: 12, color: '#538A22', marginTop: 2 }}>{shareUrl}</div>
              </div>
              <a href={shareUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#538A22', fontWeight: 600, textDecoration: 'none' }}>Open →</a>
            </div>
          )}

          {/* Overview */}
          <div style={{ background: 'linear-gradient(135deg, #1a2e0f, #538A22)', borderRadius: 14, padding: '24px 28px', marginBottom: 20, color: '#fff' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#C8E9A8', marginBottom: 10 }}>✨ Transformation Overview</div>
            <div style={{ fontSize: 14, lineHeight: 1.85, whiteSpace: 'pre-wrap', color: 'rgba(255,255,255,0.92)' }}>{roadmap.overview}</div>
          </div>

          {/* KB Sources */}
          {roadmap.kb_sources?.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '14px 18px', marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#538A22', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 10 }}>
                ✅ Generated from {roadmap.kb_sources.length} Knowledge Base source{roadmap.kb_sources.length > 1 ? 's' : ''}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {roadmap.kb_sources.map((s, i) => (
                  <div key={i} style={{ fontSize: 12, background: '#F2F9EC', color: '#3a6118', padding: '4px 12px', borderRadius: 20, fontWeight: 500 }}>
                    {s.source_type === 'book' ? '📚' : s.source_type === 'podcast' ? '🎙️' : '📋'} {s.title}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full week cards — coach view */}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16 }}>
              {roadmap.weekly_schedule?.length}-Week Action Plan
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {roadmap.weekly_schedule?.map((week) => (
                <div key={week.week_number} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                  {/* Week header */}
                  <div style={{ background: 'linear-gradient(135deg, #538A22, #3a6118)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                      {week.week_number}
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Week {week.week_number}</div>
                      <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{week.focus_theme}</div>
                    </div>
                  </div>
                  {/* Root cause */}
                  <div style={{ padding: '12px 18px', borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 5 }}>🔍 Root Cause</div>
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.65, fontStyle: 'italic' }}>{week.cause}</div>
                  </div>
                  {/* Actions checklist */}
                  <div style={{ padding: '12px 18px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#538A22', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 10 }}>✨ Actions</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(week.actions ?? []).map((action, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', background: '#f9fafb', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                          <div style={{ width: 20, height: 20, borderRadius: 4, border: '2px solid #d1d5db', flexShrink: 0, marginTop: 1 }} />
                          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{action}</div>
                        </div>
                      ))}
                    </div>
                    {week.milestone && (
                      <div style={{ marginTop: 12, padding: '10px 14px', background: 'linear-gradient(135deg, #F2F9EC, #e8f5e0)', borderRadius: 8, border: '1px solid #C8E9A8' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#538A22', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 4 }}>🎯 Expected outcome this week</div>
                        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{week.milestone}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16, padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
            💡 Click <strong>Share with Patient</strong> above to send them the full interactive checklist version with progress tracking.
          </div>
        </div>
      )}
    </div>
  )
}
