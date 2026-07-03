'use client'
import { useState, useRef } from 'react'
import { Send, Loader2, CheckCircle, MessageSquare, Bot, User, ChevronDown, ChevronUp, Save } from 'lucide-react'

type QAPair = { question: string; answer: string; mode?: 'ai-asks' | 'coach-asks' }

export default function QAChat({
  sessionId, patientId, patientName, initialQA, initialInstructions
}: {
  sessionId: string
  patientId: string
  patientName: string
  initialQA: QAPair[]
  initialInstructions?: string
}) {
  const [qa, setQA] = useState<QAPair[]>(initialQA)
  const [mode, setMode] = useState<'ai-asks' | 'coach-asks' | null>(initialQA.length > 0 ? 'ai-asks' : null)
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [coachQuestion, setCoachQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [aiAnswering, setAiAnswering] = useState(false)
  const [done, setDone] = useState(false)
  const [showHistory, setShowHistory] = useState(true)

  // Roadmap instructions
  const [instructions, setInstructions] = useState(initialInstructions ?? '')
  const [savingInstructions, setSavingInstructions] = useState(false)
  const [instructionsSaved, setInstructionsSaved] = useState(false)

  const textRef = useRef<HTMLTextAreaElement>(null)

  async function startAIAsks() {
    setMode('ai-asks')
    setLoading(true)
    try {
      const res = await fetch(`/api/qa?session_id=${sessionId}&patient_id=${patientId}`)
      const json = await res.json()
      setCurrentQuestion(json.question)
      setDone(json.is_complete && !json.question)
    } catch {}
    finally { setLoading(false) }
  }

  async function fetchNextQuestion() {
    setLoading(true)
    try {
      const res = await fetch(`/api/qa?session_id=${sessionId}&patient_id=${patientId}`)
      const json = await res.json()
      if (json.is_complete && !json.question) { setDone(true); setCurrentQuestion(null) }
      else setCurrentQuestion(json.question)
    } catch {}
    finally { setLoading(false) }
  }

  async function submitAnswer() {
    if (!answer.trim() || !currentQuestion) return
    setSubmitting(true)
    try {
      await fetch('/api/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, question: currentQuestion, answer }),
      })
      setQA(prev => [...prev, { question: currentQuestion, answer: answer.trim(), mode: 'ai-asks' }])
      setAnswer('')
      setCurrentQuestion(null)
      await fetchNextQuestion()
    } catch {}
    finally { setSubmitting(false) }
  }

  async function askCoachQuestion() {
    if (!coachQuestion.trim()) return
    setAiAnswering(true)
    try {
      const res = await fetch('/api/qa-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: coachQuestion, patient_id: patientId, session_id: sessionId }),
      })
      const json = await res.json()
      if (json.answer) {
        await fetch('/api/qa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, question: coachQuestion, answer: json.answer }),
        })
        setQA(prev => [...prev, { question: coachQuestion, answer: json.answer, mode: 'coach-asks' }])
        setCoachQuestion('')
      }
    } catch {}
    finally { setAiAnswering(false) }
  }

  async function saveInstructions() {
    if (!instructions.trim()) return
    setSavingInstructions(true)
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roadmap_instructions: instructions }),
      })
      setInstructionsSaved(true)
      setTimeout(() => setInstructionsSaved(false), 2000)
    } catch {}
    finally { setSavingInstructions(false) }
  }

  const bubble = (text: string, from: 'ai' | 'coach', label: string, isQuestion = false) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: from === 'coach' ? 'flex-end' : 'flex-start' }}>
      {from === 'ai' && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F2F9EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Bot size={14} color="#538A22" />
        </div>
      )}
      <div style={{ maxWidth: '80%' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: from === 'ai' ? '#538A22' : '#6b7280', marginBottom: 3, textAlign: from === 'coach' ? 'right' : 'left' }}>{label}</div>
        <div style={{
          background: from === 'ai' ? '#f3f4f6' : '#538A22',
          color: from === 'ai' ? '#374151' : '#fff',
          borderRadius: from === 'ai' ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
          padding: '10px 14px', fontSize: 13, lineHeight: 1.6,
          fontStyle: isQuestion ? 'italic' : 'normal'
        }}>{text}</div>
      </div>
      {from === 'coach' && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#538A22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <User size={14} color="#fff" />
        </div>
      )}
    </div>
  )

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={15} color="#538A22" />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>Clinical Q&A</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{qa.length} answered · feeds into roadmap</div>
          </div>
        </div>
        {qa.length > 0 && (
          <button onClick={() => setShowHistory(h => !h)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
            {showHistory ? <><ChevronUp size={13} /> Hide</> : <><ChevronDown size={13} /> Show</>}
          </button>
        )}
      </div>

      <div style={{ padding: '16px 18px' }}>

        {/* Not started */}
        {!mode && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>🩺</div>
            <p style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 4 }}>Clinical Q&A for {patientName}</p>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 18 }}>Choose how you want to use this session</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={startAIAsks} style={{ padding: '9px 18px', background: '#538A22', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                🤖 AI Asks Me Questions
              </button>
              <button onClick={() => setMode('coach-asks')} style={{ padding: '9px 18px', background: '#fff', color: '#538A22', border: '1.5px solid #538A22', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                💬 I Ask the AI
              </button>
            </div>
          </div>
        )}

        {/* Mode tabs when started */}
        {mode && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button onClick={() => { setMode('ai-asks'); if (!currentQuestion && !done) fetchNextQuestion() }}
              style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: mode === 'ai-asks' ? '#538A22' : '#e5e7eb', background: mode === 'ai-asks' ? '#F2F9EC' : '#fff', color: mode === 'ai-asks' ? '#538A22' : '#6b7280' }}>
              🤖 AI Asks
            </button>
            <button onClick={() => setMode('coach-asks')}
              style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid', borderColor: mode === 'coach-asks' ? '#538A22' : '#e5e7eb', background: mode === 'coach-asks' ? '#F2F9EC' : '#fff', color: mode === 'coach-asks' ? '#538A22' : '#6b7280' }}>
              💬 I Ask AI
            </button>
          </div>
        )}

        {/* History */}
        {showHistory && qa.length > 0 && (
          <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {qa.map((pair, i) => (
              <div key={i}>
                {pair.mode === 'coach-asks'
                  ? <>{bubble(pair.question, 'coach', 'You asked', true)}<div style={{ marginTop: 6 }}>{bubble(pair.answer, 'ai', 'CLP Assistant')}</div></>
                  : <>{bubble(pair.question, 'ai', `CLP Assistant · Q${i + 1}`)}<div style={{ marginTop: 6 }}>{bubble(pair.answer, 'coach', 'You')}</div></>
                }
              </div>
            ))}
          </div>
        )}

        {/* AI ASKS mode */}
        {mode === 'ai-asks' && (
          <>
            {loading && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F2F9EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bot size={14} color="#538A22" /></div>
                <div style={{ background: '#f3f4f6', borderRadius: '4px 12px 12px 12px', padding: '10px 14px' }}>
                  <Loader2 size={14} color="#538A22" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              </div>
            )}
            {currentQuestion && !loading && (
              <>
                <div style={{ marginBottom: 10 }}>{bubble(currentQuestion, 'ai', `CLP Assistant · Q${qa.length + 1}`)}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <textarea ref={textRef} value={answer} onChange={e => setAnswer(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAnswer() } }}
                    rows={2} placeholder="Type your answer... (Enter to submit)"
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #538A22', fontSize: 13, resize: 'none', outline: 'none' }} autoFocus />
                  <button onClick={submitAnswer} disabled={submitting || !answer.trim()}
                    style={{ width: 36, height: 36, borderRadius: '50%', background: answer.trim() ? '#538A22' : '#e5e7eb', border: 'none', cursor: answer.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {submitting ? <Loader2 size={14} color="#fff" style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} color={answer.trim() ? '#fff' : '#9ca3af'} />}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Enter to submit · Shift+Enter for new line</div>
              </>
            )}
            {done && (
              <div style={{ background: '#F2F9EC', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle size={16} color="#538A22" />
                <div style={{ fontSize: 13, fontWeight: 600, color: '#3a6118' }}>All questions answered · Ready to generate roadmap</div>
              </div>
            )}
            {qa.length >= 500 && !done && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e', marginTop: 10 }}>
                💡 Enough data to generate roadmap now, or keep answering for better results.
              </div>
            )}
          </>
        )}

        {/* COACH ASKS mode */}
        {mode === 'coach-asks' && (
          <div>
            {/* Ask AI a question */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Ask the AI anything about this patient</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea value={coachQuestion} onChange={e => setCoachQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askCoachQuestion() } }}
                  rows={2} placeholder={`e.g. "What's the best diet protocol for ${patientName}'s PCOS?" or "Why is she not losing weight?"`}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #538A22', fontSize: 13, resize: 'none', outline: 'none' }} autoFocus />
                <button onClick={askCoachQuestion} disabled={aiAnswering || !coachQuestion.trim()}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: coachQuestion.trim() ? '#538A22' : '#e5e7eb', border: 'none', cursor: coachQuestion.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {aiAnswering ? <Loader2 size={14} color="#fff" style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} color={coachQuestion.trim() ? '#fff' : '#9ca3af'} />}
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Answers from KB + session data · saved to Q&A history</div>
              {aiAnswering && (
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F2F9EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bot size={14} color="#538A22" /></div>
                  <div style={{ background: '#f3f4f6', borderRadius: '4px 12px 12px 12px', padding: '10px 14px', fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Searching knowledge base...
                  </div>
                </div>
              )}
            </div>

            {/* Roadmap Instructions */}
            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                📋 Roadmap Instructions
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10, lineHeight: 1.6 }}>
                Tell the AI exactly what to focus on when building the roadmap. Be specific — mention the condition, priorities, timeline goals, what to avoid, and anything the patient needs to achieve.
              </div>

              {/* Examples */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {[
                  'Focus on gut healing for first 4 weeks before addressing weight loss',
                  'Patient has PCOS — prioritise insulin resistance and hormonal balance',
                  'Avoid dairy and gluten — patient is sensitive to both',
                  'Patient works 12-hour days — keep lifestyle changes minimal and practical',
                ].map((ex, i) => (
                  <button key={i} onClick={() => setInstructions(prev => prev ? prev + '\n' + ex : ex)}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px solid #C8E9A8', background: '#F2F9EC', color: '#538A22', cursor: 'pointer', fontWeight: 500 }}>
                    + {ex}
                  </button>
                ))}
              </div>

              <textarea
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                rows={5}
                placeholder={`Write specific instructions for the roadmap...

Examples:
• Focus first 4 weeks on gut healing, then shift to weight loss
• Prioritise reducing inflammation before any calorie restriction  
• Patient has PCOS diagnosed 2019 — address insulin resistance first
• She works 10-12 hour days — recommend only simple, practical changes
• Avoid recommending any supplement she hasn't already tried
• Target: get her menstrual cycle regular by week 8`}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1.5px solid #C8E9A8', fontSize: 13, resize: 'vertical', lineHeight: 1.6, background: '#fafff8', outline: 'none' }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  These instructions directly shape what the AI generates in the roadmap
                </div>
                <button onClick={saveInstructions} disabled={savingInstructions || !instructions.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: instructions.trim() ? '#538A22' : '#e5e7eb', color: instructions.trim() ? '#fff' : '#9ca3af', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: instructions.trim() ? 'pointer' : 'not-allowed' }}>
                  {savingInstructions ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : instructionsSaved ? <CheckCircle size={13} /> : <Save size={13} />}
                  {instructionsSaved ? 'Saved!' : 'Save Instructions'}
                </button>
              </div>

              {instructions.trim() && (
                <div style={{ marginTop: 10, background: '#F2F9EC', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#538A22', fontWeight: 500 }}>
                  ✅ These instructions will be used when you click <strong>Generate Roadmap</strong>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}