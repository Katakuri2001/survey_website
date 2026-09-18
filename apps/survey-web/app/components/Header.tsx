'use client'

import { useLanguage } from '../context/LanguageContext'
import LanguageSwitcher from './LanguageSwitcher'
import Image from 'next/image'

interface HeaderProps {
  title?: string
  subtitle?: string
  showBack?: boolean
  backHref?: string
}

export default function Header({ title, subtitle, showBack = true, backHref = '/' }: HeaderProps) {
  const { t, language } = useLanguage()

  return (
    <header className="glass sticky top-0 z-40 border-b border-white/[0.06]">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {showBack ? (
          <a
            href={backHref}
            aria-label={t('back')}
            className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-white/[0.04] text-fg-secondary hover:text-gold hover:border-gold/40 hover:bg-gold/10 transition-all shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
        ) : (
          <div className="w-10" />
        )}

        <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-center">
          <Image src="/myanmarbeer.png" alt="MB" width={28} height={28} className="w-7 h-7 rounded-full gold-border object-cover shrink-0" />
          <h1 className={`font-display font-bold gold-text truncate ${language === 'my' ? 'font-myanmar leading-snug tracking-normal' : 'text-base md:text-lg'}`}>
            {title || t('brandName')}
          </h1>
          {subtitle && <span className="hidden sm:inline text-xs text-fg-muted truncate">{subtitle}</span>}
        </div>

        <LanguageSwitcher />
      </div>
    </header>
  )
}