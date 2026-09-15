import type { Metadata } from 'next'
import './globals.css'
import { Inter, Poppins, Noto_Sans_Myanmar } from 'next/font/google'
import AdminShell from './components/AdminShell'

export const metadata: Metadata = {
  title: 'Myanmar Beer Admin',
  description: 'Survey Platform Admin Dashboard',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
}

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const poppins = Poppins({
  weight: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-poppins',
  display: 'swap',
})
const notoMyanmar = Noto_Sans_Myanmar({
  weight: ['400', '500', '700'],
  subsets: ['latin', 'myanmar'],
  variable: '--font-noto-myanmar',
  display: 'swap',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${poppins.variable} ${notoMyanmar.variable} min-h-screen`}
    >
      <body className="min-h-screen">
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  )
}