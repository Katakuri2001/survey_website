'use client'

import { useEffect, useState } from 'react'
import { useLanguage } from '../context/LanguageContext'

export default function Splash() {
  const { t } = useLanguage()
  const [visible, setVisible] = useState(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('splashDisplayed')) {
      return false
    }
    return true
  })
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 3500)
    const hideTimer = setTimeout(() => {
      setVisible(false)
      sessionStorage.setItem('splashDisplayed', 'true')
    }, 4000)
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer) }
  }, [])

  const skip = () => {
    setFading(true)
    setTimeout(() => {
      setVisible(false)
      sessionStorage.setItem('splashDisplayed', 'true')
    }, 300)
  }

  if (!visible) return null

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-primary transition-opacity duration-500 ${fading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <button onClick={skip} className="absolute top-4 right-4 text-sm text-primary-foreground/60 hover:text-primary-foreground">
        {t('skip')}
      </button>
      <div className="text-center">
        <div className="w-24 h-24 mx-auto mb-6 bg-accent-gold rounded-full flex items-center justify-center">
          <img src="/logo.png" alt="MB" className="w-full h-full object-cover rounded-full" />
        </div>
        <h1 className="text-4xl font-bold text-accent-gold mb-3">{t('brandName')}</h1>
        <p className="text-primary-foreground/80">{t('brandSubtitle')}</p>
      </div>
    </div>
  )
}
