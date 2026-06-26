'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewPatientPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const data = {
      full_name: (form.elements.namedItem('full_name') as HTMLInputElement).value,
      gender: (form.elements.namedItem('gender') as HTMLSelectElement).value || null,
      primary_concern: (form.elements.namedItem('primary_concern') as HTMLInputElement).value || null,
      assigned_nutritionist: (form.elements.namedItem('assigned_nutritionist') as HTMLInputElement).value || null,
      medical_history: (form.elements.namedItem('medical_history') as HTMLTextAreaElement).value || null,
    }
    const res = await fetch('/api/patients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Failed to create patient'); setLoading(false); return }
    router.push(`/patients/${json.id}`)
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>New Patient</h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>Fill in the patient's information to get started.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, padding: 28, border: '1px solid #e5e7eb' }}>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
          <input name="full_name" required style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Gender</label>
          <select name="gender" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, background: '#fff' }}>
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div style={{ marginBottom: 16, padding: 16, background: '#F2F9EC', borderRadius: 10, border: '1px solid #C8E9A8' }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#538A22', marginBottom: 6 }}>
            Primary Health Concern <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Be specific — this drives the knowledge base search. e.g. "Hashimoto's thyroiditis with fatigue and weight gain"</p>
          <input name="primary_concern" required placeholder="e.g. PCOS with insulin resistance, weight gain and irregular periods"
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #C8E9A8', fontSize: 14 }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Assigned Nutritionist</label>
          <input name="assigned_nutritionist" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }} />
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Medical History</label>
          <textarea name="medical_history" rows={4} placeholder="Past diagnoses, medications, surgeries, family history..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical' }} />
        </div>

        {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => router.back()} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={loading} style={{ padding: '10px 24px', borderRadius: 8, background: '#538A22', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Saving...' : 'Create Patient'}
          </button>
        </div>
      </form>
    </div>
  )
}