'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Wand2, Loader2, ArrowLeft, Printer } from 'lucide-react'
import Link from 'next/link'

type WeeklyPlan = {
  week_number: number
  focus_theme: string
  goals: string[]
  recipes: string[]
  supplements: string[]
}

type Roadmap = {
  id: string
  overview: string
  lifestyle_guidelines: string
  nutritionist_guidelines: string
  weekly_schedule: WeeklyPlan[]
  duration_months: number
}

const PIN_COLORS = ['#e11d48', '#f59e0b', '#3b82f6', '#538A22']
const MONTH_LABELS = ['Month 1', 'Month 2', 'Month 3']

export default function InterpretPage() {
  const params = useParams()
  const patientId = params.id as string
  const sessionId = params.sessionId as string

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [error, setError] = useState('')
  const [duration, setDuration] = useState(3)

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

  // Group weeks by month
  const months: WeeklyPlan[][] = []
  if (roadmap?.weekly_schedule) {
    for (let i = 0; i < roadmap.weekly_schedule.length; i += 4) {
      months.push(roadmap.weekly_schedule.slice(i, i + 4))
    }
  }

  if (fetching) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <Loader2 size={28} color="#538A22" style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .print-page { padding: 0 !important; margin: 0 !important; }
          .page-break { page-break-before: always; }
        }
      `}</style>

      {/* Toolbar — hidden on print */}
      <div className="no-print" style={{ marginBottom: 24 }}>
        <Link href={`/patients/${patientId}/sessions/${sessionId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', textDecoration: 'none', marginBottom: 16 }}>
          <ArrowLeft size={14} /> Back to Session
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>Patient Roadmap</h1>
            <p style={{ color: '#6b7280', fontSize: 13, marginTop: 3 }}>Generate once, export as PDF</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!roadmap && [1,2,3].map(m => (
              <button key={m} onClick={() => setDuration(m)} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: duration === m ? '#538A22' : '#d1d5db', background: duration === m ? '#F2F9EC' : '#fff', color: duration === m ? '#538A22' : '#6b7280' }}>{m} Month{m>1?'s':''}</button>
            ))}
            {roadmap
              ? <>
                  <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 20px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <Printer size={15} /> Export PDF
                  </button>
                  <button onClick={() => { setRoadmap(null); setError('') }} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>↺ Regenerate</button>
                </>
              : <button onClick={generateRoadmap} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#538A22', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.8 : 1 }}>
                  {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Wand2 size={15} />}
                  {loading ? 'Generating...' : 'Generate'}
                </button>
            }
          </div>
        </div>
        {error && <div style={{ marginTop: 14, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13 }}>{error}</div>}
        {loading && <div style={{ marginTop: 14, background: '#F2F9EC', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#538A22' }}>🔍 Searching KB → 🧠 Interpreting → ✍️ Writing plan (takes ~30s)...</div>}
      </div>

      {!roadmap && !loading && (
        <div className="no-print" style={{ background: '#fff', borderRadius: 12, padding: '48px 24px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>
          <Wand2 size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontSize: 15, fontWeight: 500, color: '#374151' }}>No roadmap yet</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Select a duration and click Generate</p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          PRINTABLE DOCUMENT STARTS HERE
      ═══════════════════════════════════════════════════════ */}
      {roadmap && (
        <div className="print-page" style={{ maxWidth: 900, background: '#fff' }}>

          {/* ── PAGE 1: CLP Cover ─────────────────────────── */}
          <div style={{ background: 'linear-gradient(160deg, #538A22 0%, #1e3a0f 100%)', borderRadius: 16, padding: '40px 44px', marginBottom: 24, color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ position: 'absolute', bottom: -30, left: 200, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' as const, opacity: 0.6, marginBottom: 8 }}>Clinic Living Plus · HSR Layout, Bangalore</div>
              <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 6, lineHeight: 1.2 }}>Your Personal Health Roadmap</div>
              <div style={{ fontSize: 15, opacity: 0.8, marginBottom: 28 }}>{roadmap.duration_months}-Month Transformation Plan</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { icon: '🌿', t: 'Food as Medicine', d: 'Whole foods as the foundation of healing' },
                  { icon: '🔬', t: 'Root Cause', d: 'Treat the cause, not the symptom' },
                  { icon: '🧘', t: 'Mind-Body', d: 'Stress and sleep matter as much as diet' },
                  { icon: '📊', t: 'Evidence-Based', d: 'Every step backed by clinical outcomes' },
                ].map(({ icon, t, d }) => (
                  <div key={t} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '14px 12px', backdropFilter: 'blur(4px)' }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{t}</div>
                    <div style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.4 }}>{d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Coach Intro ───────────────────────────────── */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '22px 26px', marginBottom: 24, display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>👩‍⚕️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 4 }}>Your Coach at CLP</div>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#111827', marginBottom: 6 }}>Dedicated Nutrition Expert</div>
              <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.65 }}>With years of clinical expertise in functional nutrition and disease reversal, your coach at CLP combines cutting-edge science with a deeply personal approach. Trained in root-cause medicine, they have guided hundreds of patients through transformational health journeys — from chronic disease reversal to peak vitality. You're in expert hands.</div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                {['Functional Nutrition', 'Disease Reversal', 'Gut Health', 'Metabolic Health'].map(tag => (
                  <span key={tag} style={{ fontSize: 10, fontWeight: 600, color: '#8b5cf6', background: '#ede9fe', padding: '3px 10px', borderRadius: 20 }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Manifestation Overview ────────────────────── */}
          <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', borderRadius: 14, padding: '28px 32px', marginBottom: 24, color: '#fff' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#C8E9A8', marginBottom: 10 }}>✨ Your Transformation Story</div>
            <div style={{ fontSize: 15, lineHeight: 1.9, color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>{roadmap.overview}</div>
          </div>

         

          {/* ── WINDING ROAD + MONTHS ─────────────────────── */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: 6 }}>Your {roadmap.duration_months}-Month Journey</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 24 }}>Week-by-Week Roadmap</div>
          </div>

          {/* Road with months */}
          <div style={{ position: 'relative' }}>
            {/* Vertical road spine */}
            <div style={{ position: 'absolute', left: 35, top: 0, bottom: 0, width: 6, background: 'linear-gradient(180deg, #e11d48, #f59e0b, #3b82f6, #538A22)', borderRadius: 3, zIndex: 0 }} />
            {/* Dashes on road */}
            <div style={{ position: 'absolute', left: 37, top: 0, bottom: 0, width: 2, backgroundImage: 'repeating-linear-gradient(180deg, #fff 0px, #fff 12px, transparent 12px, transparent 22px)', zIndex: 1 }} />

            {/* START pin */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, position: 'relative', zIndex: 2 }}>
              <LocationPin color="#111827" label="START" size={72} />
              <div style={{ background: '#111827', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 600 }}>
                Your journey begins here — every step forward is a step toward the best version of you.
              </div>
            </div>

            {/* Months */}
            {months.map((monthWeeks, monthIdx) => {
              const pinColor = PIN_COLORS[monthIdx % PIN_COLORS.length]
              const monthNum = monthIdx + 1
              const isRight = monthIdx % 2 === 0

              return (
                <div key={monthIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 32, position: 'relative', zIndex: 2 }}>
                  {/* Pin */}
                  <div style={{ flexShrink: 0 }}>
                    <LocationPin color={pinColor} label={`M${monthNum}`} size={72} />
                  </div>

                  {/* Month content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <div style={{ fontWeight: 800, fontSize: 18, color: pinColor }}>{MONTH_LABELS[monthIdx] ?? `Month ${monthNum}`}</div>
                      <div style={{ height: 2, flex: 1, background: `linear-gradient(90deg, ${pinColor}40, transparent)` }} />
                    </div>

                    {/* Week pillars */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                      {monthWeeks.map((week) => (
                        <WeekPillar key={week.week_number} week={week} color={pinColor} />
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* GOAL pin */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 2 }}>
              <LocationPin color="#538A22" label="🎯" size={72} />
              <div style={{ background: 'linear-gradient(135deg, #538A22, #2d5a14)', color: '#fff', borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 700 }}>
                Goal Achieved — You've transformed your health! 🌟
              </div>
            </div>
          </div>

          <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>Clinic Living Plus · HSR Layout, Bangalore · cliniclivingplus.com</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>Generated by CLP Compass · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Location Pin SVG ──────────────────────────────────────────
function LocationPin({ color, label, size = 64 }: { color: string; label: string; size?: number }) {
  return (
    <div style={{ width: size, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <svg width={size} height={size * 1.2} viewBox="0 0 60 72" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Drop shadow */}
        <ellipse cx="30" cy="68" rx="10" ry="3" fill="rgba(0,0,0,0.15)" />
        {/* Pin body */}
        <path d="M30 2C18.954 2 10 10.954 10 22C10 36 30 66 30 66C30 66 50 36 50 22C50 10.954 41.046 2 30 2Z" fill={color} />
        {/* Pin shine */}
        <path d="M22 12C19 15 17 19 17 22" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" />
        {/* Inner circle */}
        <circle cx="30" cy="22" r="11" fill="white" />
        <text x="30" y="27" textAnchor="middle" fontSize={label.length > 2 ? "9" : "11"} fontWeight="800" fill={color}>{label}</text>
      </svg>
    </div>
  )
}

// ── Week Pillar Card ──────────────────────────────────────────
function WeekPillar({ week, color }: { week: WeeklyPlan; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: `2px solid ${color}20`, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      {/* Week header */}
      <div style={{ background: color, padding: '8px 10px', textAlign: 'center' as const }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>Week {week.week_number}</div>
        <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 9, fontWeight: 600, marginTop: 2, lineHeight: 1.3 }}>{week.focus_theme}</div>
      </div>

      {/* Content */}
      <div style={{ padding: '10px 10px' }}>
        {/* Goals */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>🎯 Goals</div>
          {(week.goals ?? []).map((g, i) => (
            <div key={i} style={{ fontSize: 10, color: '#374151', marginBottom: 3, display: 'flex', gap: 4, lineHeight: 1.4 }}>
              <span style={{ color, flexShrink: 0 }}>›</span>{g}
            </div>
          ))}
        </div>

        {/* Recipes */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>🥗 Recipes</div>
          {(week.recipes ?? []).map((r, i) => (
            <div key={i} style={{ fontSize: 10, color: '#374151', marginBottom: 3, display: 'flex', gap: 4, lineHeight: 1.4 }}>
              <span style={{ color: '#f59e0b', flexShrink: 0 }}>›</span>{r}
            </div>
          ))}
        </div>

        {/* Supplements */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>💊 Supplements</div>
          {(week.supplements ?? []).map((s, i) => (
            <div key={i} style={{ fontSize: 10, color: '#374151', marginBottom: 3, display: 'flex', gap: 4, lineHeight: 1.4 }}>
              <span style={{ color: '#8b5cf6', flexShrink: 0 }}>›</span>{s}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
