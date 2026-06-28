import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Plus, User, FileText, ArrowLeft } from 'lucide-react'
import { Patient, Session } from '@/types'

export const revalidate = 0

const statusColors: Record<string, string> = {
  'pending': '#9ca3af',
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
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Back */}
      <Link href="/patients" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6b7280', textDecoration: 'none', marginBottom: 20 }}>
        <ArrowLeft size={14} /> All Patients
      </Link>

      {/* Patient header */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', border: '1px solid #e5e7eb', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#F2F9EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <User size={22} color="#538A22" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#111827' }}>{p.full_name}</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>
            {p.gender ? `${p.gender.charAt(0).toUpperCase() + p.gender.slice(1)} · ` : ''}{p.primary_concern ?? 'No concern noted'}
          </div>
          {p.assigned_nutritionist && <div style={{ fontSize: 12, color: '#538A22', marginTop: 2, fontWeight: 600 }}>Nutritionist: {p.assigned_nutritionist}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={`/patients/${id}/edit`} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, textDecoration: 'none', color: '#6b7280', fontWeight: 500 }}>Edit</Link>
          <Link href={`/patients/${id}/sessions/new`} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#538A22', color: '#fff', padding: '8px 16px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
            <Plus size={14} /> New Session
          </Link>
        </div>
      </div>

      {/* Sessions */}
      <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 600, color: '#374151' }}>Sessions ({sessions?.length ?? 0})</div>

      {!sessions?.length ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '40px 24px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>
          <FileText size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
          <p style={{ fontSize: 14 }}>No sessions yet</p>
          <Link href={`/patients/${id}/sessions/new`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, background: '#538A22', color: '#fff', padding: '8px 18px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
            <Plus size={13} /> Start First Session
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(sessions as Session[]).map(s => (
            <Link key={s.id} href={`/patients/${id}/sessions/${s.id}`} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px', border: '1px solid #e5e7eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
              <FileText size={16} color="#6b7280" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', textTransform: 'capitalize' }}>{s.session_type.replace('-', ' ')}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  {new Date(s.session_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: statusColors[s.status] ?? '#6b7280', background: (statusColors[s.status] ?? '#6b7280') + '15', padding: '3px 10px', borderRadius: 20, textTransform: 'capitalize' }}>
                {s.status.replace('-', ' ')}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}