'use client'
import { useState } from 'react'
import { Download, Share2, Check } from 'lucide-react'

type WeeklyPlan = {
  week_number: number
  focus_theme: string
  cause: string
  actions: string[]
}

type Roadmap = {
  id: string
  overview: string
  lifestyle_guidelines: string
  nutritionist_guidelines: string
  weekly_schedule: WeeklyPlan[]
  duration_months: number
  patients: { full_name: string; gender: string; primary_concern: string }
}

const MONTH_COLORS = ['#e11d48', '#f59e0b', '#3b82f6', '#538A22', '#8b5cf6', '#06b6d4']
const WEEK_ICONS = ['🌱','🔥','💧','⚡','🌿','🎯','💪','✨','🧘','🌟','🔬','🏆']

const DOODLE_HEART = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path d="M14 24s-9-5.5-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-9 12-9 12z" fill="#ff6b6b" stroke="#c0392b" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
)

const DOODLE_LEAF = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path d="M6 22C6 22 8 10 20 6C20 6 20 18 8 22L6 22Z" fill="#a8e6cf" stroke="#27ae60" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M6 22L14 14" stroke="#27ae60" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const DOODLE_SUN = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="5" fill="#ffd93d" stroke="#f9a825" strokeWidth="1.5"/>
    {[0,45,90,135,180,225,270,315].map((deg,i) => (
      <line key={i} x1="14" y1="14"
        x2={14 + 9*Math.cos(deg*Math.PI/180)}
        y2={14 + 9*Math.sin(deg*Math.PI/180)}
        stroke="#f9a825" strokeWidth="1.5" strokeLinecap="round"/>
    ))}
  </svg>
)

const DOODLE_STAR = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="#ffd93d" stroke="#f9a825" strokeWidth="1.2" strokeLinejoin="round"/>
  </svg>
)

