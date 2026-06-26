'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, LayoutDashboard, Compass } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/patients', label: 'Patients', icon: Users },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside style={{ width: 240, minHeight: '100vh', background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, zIndex: 50 }}>
      <div style={{ padding: '24px 20px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#538A22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Compass size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>CLP Compass</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>Nutrition Platform</div>
          </div>
        </div>
      </div>
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 2, background: active ? '#F2F9EC' : 'transparent', color: active ? '#538A22' : '#6b7280', fontWeight: active ? 600 : 400, fontSize: 14, textDecoration: 'none' }}>
              <Icon size={18} />{label}
            </Link>
          )
        })}
      </nav>
      <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ fontSize: 11, color: '#9ca3af' }}>Clinic Living Plus</div>
        <div style={{ fontSize: 11, color: '#538A22', fontWeight: 600 }}>HSR Layout, Bangalore</div>
      </div>
    </aside>
  )
}
