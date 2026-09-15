import type { Metadata } from 'next'
import './globals.css'
import { Poppins, Inter, Noto_Sans_Myanmar } from 'next/font/google'
import { LanguageProvider } from './context/LanguageContext'
import Splash from './components/Splash'

export const metadata: Metadata = {
  title: 'Myanmar Beer Survey & Rewards',
  description: 'Share your opinion about Myanmar Beer products and win rewards. Good Beer, Better Moments.',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
}

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const poppins = Poppins({ weight: ['400', '500', '600', '700', '800'], subsets: ['latin'], variable: '--font-poppins', display: 'swap' })
const notoMyanmar = Noto_Sans_Myanmar({ weight: ['400', '500', '700'], subsets: ['myanmar'], variable: '--font-noto-myanmar', display: 'swap' })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable} ${notoMyanmar.variable} min-h-screen`}>
      <body className="min-h-screen bg-navy text-fg-bright">
        <LanguageProvider>
          <Splash />
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}