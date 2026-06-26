'use client'
import { useState, useEffect, useRef } from 'react'
import { Send, Loader2, CheckCircle, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'

type QAPair = { question: string; answer: string }

export default function QAChat({
  sessionId, patientId, patientName, initialQA
}: {
  sessionId: string
  patientId: string
  patientName: string
  initialQA: QAPair[]
}) {
  const [qa, setQA] = useState<QAPair[]>(initialQA)
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [showHistory, setShowHistory] = useState(true)
  const [started, setStarted] = useState(initialQA.length > 0)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function fetchNextQuestion() {
    setLoading(true)
    try {
      const res = await fetch(`/api/qa?session_id=${sessionId}&patient_id=${patientId}`)
      const json = await res.json()
      if (json.is_complete && !json.question) {
        setDone(true)
        setCurrentQuestion(null)
      } else {
        setCurrentQuestion(json.question)
        setDone(false)
      }
    } catch {
      setCurrentQuestion('Could not load question. Check your connection.')
    } finally {
      setLoading(false)
    }
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
      const newPair = { question: currentQuestion, answer: answer.trim() }
      setQA(prev => [...prev, newPair])
      setAnswer('')
      setCurrentQuestion(null)
      await fetchNextQuestion()
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {
      alert('Failed to save answer. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleStart() {
    setStarted(true)
    fetchNextQuestion()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAnswer() }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F2F9EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MessageSquare size={16} color="#538A22" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Clinical Q&A</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{qa.length} question{qa.length !== 1 ? 's' : ''} answered · AI asks, you answer</div>
          </div>
        </div>
        {qa.length > 0 && (
          <button onClick={() => setShowHistory(h => !h)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            {showHistory ? <><ChevronUp size={14} /> Hide history</> : <><ChevronDown size={14} /> Show history</>}
          </button>
        )}
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* Not started yet */}
        {!started && (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🩺</div>
            <p style={{ fontWeight: 600, fontSize: 15, color: '#111827', marginBottom: 6 }}>Clinical Intake Q&A</p>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>
              AI will ask you key clinical questions about {patientName}. Answer each one — your responses feed directly into the roadmap generation.
            </p>
            <button onClick={handleStart} style={{ padding: '10px 24px', background: '#538A22', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Start Q&A Session
            </button>
          </div>
        )}

        {/* Q&A History */}
        {started && showHistory && qa.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {qa.map((pair, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                {/* AI question bubble */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F2F9EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>🤖</div>
                  <div style={{ background: '#f3f4f6', borderRadius: '4px 12px 12px 12px', padding: '10px 14px', maxWidth: '80%' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#538A22', marginBottom: 4 }}>CLP Assistant · Q{i + 1}</div>
                    <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{pair.question}</div>
                  </div>
                </div>
                {/* Nutritionist answer bubble */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <div style={{ background: '#538A22', borderRadius: '12px 4px 12px 12px', padding: '10px 14px', maxWidth: '80%' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>You</div>
                    <div style={{ fontSize: 13, color: '#fff', lineHeight: 1.5 }}>{pair.answer}</div>
                  </div>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#538A22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>👩‍⚕️</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Current question */}
        {started && !done && (
          <div>
            {loading && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F2F9EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>🤖</div>
                <div style={{ background: '#f3f4f6', borderRadius: '4px 12px 12px 12px', padding: '12px 16px' }}>
                  <Loader2 size={16} color="#538A22" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              </div>
            )}

            {currentQuestion && !loading && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#F2F9EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>🤖</div>
                  <div style={{ background: '#f3f4f6', borderRadius: '4px 12px 12px 12px', padding: '12px 16px', maxWidth: '80%' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#538A22', marginBottom: 5 }}>CLP Assistant · Q{qa.length + 1}</div>
                    <div style={{ fontSize: 14, color: '#111827', lineHeight: 1.6, fontWeight: 500 }}>{currentQuestion}</div>
                  </div>
                </div>

                {/* Answer input */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', paddingLeft: 38 }}>
                  <textarea
                    ref={textRef}
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                    placeholder="Type your answer... (Enter to submit, Shift+Enter for new line)"
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #538A22', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
                    autoFocus
                  />
                  <button
                    onClick={submitAnswer}
                    disabled={submitting || !answer.trim()}
                    style={{ width: 40, height: 40, borderRadius: '50%', background: answer.trim() ? '#538A22' : '#e5e7eb', border: 'none', cursor: answer.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}
                  >
                    {submitting ? <Loader2 size={16} color="#fff" style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} color={answer.trim() ? '#fff' : '#9ca3af'} />}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, paddingLeft: 38 }}>Press Enter to submit · Shift+Enter for new line</div>
              </div>
            )}
          </div>
        )}

        {/* Done state */}
        {done && started && (
          <div style={{ background: '#F2F9EC', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <CheckCircle size={22} color="#538A22" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#3a6118' }}>Q&A Complete — {qa.length} questions answered</div>
              <div style={{ fontSize: 13, color: '#538A22', marginTop: 3 }}>All answers saved. Click Generate Roadmap above to create the patient plan.</div>
            </div>
          </div>
        )}

        {/* Enough to generate hint */}
        {started && !done && qa.length >= 5 && currentQuestion && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e', marginTop: 8 }}>
            💡 You have enough answers to generate a roadmap. You can continue or click <strong>Generate Roadmap</strong> now.
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