export default function ShareClient({ roadmap }: { roadmap: Roadmap }) {
  const [copied, setCopied] = useState(false)
  const patient = roadmap.patients
  const weeks = roadmap.weekly_schedule ?? []
  const months: WeeklyPlan[][] = []
  for (let i = 0; i < weeks.length; i += 4) months.push(weeks.slice(i, i + 4))

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f8faf6; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .page-break { page-break-before: always; }
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#538A22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🧭</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>CLP Compass</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Health Roadmap for {patient?.full_name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={copyLink} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: copied ? '#538A22' : '#374151' }}>
            {copied ? <Check size={14} color="#538A22" /> : <Share2 size={14} />}
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: '#538A22', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Download size={14} /> Save as PDF
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px 60px' }}>

        {/* ── COVER ─────────────────────────────────────────── */}
        <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)', borderRadius: 20, padding: '48px 44px', marginBottom: 32, color: '#fff', position: 'relative', overflow: 'hidden' }}>
          {/* Background doodles */}
          <div style={{ position: 'absolute', top: 20, right: 30, opacity: 0.08, fontSize: 120 }}>🧬</div>
          <div style={{ position: 'absolute', bottom: 10, right: 120, opacity: 0.06, fontSize: 80 }}>🌿</div>
          <div style={{ position: 'absolute', top: '50%', left: -20, opacity: 0.05, fontSize: 100 }}>⭕</div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <div style={{ background: '#538A22', borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Clinic Living Plus</div>
              <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 600 }}>Personalised Health Programme</div>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.12em' }}>Your Personal Health Guide</div>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.2, marginBottom: 6 }}>
              {roadmap.duration_months}-Month Transformation<br/>Roadmap
            </div>
            <div style={{ fontSize: 16, color: '#C8E9A8', fontWeight: 500, marginBottom: 28 }}>
              Prepared exclusively for {patient?.full_name}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 20px', display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 28 }}>🎯</div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Focus Condition</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{patient?.primary_concern ?? 'General Health Improvement'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CLP GUIDELINES ────────────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <SectionHeader icon="📋" title="CLP General Guidelines" subtitle="The philosophy behind your programme" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { icon: '🌿', title: 'Food as Medicine', why: 'Every meal is either fighting disease or feeding it. Whole, unprocessed foods reduce inflammation at the cellular level.', tip: 'Choose foods as close to their natural state as possible.' },
              { icon: '🔬', title: 'Root Cause Healing', why: 'Symptoms are the body\'s signals, not the problem itself. We find and fix the underlying cause instead of managing symptoms.', tip: 'Your body has the ability to heal — we just need to remove what\'s blocking it.' },
              { icon: '🧘', title: 'Mind-Body Connection', why: 'Chronic stress raises cortisol which disrupts hormones, digestion and immunity. Managing your mind is as important as managing your diet.', tip: 'Even 10 minutes of calm daily has measurable health benefits.' },
              { icon: '📊', title: 'Progress Over Perfection', why: 'Sustainable change happens through consistent small steps, not drastic overnight shifts that the body rejects.', tip: 'A 1% improvement every day compounds to 37x better in a year.' },
            ].map(({ icon, title, why, tip }) => (
              <div key={title} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, marginBottom: 8 }}><strong style={{ color: '#374151' }}>Why:</strong> {why}</div>
                <div style={{ fontSize: 11, background: '#F2F9EC', color: '#538A22', borderRadius: 8, padding: '6px 10px', fontWeight: 600 }}>💡 {tip}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── COACH INTRO ───────────────────────────────────── */}
        <div style={{ background: 'linear-gradient(135deg, #667eea15, #764ba215)', borderRadius: 16, padding: '28px 30px', marginBottom: 32, border: '1px solid #e5e7eb' }}>
          <SectionHeader icon="👩‍⚕️" title="A Note From Your Coach" subtitle="Clinic Living Plus · HSR Layout, Bangalore" />
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>👩‍⚕️</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111827', marginBottom: 4 }}>Your Dedicated Nutritionist</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, marginBottom: 12 }}>
                This programme has been designed specifically for you based on your consultation, your health history, and the latest evidence-based nutritional science. Every recommendation in this document has a reason — and I have explained the "why" behind each one so you can make informed choices every single day.
              </div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, marginBottom: 12 }}>
                Your body is incredibly intelligent. With the right inputs — the right foods, the right sleep, the right stress management — it will begin to heal. This roadmap is not a restrictive diet plan. It is a life guide for the next {roadmap.duration_months} months.
              </div>
              <div style={{ fontSize: 13, color: '#538A22', fontWeight: 600, fontStyle: 'italic' }}>
                "Trust the process. Your transformation starts today." 🌱
              </div>
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                {['Functional Nutrition', 'Disease Reversal', 'Gut Health', 'Metabolic Health'].map(tag => (
                  <span key={tag} style={{ fontSize: 10, fontWeight: 600, color: '#8b5cf6', background: '#ede9fe', padding: '3px 10px', borderRadius: 20 }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── TRANSFORMATION OVERVIEW ───────────────────────── */}
        <div style={{ background: 'linear-gradient(135deg, #538A22, #2d5a14)', borderRadius: 16, padding: '28px 32px', marginBottom: 32, color: '#fff', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -20, right: -20, opacity: 0.08, fontSize: 120 }}>✨</div>
          <SectionHeader icon="✨" title={`Your ${roadmap.duration_months}-Month Transformation`} subtitle="What your journey looks like" light />
          <div style={{ fontSize: 15, lineHeight: 1.9, whiteSpace: 'pre-wrap', color: 'rgba(255,255,255,0.92)' }}>{roadmap.overview}</div>
        </div>

        {/* ── LIFESTYLE GUIDELINES ──────────────────────────── */}
        <div style={{ marginBottom: 32 }}>
          <SectionHeader icon="🌿" title="Lifestyle Guidelines" subtitle="Daily habits that create lasting change — with the why behind each" />
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {(roadmap.lifestyle_guidelines ?? '').split('\n').filter(l => l.trim().startsWith('•')).map((line, i) => {
              const text = line.replace('•', '').trim()
              const icons = ['😴', '🏃', '🧘', '🌅']
              const colors = ['#3b82f6', '#f59e0b', '#8b5cf6', '#538A22']
              return (
                <div key={i} style={{ padding: '18px 22px', borderBottom: i < 3 ? '1px solid #f3f4f6' : 'none', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: colors[i % colors.length] + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icons[i % icons.length]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: '#111827', lineHeight: 1.6, fontWeight: 500 }}>{text}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── NUTRITIONAL GUIDELINES (clinical notes) ───────── */}
        <div style={{ marginBottom: 40 }}>
          <SectionHeader icon="🥗" title="Nutritional Guidelines" subtitle="Your clinical nutrition protocol — with the why behind each" />
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            {(roadmap.nutritionist_guidelines ?? '').split('\n').filter(l => l.trim().startsWith('•')).map((line, i) => {
              const text = line.replace('•', '').trim()
              const icons = ['🔬', '🥗', '💊', '⚠️']
              const colors = ['#3b82f6', '#538A22', '#8b5cf6', '#f59e0b']
              const labels = ['Biomarkers to Track', 'Your Dietary Protocol', 'Supplement Plan', 'Important Notes']
              return (
                <div key={i} style={{ padding: '18px 22px', borderBottom: i < 3 ? '1px solid #f3f4f6' : 'none', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: colors[i % colors.length] + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icons[i % icons.length]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: colors[i % colors.length], textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 4 }}>{labels[i] ?? 'Guidelines'}</div>
                    <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{text}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── WEEKLY ROADMAP ────────────────────────────────── */}
        <div>
          <SectionHeader icon="🗺️" title="Your Week-by-Week Roadmap" subtitle={`${roadmap.duration_months} months · ${weeks.length} weeks · Every step moves you closer to your goal`} />

          {/* Progress bar visual */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', marginBottom: 28, border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>START</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#538A22' }}>GOAL 🎯</span>
            </div>
            <div style={{ height: 12, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', background: 'linear-gradient(90deg, #e11d48, #f59e0b, #3b82f6, #538A22)', borderRadius: 6 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              {months.map((_, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 600, color: MONTH_COLORS[i] }}>Month {i + 1}</div>
              ))}
            </div>
          </div>

          {/* Month by month */}
          {months.map((monthWeeks, monthIdx) => {
            const color = MONTH_COLORS[monthIdx % MONTH_COLORS.length]
            return (
              <div key={monthIdx} style={{ marginBottom: 36 }}>
                {/* Month header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0, boxShadow: `0 4px 14px ${color}50` }}>
                    M{monthIdx + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 20, color }}> Month {monthIdx + 1}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>Weeks {monthIdx * 4 + 1}–{Math.min((monthIdx + 1) * 4, weeks.length)}</div>
                  </div>
                  <div style={{ flex: 1, height: 2, background: `linear-gradient(90deg, ${color}40, transparent)`, marginLeft: 8 }} />
                </div>

                {/* Week cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                  {monthWeeks.map((week) => (
                    <WeekCard key={week.week_number} week={week} color={color} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── DISCLAIMER ────────────────────────────────────── */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '18px 22px', marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>⚠️ Medical Disclaimer</div>
          <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.7 }}>
            This health roadmap is prepared by a qualified nutritionist at Clinic Living Plus based on your personal consultation. It is not a substitute for medical diagnosis or treatment. Please consult your doctor before making significant changes, especially if you are on medication. Always inform your nutritionist of any new symptoms or concerns.
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 24, textAlign: 'center' as const, color: '#9ca3af', fontSize: 12 }}>
          <div style={{ fontWeight: 600, color: '#538A22', marginBottom: 4 }}>Clinic Living Plus</div>
          HSR Layout, Bangalore · Prepared by CLP Compass · {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </div>
      </div>
    </>
  )
}

function SectionHeader({ icon, title, subtitle, light = false }: { icon: string; title: string; subtitle?: string; light?: boolean }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: light ? '#fff' : '#111827' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: light ? 'rgba(255,255,255,0.6)' : '#9ca3af', marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ height: 2, background: light ? 'rgba(255,255,255,0.15)' : '#f3f4f6', borderRadius: 1, marginTop: 12 }} />
    </div>
  )
}

function WeekCard({ week, color }: { week: WeeklyPlan; color: string }) {
  const icon = WEEK_ICONS[(week.week_number - 1) % WEEK_ICONS.length]
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: `1.5px solid ${color}20`, overflow: 'hidden', boxShadow: `0 2px 12px ${color}10` }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{icon}</div>
        <div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Week {week.week_number}</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 500 }}>{week.focus_theme}</div>
        </div>
      </div>

      {/* Root cause */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${color}15` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 13 }}>🔍</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Why This Week?</span>
        </div>
        <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.65 }}>{week.cause}</div>
      </div>

      {/* Actions */}
      <div style={{ padding: '14px 16px', background: `${color}06` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 13 }}>✨</span>
          <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>Your Actions</span>
        </div>
        {(week.actions ?? []).map((action, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
            <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.55 }}>{action}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
