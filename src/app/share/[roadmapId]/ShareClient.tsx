'use client'
import { useState } from 'react'
import { Download, Share2, Check } from 'lucide-react'

type WeeklyPlan = {
  week_number: number
  focus_theme: string
  cause: string
  actions: string[]
  milestone?: string
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

const MONTH_COLORS = ['#e11d48','#f97316','#f59e0b','#538A22','#3b82f6','#8b5cf6']
const WEEK_EMOJIS = ['🌱','🔥','💧','⚡','🌿','🎯','💪','✨','🧘','🌟','🔬','🏆','🌸','🦋','🌈','🎪','🌊','🎋','🏔️','🌻','🎸','🌙','⭐','🦅']

const ACTION_ICONS: Record<string, string> = {
  sleep: '😴', water: '💧', walk: '🚶', exercise: '💪', food: '🍽️',
  eat: '🍽️', drink: '💧', supplement: '💊', vitamin: '💊', morning: '🌅',
  night: '🌙', stress: '🧘', breath: '🧘', journal: '📓', meditation: '🧘',
  fast: '⏰', meal: '🍽️', protein: '🥩', vegetable: '🥗', fruit: '🍎',
}

function getActionIcon(action: string): string {
  const lower = action.toLowerCase()
  for (const [key, icon] of Object.entries(ACTION_ICONS)) {
    if (lower.includes(key)) return icon
  }
  return '✅'
}

function getDurationLabel(months: number): string {
  if (months <= 0.25) return '1-Week'
  if (months <= 0.5) return '2-Week'
  if (months === 1) return '1-Month'
  return `${months}-Month`
}

export default function ShareClient({ roadmap }: { roadmap: Roadmap }) {
  const [copied, setCopied] = useState(false)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const patient = roadmap.patients
  const weeks = roadmap.weekly_schedule ?? []

  // Group weeks into months (4 per month)
  const months: WeeklyPlan[][] = []
  for (let i = 0; i < weeks.length; i += 4) months.push(weeks.slice(i, i + 4))

  function toggleCheck(key: string) {
    setChecked(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const totalActions = weeks.reduce((sum, w) => sum + (w.actions?.length ?? 0), 0)
  const doneActions = Object.values(checked).filter(Boolean).length
  const progress = totalActions > 0 ? Math.round((doneActions / totalActions) * 100) : 0

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, -apple-system, sans-serif; background: #f8faf6; }
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .week-card { break-inside: avoid; }
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .week-card { animation: fadeIn 0.3s ease forwards; }
        input[type="checkbox"] { accent-color: #538A22; }
      `}</style>

      {/* Sticky toolbar */}
      <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e5e7eb', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#538A22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🧭</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>CLP Compass</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Health Roadmap · {patient?.full_name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Progress pill */}
          <div style={{ background: '#F2F9EC', border: '1px solid #C8E9A8', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600, color: '#538A22' }}>
            {doneActions}/{totalActions} done · {progress}%
          </div>
          <button onClick={copyLink} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: copied ? '#538A22' : '#374151' }}>
            {copied ? <Check size={13} color="#538A22" /> : <Share2 size={13} />}
            {copied ? 'Copied!' : 'Share'}
          </button>
          <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#538A22', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Download size={13} /> Print / PDF
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px 60px' }}>

        {/* COVER */}
        <div style={{ background: 'linear-gradient(135deg, #1a2e0f 0%, #2d5a14 60%, #538A22 100%)', borderRadius: 20, padding: '40px 36px', marginBottom: 28, color: '#fff', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.07)' }} />
          <div style={{ position: 'absolute', bottom: -20, right: 80, width: 90, height: 90, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 10 }}>Clinic Living Plus · Personalised Health Programme</div>
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.2, marginBottom: 6 }}>{getDurationLabel(roadmap.duration_months)} Health Roadmap</div>
            <div style={{ fontSize: 15, color: '#C8E9A8', fontWeight: 500, marginBottom: 6 }}>Prepared for {patient?.full_name}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>{patient?.primary_concern}</div>
            {/* Overall progress bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                <span>Your progress</span>
                <span>{doneActions}/{totalActions} actions complete</span>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: '#C8E9A8', borderRadius: 4, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          </div>
        </div>

        {/* CLP Guidelines */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>The CLP Philosophy</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { icon: '🌿', t: 'Food as medicine', d: 'Every meal either heals or feeds disease' },
              { icon: '🔬', t: 'Root cause healing', d: 'We fix why, not just what' },
              { icon: '🧘', t: 'Mind-body balance', d: 'Stress and sleep matter as much as diet' },
              { icon: '📈', t: 'Progress, not perfection', d: '1% better every day compounds into transformation' },
            ].map(({ icon, t, d }) => (
              <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{t}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transformation overview */}
        <div style={{ background: 'linear-gradient(135deg, #111827, #1f2937)', borderRadius: 14, padding: '22px 24px', marginBottom: 20, color: '#fff' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#C8E9A8', textTransform: 'uppercase', marginBottom: 10 }}>✨ Your transformation story</div>
          <div style={{ fontSize: 14, lineHeight: 1.9, color: 'rgba(255,255,255,0.88)', whiteSpace: 'pre-wrap' }}>{roadmap.overview}</div>
        </div>

        {/* Lifestyle + Clinical */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
          <div style={{ background: '#F2F9EC', borderRadius: 12, padding: '18px 20px', border: '1px solid #C8E9A8' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#538A22', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>🌿 Lifestyle prescription</div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 2, whiteSpace: 'pre-wrap' }}>{roadmap.lifestyle_guidelines}</div>
          </div>
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>🩺 Clinical notes</div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 2, whiteSpace: 'pre-wrap' }}>{roadmap.nutritionist_guidelines}</div>
          </div>
        </div>

        {/* WEEKLY ROADMAP — checklist style */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Your week-by-week plan</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 20 }}>
            Stick this on your fridge. Tick each one.
          </div>
        </div>

        {months.map((monthWeeks, monthIdx) => {
          const color = MONTH_COLORS[monthIdx % MONTH_COLORS.length]
          const monthDoneActions = monthWeeks.reduce((sum, w) =>
            sum + (w.actions ?? []).filter((_, ai) => checked[`${w.week_number}-${ai}`]).length, 0)
          const monthTotalActions = monthWeeks.reduce((sum, w) => sum + (w.actions?.length ?? 0), 0)

          return (
            <div key={monthIdx} style={{ marginBottom: 32 }}>
              {/* Month header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, flexShrink: 0, boxShadow: `0 4px 14px ${color}40` }}>
                  {months.length === 1 ? '📅' : `M${monthIdx + 1}`}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 19, color }}>
                    {months.length === 1 ? 'Your Weekly Plan' : `Month ${monthIdx + 1}`}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Week{monthWeeks.length > 1 ? 's' : ''} {monthWeeks[0].week_number}{monthWeeks.length > 1 ? `–${monthWeeks[monthWeeks.length - 1].week_number}` : ''}
                    {monthTotalActions > 0 && ` · ${monthDoneActions}/${monthTotalActions} done`}
                  </div>
                </div>
                {/* Month progress */}
                <div style={{ width: 60, textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color }}>{monthTotalActions > 0 ? Math.round(monthDoneActions/monthTotalActions*100) : 0}%</div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>complete</div>
                </div>
              </div>

              {/* Week cards — full width stacked */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {monthWeeks.map((week) => {
                  const weekDone = (week.actions ?? []).filter((_, ai) => checked[`${week.week_number}-${ai}`]).length
                  const weekTotal = week.actions?.length ?? 0
                  const weekProgress = weekTotal > 0 ? Math.round(weekDone / weekTotal * 100) : 0

                  return (
                    <div key={week.week_number} className="week-card" style={{ background: '#fff', borderRadius: 14, border: `2px solid ${color}20`, overflow: 'hidden', boxShadow: `0 2px 12px ${color}10` }}>
                      {/* Week header */}
                      <div style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                          {WEEK_EMOJIS[(week.week_number - 1) % WEEK_EMOJIS.length]}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>Week {week.week_number}</div>
                          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 500, marginTop: 2 }}>{week.focus_theme}</div>
                        </div>
                        {/* Week progress */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{weekProgress}%</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>{weekDone}/{weekTotal}</div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div style={{ height: 4, background: `${color}20` }}>
                        <div style={{ height: '100%', width: `${weekProgress}%`, background: color, transition: 'width 0.4s ease' }} />
                      </div>

                      {/* Root cause */}
                      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${color}15`, background: `${color}06` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <span style={{ fontSize: 13 }}>🔍</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Why this week matters</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, fontStyle: 'italic' }}>{week.cause}</div>
                      </div>

                      {/* Checklist actions */}
                      <div style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                          ✨ Your actions this week — tick each one
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {(week.actions ?? []).map((action, ai) => {
                            const key = `${week.week_number}-${ai}`
                            const isChecked = checked[key]
                            return (
                              <label key={ai} onClick={() => toggleCheck(key)} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', padding: '10px 12px', borderRadius: 10, background: isChecked ? `${color}10` : '#fafafa', border: `1px solid ${isChecked ? color + '30' : '#f0f0f0'}`, transition: 'all 0.2s' }}>
                                <input type="checkbox" checked={!!isChecked} onChange={() => toggleCheck(key)}
                                  style={{ width: 20, height: 20, marginTop: 1, flexShrink: 0, cursor: 'pointer' }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                    <span style={{ fontSize: 16, flexShrink: 0 }}>{getActionIcon(action)}</span>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: isChecked ? '#9ca3af' : '#111827', textDecoration: isChecked ? 'line-through' : 'none', lineHeight: 1.5, transition: 'all 0.2s' }}>
                                      {action}
                                    </div>
                                  </div>
                                </div>
                                {isChecked && <span style={{ fontSize: 16, flexShrink: 0 }}>✅</span>}
                              </label>
                            )
                          })}
                        </div>

                        {/* Milestone */}
                        {week.milestone && (
                          <div style={{ margin: '12px 0 4px', padding: '12px 14px', background: `linear-gradient(135deg, ${color}15, ${color}08)`, borderRadius: 10, border: `1px solid ${color}30` }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 5 }}>
                              🎯 By end of this week you should notice
                            </div>
                            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, fontWeight: 500 }}>{week.milestone}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Disclaimer */}
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '16px 20px', marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>⚠️ Medical disclaimer</div>
          <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.7 }}>
            This roadmap is prepared by a qualified nutritionist at Clinic Living Plus based on your personal consultation. It is not a substitute for medical diagnosis or treatment. Please consult your doctor before making significant changes, especially if you are on medication.
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
          <div style={{ fontWeight: 600, color: '#538A22', marginBottom: 3 }}>Clinic Living Plus</div>
          HSR Layout, Bangalore · {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </div>
      </div>
    </>
  )
}
