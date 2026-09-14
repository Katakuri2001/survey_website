import type { Metadata } from 'next'
import './globals.css'
import { Inter } from 'next/font/google'
import AdminShell from './components/AdminShell'

export const metadata: Metadata = {
  title: 'Myanmar Beer Admin',
  description: 'Survey Platform Admin Dashboard',
}

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} min-h-screen`}>
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  )
}
