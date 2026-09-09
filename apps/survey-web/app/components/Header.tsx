'use client'

import { useLanguage } from '../context/LanguageContext'
import LanguageSwitcher from './LanguageSwitcher'

interface HeaderProps {
  title?: string
  subtitle?: string
  showBack?: boolean
  backHref?: string
}

export default function Header({ title, subtitle, showBack = true, backHref = '/' }: HeaderProps) {
  const { t } = useLanguage()

  return (
    <div className="bg-blue-950/50 backdrop-blur sticky top-0 z-10 border-b border-white/10">
      <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
        {showBack ? (
          <a href={backHref} className="text-yellow-400 hover:text-yellow-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
        ) : (
          <div className="w-6"></div>
        )}
        <div className="text-center flex-1">
          <h1 className="text-lg font-bold text-yellow-400">{title || t('brandName')}</h1>
          {subtitle && <p className="text-xs text-blue-200">{subtitle}</p>}
        </div>
        <LanguageSwitcher />
      </div>
    </div>
  )
}