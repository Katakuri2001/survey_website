import type { Metadata } from 'next'
import './globals.css'
import AdminShell from './components/AdminShell'

export const metadata: Metadata = {
  title: 'Myanmar Beer Admin',
  description: 'Survey Platform Admin Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  )
}