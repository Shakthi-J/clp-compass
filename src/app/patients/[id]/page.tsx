import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Patient, Session } from '@/types'
import { notFound } from 'next/navigation'
import { Plus, Calendar, FileText, User } from 'lucide-react'

export const revalidate = 0

const sessionTypeColors: Record<string, string> = {
  'first-meet': '#3b82f6',
  'follow-up': '#8b5cf6',
  'review': '#f59e0b',
}

const statusColors: Record<string, string> = {
  'pending': '#6b7280',
  'notes-added': '#f59e0b',
  'interpreted': '#3b82f6',
  'pdf-ready': '#538A22',
}

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: patient }, { data: sessions }] = await Promise.all([
    supabase.from('patients').select('*').eq('id', id).single(),
    supabase.from('sessions').select('*').eq('patient_id', id).order('session_date', { ascending: false })
  ])

  if (!patient) notFound()
  const p = patient as Patient

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#F2F9EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={24} color="#538A22" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>{p.full_name}</h1>
            <p style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>{p.email ?? ''} {p.phone ? `· ${p.phone}` : ''}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href={`/patients/${id}/edit`} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#fff', color: '#374151', padding: '10px 18px',
            borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14,
            border: '1px solid #d1d5db'
          }}>
            Edit Patient
          </Link>
          <Link href={`/patients/${id}/sessions/new`} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#538A22', color: '#fff', padding: '10px 18px',
            borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14
          }}>
            <Plus size={16} /> New Session
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 20 }}>
        {/* Patient info card */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 22, border: '1px solid #e5e7eb', height: 'fit-content' }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Patient Information</h2>
          {[
            ['Gender', p.gender],
            ['Primary Concern', p.primary_concern],
            ['Nutritionist', p.assigned_nutritionist],
          ].map(([label, value]) => (
            <div key={label as string} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div style={{ fontSize: 14, color: '#374151', marginTop: 3 }}>{value ?? '—'}</div>
            </div>
          ))}
          {p.medical_history && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Medical History</div>
              <div style={{ fontSize: 13, color: '#374151', marginTop: 3, lineHeight: 1.6 }}>{p.medical_history}</div>
            </div>
          )}
        </div>

        {/* Sessions */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 14 }}>Sessions ({sessions?.length ?? 0})</h2>
          {!sessions || sessions.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: '40px 24px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>
              <Calendar size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <p style={{ fontSize: 14 }}>No sessions yet. Add the first session.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(sessions as Session[]).map(s => (
                <Link key={s.id} href={`/patients/${id}/sessions/${s.id}`} style={{
                  background: '#fff', borderRadius: 10, padding: '16px 20px',
                  border: '1px solid #e5e7eb', textDecoration: 'none', display: 'block'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileText size={16} color={sessionTypeColors[s.session_type] ?? '#6b7280'} />
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#111827', textTransform: 'capitalize' }}>
                        {s.session_type.replace('-', ' ')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: statusColors[s.status], background: statusColors[s.status] + '15', padding: '3px 10px', borderRadius: 20 }}>
                        {s.status.replace('-', ' ')}
                      </span>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>
                        {new Date(s.session_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  {s.pre_meeting_notes && (
                    <p style={{ fontSize: 13, color: '#6b7280', marginTop: 8, lineHeight: 1.5 }}>
                      {s.pre_meeting_notes.slice(0, 120)}{s.pre_meeting_notes.length > 120 ? '…' : ''}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}