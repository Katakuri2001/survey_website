'use client'

import { useLanguage } from './context/LanguageContext'
import Link from 'next/link'
import LanguageSwitcher from './components/LanguageSwitcher'

function Bottle({ variant }: { variant: 'dagon' | 'premium' | 'andaman' }) {
  const glow = variant === 'dagon' ? '#00994B' : variant === 'premium' ? '#D4AF37' : '#F0E826'
  return (
    <svg viewBox="0 0 64 140" className="w-16 h-32 md:w-20 md:h-40" aria-hidden="true">
      <defs>
        <linearGradient id={`bottle-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1F4F35" />
          <stop offset="100%" stopColor="#0B2014" />
        </linearGradient>
      </defs>
      {/* body */}
      <path
        d="M18 32 h28 v6 h4 v96 h-36 v-96 h4 z"
        fill={`url(#bottle-${variant})`}
        stroke={glow}
        strokeOpacity="0.55"
        strokeWidth="1.2"
      />
      {/* neck + cap */}
      <rect x="27" y="8" width="10" height="24" rx="3" fill="#08140D" stroke={glow} strokeOpacity="0.4" />
      <rect x="24" y="4" width="16" height="6" rx="2" fill={glow} />
      {/* label */}
      <rect x="21" y="52" width="22" height="40" rx="3" fill="#08140D" stroke={glow} strokeOpacity="0.7" />
      <circle cx="32" cy="64" r="4" fill={glow} />
      <rect x="25" y="73" width="14" height="2.5" rx="1" fill={glow} opacity="0.8" />
      <rect x="27" y="79" width="10" height="2.5" rx="1" fill={glow} opacity="0.5" />
      {/* bubbles */}
      <circle cx={glow === '#00994B' ? 40 : 24} cy="120" r="1.6" fill={glow} opacity="0.7" />
      <circle cx={glow === '#00994B' ? 28 : 40} cy="106" r="1.2" fill={glow} opacity="0.5" />
    </svg>
  )
}

export default function Home() {
  const { t, language } = useLanguage()
  const myFont = language === 'my' ? 'font-myanmar leading-[1.45]' : 'leading-[1.05]'

  const products = [
    { variant: 'dagon' as const, name: t('productDagon'), desc: t('productDagonDesc') },
    { variant: 'premium' as const, name: t('productPremium'), desc: t('productPremiumDesc') },
    { variant: 'andaman' as const, name: t('productAndaman'), desc: t('productAndamanDesc') },
  ]

  const steps = [
    { n: '01', title: t('stepSurvey'), desc: t('stepSurveyDesc'), icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { n: '02', title: t('stepSpin'), desc: t('stepSpinDesc'), icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { n: '03', title: t('stepReceive'), desc: t('stepReceiveDesc'), icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
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
        <div className="relative z-10 mx-auto max-w-3xl px-5 pt-16 pb-24 md:pt-24 md:pb-32 text-center">
          <span className={`inline-block px-4 py-1.5 rounded-full border border-gold/30 bg-gold/10 text-[11px] tracking-[0.35em] uppercase text-gold mb-7 animate-fade-up ${language === 'my' ? 'font-myanmar tracking-normal leading-relaxed' : ''}`}>
            {t('heroEyebrow')}
          </span>

          <h1 className={`font-display font-extrabold animate-fade-up ${myFont}`} style={{ animationDelay: '0.1s' }}>
            <span className="block text-4xl sm:text-5xl md:text-7xl text-white drop-shadow-2xl">{t('heroTitleLine1')}</span>
            <span className={`block text-4xl sm:text-5xl md:text-7xl gold-text mt-1 ${language === 'my' ? 'font-myanmar leading-tight tracking-widest' : ''}`}>{t('heroTitleLine2')}</span>
          </h1>

          {/* gold divider */}
          <div className="mx-auto my-7 h-px w-40 bg-gradient-to-r from-transparent via-gold to-transparent animate-grow-x" style={{ animationDelay: '0.3s' }} />

          <p className="font-myanmar text-lg md:text-xl text-fg-secondary max-w-xl mx-auto animate-fade-up" style={{ animationDelay: '0.35s' }}>
            {t('heroDesc')}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: '0.5s' }}>
            <Link
              href="/info"
              className="group w-full sm:w-auto px-9 py-4 bg-lager-gradient text-white rounded-full font-bold text-lg shadow-lager-lg hover:scale-[1.03] hover:shadow-lager transition-all inline-flex items-center justify-center gap-2"
            >
              {t('heroCtaSurvey')}
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </Link>
            <a
              href="#products"
              className="w-full sm:w-auto px-9 py-4 rounded-full font-semibold text-fg-bright border border-white/15 bg-white/[0.05] hover:bg-white/10 hover:border-gold/40 hover:text-gold transition-all"
            >
              {t('heroCtaProducts')}
            </a>
          </div>

<div className="mt-8 text-center">
            <span className="text-[10px] tracking-[0.4em] uppercase text-fg-muted">{t('scrollHint')}</span>
            <div className="mx-auto mt-3 w-6 h-10 rounded-full border border-white/20 flex justify-center pt-2">
              <div className="w-1 h-2 rounded-full bg-gold animate-float" />
            </div>
          </div>
        </div>
      </section>

      {/* ============================ PRODUCTS ============================ */}
      <section id="products" className="relative mx-auto max-w-6xl px-5 py-20 md:py-28">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gold/[0.06] blur-[120px] rounded-full pointer-events-none" />
        <div className="text-center mb-14">
          <span className="text-[11px] tracking-[0.35em] uppercase text-gold">{t('ourProducts').toUpperCase()}</span>
          <h2 className="font-display text-3xl md:text-5xl font-bold mt-3 text-white">{t('ourProducts')}</h2>
          <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent" />
          <p className="text-fg-secondary mt-4 max-w-md mx-auto">{t('ourProductsDesc')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {products.map((p, i) => (
            <div
              key={p.name}
              className="group relative rounded-3xl border border-white/[0.08] bg-surface/60 p-8 text-center hover:border-gold/40 hover:bg-surface transition-all duration-300 hover:-translate-y-1.5 animate-fade-up"
              style={{ animationDelay: `${0.15 * i}s` }}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative mx-auto mb-5 flex h-40 items-end justify-center">
                <div className="absolute inset-x-6 bottom-0 h-px bg-white/10" />
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-28 h-7 bg-gold/5 blur-md rounded-full" />
                <Bottle variant={p.variant} />
              </div>
              <h3 className="font-display text-xl font-bold text-white group-hover:gold-text transition-all">{p.name}</h3>
              <p className="text-sm text-fg-muted mt-2 mb-6">{p.desc}</p>
              <Link
                href="/info"
                className="inline-flex items-center gap-2 text-sm font-bold text-gold border border-gold/30 rounded-full px-6 py-2.5 hover:bg-gold hover:text-brand-emerald hover:shadow-gold transition-all"
              >
                {t('takeSurvey')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          ))}
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
          <p className="text-fg-secondary mb-9 max-w-lg mx-auto">{t('voiceDesc')}</p>
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