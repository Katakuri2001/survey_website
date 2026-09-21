'use client'

import { useLanguage } from './context/LanguageContext'
import Image from 'next/image'
import Link from 'next/link'
import LanguageSwitcher from './components/LanguageSwitcher'

export default function Home() {
  const { t, language } = useLanguage()

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
        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <span className="w-10 h-10 rounded-full gold-ring bg-brand-emerald overflow-hidden p-0.5 shrink-0">
              <Image src="/myanmarbeer.png" alt="MB" width={40} height={40} className="w-full h-full object-cover rounded-full" />
            </span>
            <span className="hidden sm:block min-w-0">
              <span className={`block font-display font-bold gold-text truncate ${language === 'my' ? 'font-myanmar leading-snug text-base sm:text-lg' : 'text-sm sm:text-base leading-tight'}`}>{t('brandName')}</span>
              <span className="block text-[10px] tracking-[0.25em] uppercase text-fg-muted">Survey & Rewards</span>
            </span>
          </Link>
          <LanguageSwitcher />
        </div>

        {/* Hero content */}
        <div className="relative z-10 mx-auto max-w-3xl lg:max-w-4xl px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 pb-20 sm:pb-24 md:pt-20 md:pb-28 text-center">
          <span className={`inline-block px-3 sm:px-4 py-1.5 rounded-full border border-gold/30 bg-gold/10 text-[10px] sm:text-[11px] tracking-[0.3em] uppercase text-gold mb-8 sm:mb-10 animate-fade-up ${language === 'my' ? 'font-myanmar tracking-normal leading-relaxed' : ''}`}>
            {t('heroEyebrow')}
          </span>

          <h1 className={`relative font-display font-extrabold animate-fade-up ${language === 'my' ? 'font-myanmar' : ''}`} style={{ animationDelay: '0.1s' }}>
            <span className={`block text-white drop-shadow-2xl ${language === 'my'
              ? 'font-myanmar text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[1.3] tracking-normal text-wrap-balance max-w-[90%] mx-auto'
              : 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[1.1] text-wrap-balance max-w-[90%] mx-auto'
            }`}>
              {t('heroTitleLine1')}
            </span>
            <span className={`relative z-10 mt-2 sm:mt-3 md:mt-4 block gold-text ${language === 'my'
              ? 'font-myanmar text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-[1.4] tracking-normal text-wrap-balance max-w-[90%] mx-auto'
              : 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-[1.15] text-wrap-balance max-w-[90%] mx-auto'
            }`}>
              {t('heroTitleLine2')}
            </span>
          </h1>

          {/* gold divider */}
          <div className="mx-auto mt-10 sm:mt-12 md:mt-16 mb-8 sm:mb-10 md:mb-12 h-px w-32 sm:w-40 bg-gradient-to-r from-transparent via-gold to-transparent animate-grow-x" style={{ animationDelay: '0.3s' }} />

          <p className={`font-myanmar text-base sm:text-lg md:text-xl text-fg-secondary max-w-xl sm:max-w-2xl mx-auto animate-fade-up leading-[1.7] sm:leading-[1.8] whitespace-pre-line`} style={{ animationDelay: '0.35s' }}>
            {t('heroDesc')}
          </p>

          <div className="mt-10 sm:mt-12 md:mt-16 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 animate-fade-up" style={{ animationDelay: '0.5s' }}>
            <Link
              href="/info"
              className="group w-full sm:w-auto px-7 sm:px-9 py-3.5 sm:py-4 bg-lager-gradient text-white rounded-full font-bold text-base sm:text-lg shadow-lager-lg hover:scale-[1.02] hover:shadow-lager transition-all inline-flex items-center justify-center gap-2"
            >
              {t('heroCtaSurvey')}
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </Link>
          </div>

          <div className="mt-6 sm:mt-8 text-center">
            <span className="text-[10px] tracking-[0.3em] uppercase text-fg-muted">{t('scrollHint')}</span>
            <div className="mx-auto mt-2 w-5 h-8 rounded-full border border-white/20 flex justify-center pt-1.5">
              <div className="w-1 h-2 rounded-full bg-gold animate-float" />
            </div>
          </div>
        </div>
      </section>

      {/* ============================ HOW IT WORKS ============================ */}
      <section className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20 md:pb-28">
        <div className="text-center mb-10 sm:mb-14">
          <span className="text-[10px] sm:text-[11px] tracking-[0.3em] uppercase text-gold">{t('howItWorks').toUpperCase()}</span>
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mt-2 sm:mt-3 text-white">{t('howItWorks')}</h2>
          <div className="mx-auto mt-3 h-px w-20 sm:w-24 bg-gradient-to-r from-transparent via-gold to-transparent" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {steps.map((s) => (
            <div key={s.n} className="relative rounded-2xl sm:rounded-3xl bg-brand-emerald/40 border border-white/[0.07] p-6 sm:p-8 text-center overflow-hidden">
              <span className="absolute -top-3 right-3 sm:-top-4 sm:-right-4 font-display text-4xl sm:text-5xl md:text-6xl font-extrabold text-white/[0.03]">{s.n}</span>
              <div className="mx-auto mb-4 sm:mb-5 w-12 sm:w-14 h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-gold/15 border border-gold/30 flex items-center justify-center gold-border">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={s.icon} />
                </svg>
              </div>
              <span className="block text-[10px] sm:text-[11px] tracking-[0.25em] text-gold/80 mb-1.5">{s.n}</span>
              <h3 className="font-display text-base sm:text-lg font-bold text-white mb-1.5">{s.title}</h3>
              <p className="text-sm text-fg-muted leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================ VOICE CTA ============================ */}
      <section className="relative overflow-hidden my-6 sm:my-8">
        <div className="absolute inset-0 bg-emerald-gradient" />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
        <div className="absolute -bottom-16 sm:-bottom-24 left-1/2 -translate-x-1/2 w-[400px] sm:w-[520px] h-[200px] sm:h-[260px] bg-gold/10 blur-[110px] rounded-full" />
        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-20 text-center">
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white">{t('voiceTitle')}</h2>
          <div className="mx-auto my-4 h-px w-20 sm:w-24 bg-gradient-to-r from-transparent via-gold to-transparent" />
          <p className="text-fg-secondary mb-6 sm:mb-9 max-w-lg mx-auto whitespace-pre-line leading-relaxed">{t('voiceDesc')}</p>
          <Link
            href="/info"
            className="inline-flex items-center gap-2 px-8 sm:px-10 py-3.5 sm:py-4 bg-lager-gradient text-white rounded-full font-bold text-base sm:text-lg shadow-lager-lg hover:scale-[1.02] hover:shadow-lager transition-all"
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
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full gold-border bg-brand-emerald overflow-hidden p-0.5 shrink-0">
              <Image src="/myanmarbeer.png" alt="MB" width={36} height={36} className="w-full h-full object-cover rounded-full" />
            </span>
            <span className={`font-display font-bold gold-text ${language === 'my' ? 'font-myanmar leading-snug text-base sm:text-lg' : 'text-sm sm:text-base'}`}>{t('brandName')}</span>
          </div>
          <p className="text-xs text-fg-muted">{t('footerRights')}</p>
        </div>
      </footer>
    </div>
  )
}