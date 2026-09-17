'use client'

import { useLanguage } from './context/LanguageContext'
import Link from 'next/link'
import LanguageSwitcher from './components/LanguageSwitcher'

export default function Home() {
  const { t, language } = useLanguage()
  const myFont = language === 'my' ? 'font-myanmar leading-[1.45]' : 'leading-[1.05]'

  const steps = [
    { n: '01', title: t('stepSurvey'), desc: t('stepSurveyDesc'), icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { n: '02', title: t('stepSpin'), desc: t('stepSpinDesc'), icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { n: '03', title: t('stepReceive'), desc: t('stepReceiveDesc'), icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7' },
  ]

  return (
    <div className="min-h-screen bg-navy text-fg-bright">
      {/* ============================ HERO ============================ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-hero-glow" />
        <div className="absolute -top-24 right-0 w-[420px] h-[420px] rounded-full bg-gold/10 blur-[130px] animate-float" />
        <div className="absolute top-1/3 -left-24 w-[360px] h-[360px] rounded-full bg-brand-emeraldLight/50 blur-[120px]" />
        {/* floating particles */}
        {[8, 20, 38, 52, 70, 84, 93].map((left, i) => (
          <span
            key={i}
            className="confetti-piece w-1 h-1 rounded-full bg-gold/40"
            style={{ left: `${left}%`, animationDuration: `${12 + i * 2}s`, animationDelay: `${i * 1.1}s` }}
          />
        ))}

        {/* Top brand bar */}
        <div className="relative z-10 mx-auto max-w-6xl px-5 pt-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full gold-ring bg-brand-emerald overflow-hidden p-0.5">
              <img src="/logo.png" alt="MB" className="w-full h-full object-cover rounded-full" />
            </span>
            <span className="hidden sm:block">
              <span className={`block font-display font-bold gold-text ${language === 'my' ? 'font-myanmar leading-snug' : 'text-sm leading-tight'}`}>{t('brandName')}</span>
              <span className="block text-[10px] tracking-[0.25em] uppercase text-fg-muted">Survey &amp; Rewards</span>
            </span>
          </Link>
          <LanguageSwitcher />
        </div>

        {/* Hero content */}
        <div className="relative z-10 mx-auto max-w-3xl lg:max-w-4xl px-5 pt-16 pb-24 md:pt-24 md:pb-32 text-center">
          <span className={`inline-block px-4 py-1.5 rounded-full border border-gold/30 bg-gold/10 text-[11px] tracking-[0.35em] uppercase text-gold mb-10 animate-fade-up ${language === 'my' ? 'font-myanmar tracking-normal leading-relaxed' : ''}`}>
            {t('heroEyebrow')}
          </span>

           <h1 className={`relative font-display font-extrabold animate-fade-up ${myFont}`} style={{ animationDelay: '0.1s' }}>
            <span className={`relative z-0 block text-4xl sm:text-5xl md:text-7xl text-white drop-shadow-2xl ${language === 'my' ? 'font-myanmar leading-relaxed tracking-widest' : ''}`}>
              {t('heroTitleLine1')}
            </span>
            <span className={`relative z-10 -mt-3 sm:-mt-5 md:-mt-8 block text-4xl sm:text-5xl md:text-7xl gold-text ${language === 'my' ? 'font-myanmar leading-relaxed tracking-widest lg:tracking-normal lg:whitespace-nowrap' : ''}`}>
              {t('heroTitleLine2')}
            </span>
          </h1>

          {/* gold divider */}
          <div className="mx-auto mt-12 mb-10 md:mt-16 md:mb-12 h-px w-40 bg-gradient-to-r from-transparent via-gold to-transparent animate-grow-x" style={{ animationDelay: '0.3s' }} />

          <p className="font-myanmar text-lg md:text-xl text-fg-secondary max-w-xl mx-auto animate-fade-up leading-relaxed whitespace-pre-line" style={{ animationDelay: '0.35s' }}>
            {t('heroDesc')}
          </p>

          <div className="mt-14 md:mt-16 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: '0.5s' }}>
            <Link
              href="/info"
              className="group w-full sm:w-auto px-9 py-4 bg-lager-gradient text-white rounded-full font-bold text-lg shadow-lager-lg hover:scale-[1.03] hover:shadow-lager transition-all inline-flex items-center justify-center gap-2"
            >
              {t('heroCtaSurvey')}
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </Link>
          </div>

<div className="mt-8 text-center">
            <span className="text-[10px] tracking-[0.4em] uppercase text-fg-muted">{t('scrollHint')}</span>
            <div className="mx-auto mt-3 w-6 h-10 rounded-full border border-white/20 flex justify-center pt-2">
              <div className="w-1 h-2 rounded-full bg-gold animate-float" />
            </div>
          </div>
        </div>
      </section>

       {/* ============================ HOW IT WORKS ============================ */}
      <section className="relative mx-auto max-w-6xl px-5 pb-20 md:pb-28">
        <div className="text-center mb-14">
          <span className="text-[11px] tracking-[0.35em] uppercase text-gold">{t('howItWorks').toUpperCase()}</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold mt-3 text-white">{t('howItWorks')}</h2>
          <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((s) => (
            <div key={s.n} className="relative rounded-3xl bg-brand-emerald/40 border border-white/[0.07] p-8 text-center overflow-hidden">
              <span className="absolute -top-4 right-4 font-display text-6xl font-extrabold text-white/[0.05]">{s.n}</span>
              <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-gold/15 border border-gold/30 flex items-center justify-center gold-border">
                <svg className="w-7 h-7 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={s.icon} />
                </svg>
              </div>
              <span className="block text-[11px] tracking-[0.3em] text-gold/80 mb-2">{s.n}</span>
              <h3 className="font-display text-lg font-bold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-fg-muted">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================ VOICE CTA ============================ */}
      <section className="relative overflow-hidden my-8">
        <div className="absolute inset-0 bg-emerald-gradient" />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[520px] h-[260px] bg-gold/10 blur-[110px] rounded-full" />
        <div className="relative mx-auto max-w-3xl px-5 py-16 md:py-20 text-center">
          <h2 className="font-display text-3xl md:text-5xl font-bold text-white">{t('voiceTitle')}</h2>
          <div className="mx-auto my-5 h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent" />
          <p className="text-fg-secondary mb-9 max-w-lg mx-auto whitespace-pre-line">{t('voiceDesc')}</p>
          <Link
            href="/info"
            className="inline-flex items-center gap-2 px-10 py-4 bg-lager-gradient text-white rounded-full font-bold text-lg shadow-lager-lg hover:scale-[1.03] hover:shadow-lager transition-all"
          >
            {t('joinNow')}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5-5 5M6 12h12" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ============================ FOOTER ============================ */}
      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-5 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full gold-border bg-brand-emerald overflow-hidden p-0.5">
              <img src="/logo.png" alt="MB" className="w-full h-full object-cover rounded-full" />
            </span>
            <span className={`font-display font-bold gold-text ${language === 'my' ? 'font-myanmar leading-snug' : ''}`}>{t('brandName')}</span>
          </div>
          <p className="text-xs text-fg-muted">{t('footerRights')}</p>
        </div>
      </footer>
    </div>
  )
}