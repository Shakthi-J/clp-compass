import Link from 'next/link'
import { Users, FileText, TrendingUp } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export const revalidate = 0

export default async function DashboardPage() {
  const [{ count: patientCount }, { count: sessionCount }, { count: roadmapCount }] = await Promise.all([
    supabase.from('patients').select('*', { count: 'exact', head: true }),
    supabase.from('sessions').select('*', { count: 'exact', head: true }).gte('session_date', new Date(new Date().setDate(1)).toISOString()),
    supabase.from('roadmaps').select('*', { count: 'exact', head: true }),
  ])

  const stats = [
    { label: 'Total Patients', value: patientCount ?? 0, icon: Users, color: '#538A22' },
    { label: 'Sessions This Month', value: sessionCount ?? 0, icon: FileText, color: '#3b82f6' },
    { label: 'Roadmaps Generated', value: roadmapCount ?? 0, icon: TrendingUp, color: '#8b5cf6' },
  ]

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111827' }}>Good morning 👋</h1>
        <p style={{ color: '#6b7280', marginTop: 4 }}>Here's what's happening at CLP today.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={20} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#111827' }}>{value}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 14 }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {[
            { label: 'Add New Patient', href: '/patients/new', desc: 'Register a new patient and start their journey' },
            { label: 'View All Patients', href: '/patients', desc: 'Browse patient records and sessions' },
          ].map(({ label, href, desc }) => (
            <Link key={href} href={href} style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', border: '1px solid #e5e7eb', textDecoration: 'none', display: 'block' }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#538A22', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>{desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
