import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'CLP Compass',
  description: 'Nutrition platform for Clinic Living Plus',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <div style={{ display: 'flex' }}>
          <Sidebar />
          <main style={{ marginLeft: 240, flex: 1, minHeight: '100vh', padding: '32px 36px', background: '#f9fafb' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
