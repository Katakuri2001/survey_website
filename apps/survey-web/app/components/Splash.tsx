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
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 3600)
    const hideTimer = setTimeout(() => {
      setExiting(true)
      setVisible(false)
      sessionStorage.setItem('splashDisplayed', 'true')
    }, 4200)
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer) }
  }, [])

  const skip = () => {
    setFading(true)
    setTimeout(() => {
      setExiting(true)
      setVisible(false)
      sessionStorage.setItem('splashDisplayed', 'true')
    }, 300)
  }

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-[100] overflow-hidden bg-brand-emerald transition-opacity duration-700 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Ken-burns backdrop */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-hero-glow animate-zoom-slow" />
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-gold/15 blur-[120px] animate-float" />
        <div className="absolute -bottom-40 -left-24 w-[420px] h-[420px] rounded-full bg-brand-emeraldLight/70 blur-[100px]" />

        {/* Rising gold bubbles */}
        {[18, 34, 60, 78, 88].map((left, i) => (
          <span
            key={i}
            className="confetti-piece w-1.5 h-1.5 bg-gold/50 rounded-full"
            style={{ left: `${left}%`, animationDuration: `${8 + i * 2}s`, animationDelay: `${i * 0.6}s` }}
          />
        ))}
      </div>

      {/* Skip */}
      <button
        onClick={skip}
        className="absolute top-5 right-5 z-10 px-4 py-2 rounded-full text-xs tracking-widest uppercase text-fg-secondary/70 border border-white/10 bg-white/5 hover:bg-gold/20 hover:text-gold transition-all"
      >
        {t('skip')}
      </button>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6 text-center">
        <span className="text-[10px] md:text-xs tracking-[0.5em] uppercase text-gold/90 mb-6 animate-fade-in">
          Survey &amp; Rewards Program
        </span>

        {/* Logo with gold ring */}
        <div className="relative mb-7 animate-pop">
          <div className="absolute -inset-3 rounded-full border border-gold/30 animate-spin-slow" />
          <div className="absolute -inset-6 rounded-full border border-gold/10" />
          <div className="w-28 h-28 md:w-32 md:h-32 rounded-full gold-ring bg-brand-emerald flex items-center justify-center overflow-hidden p-1">
            <img src="/logo.png" alt="MB" className="w-full h-full object-cover rounded-full" />
          </div>
        </div>

        <h1 className="font-display text-4xl md:text-5xl font-bold gold-text mb-3 animate-fade-up" style={{ animationDelay: '0.15s' }}>
          {t('brandName')}
        </h1>

        {/* Gold divider */}
        <div className="w-24 h-px bg-gradient-to-r from-transparent via-gold to-transparent my-4 animate-grow-x" style={{ animationDelay: '0.3s' }} />

        <p className="font-myanmar text-base md:text-lg text-fg-secondary max-w-xs animate-fade-up" style={{ animationDelay: '0.35s' }}>
          {t('brandSubtitle')}
        </p>

        <p className="text-xs text-fg-muted mt-10 animate-fade-in" style={{ animationDelay: '0.7s' }}>
          Good Beer · Better Moments
        </p>
      </div>
    </div>
  )
}