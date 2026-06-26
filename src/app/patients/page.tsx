import Link from 'next/link'
import { Plus, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Patient } from '@/types'

export const revalidate = 0

export default async function PatientsPage() {
  const { data: patients } = await supabase
    .from('patients')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>Patients</h1>
          <p style={{ color: '#6b7280', marginTop: 4, fontSize: 14 }}>{patients?.length ?? 0} patients registered</p>
        </div>
        <Link href="/patients/new" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#538A22', color: '#fff', padding: '10px 18px',
          borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 14
        }}>
          <Plus size={16} /> New Patient
        </Link>
      </div>

      {!patients || patients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af' }}>
          <User size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontSize: 16, fontWeight: 500 }}>No patients yet</p>
          <p style={{ fontSize: 14, marginTop: 4 }}>Add your first patient to get started</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {patients.map((p: Patient) => (
            <Link key={p.id} href={`/patients/${p.id}`} style={{
              background: '#fff', borderRadius: 10, padding: '16px 20px',
              border: '1px solid #e5e7eb', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 16
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: '#F2F9EC', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <User size={18} color="#538A22" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#111827' }}>{p.full_name}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
                  {p.primary_concern ?? 'No primary concern noted'} · {p.assigned_nutritionist ?? 'Unassigned'}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>
                {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
