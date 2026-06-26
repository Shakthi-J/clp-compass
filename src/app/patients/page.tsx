import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Plus, User } from 'lucide-react'
import { Patient } from '@/types'

export const revalidate = 0

export default async function PatientsPage() {
  const { data: patients } = await supabase
    .from('patients')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>Patients</h1>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 3 }}>{patients?.length ?? 0} registered</p>
        </div>
        <Link href="/patients/new" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#538A22', color: '#fff', padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
          <Plus size={16} /> New Patient
        </Link>
      </div>

      {!patients?.length ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: '60px 24px', border: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>
          <User size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ fontSize: 15, fontWeight: 500, color: '#374151' }}>No patients yet</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Add your first patient to get started</p>
          <Link href="/patients/new" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, background: '#538A22', color: '#fff', padding: '9px 20px', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 13 }}>
            <Plus size={14} /> Add Patient
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {patients.map((p: Patient) => (
            <Link key={p.id} href={`/patients/${p.id}`} style={{ background: '#fff', borderRadius: 10, padding: '16px 20px', border: '1px solid #e5e7eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#F2F9EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User size={18} color="#538A22" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>{p.full_name}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                  {p.primary_concern ?? 'No concern noted'}{p.assigned_nutritionist ? ` · ${p.assigned_nutritionist}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>
                {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
