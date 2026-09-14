import './globals.css'
import { Poppins, Inter, Noto_Sans_Myanmar } from 'next/font/google'
import { LanguageProvider } from './context/LanguageContext'
import Splash from './components/Splash'

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
      <body className="min-h-screen bg-primary text-primary-foreground">
        <LanguageProvider>
          <Splash />
          {children}
        </LanguageProvider>
      </body>
    </html>
  )
}
