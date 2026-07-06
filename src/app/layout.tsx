import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'CLP Compass',
  description: 'Nutrition platform for Clinic Living Plus',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Google Identity Services (OAuth token popup) + gapi (Picker module).
            Loaded once, globally, for the "Import from Drive" feature.
            strategy="afterInteractive" so they don't block first paint. */}
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
        <Script src="https://apis.google.com/js/api.js" strategy="afterInteractive" />

        {/* Top header */}
        <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#538A22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🧭</div>
            <div>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>CLP Compass</span>
              <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>Clinic Living Plus · Bangalore</span>
            </div>
          </div>
        </header>
        <main style={{ minHeight: 'calc(100vh - 56px)', background: '#f9fafb', padding: '32px' }}>
          {children}
        </main>
      </body>
    </html>
  )
}