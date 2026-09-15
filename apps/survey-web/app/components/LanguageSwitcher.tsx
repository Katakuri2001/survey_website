'use client'

import { useLanguage } from '../context/LanguageContext'

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="flex items-center gap-1 bg-white/[0.06] border border-white/10 rounded-full p-1 shrink-0">
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
          language === 'en'
            ? 'bg-gold-gradient text-brand-emerald shadow-gold'
            : 'text-fg-secondary hover:text-white'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage('my')}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all ${
          language === 'my'
            ? 'bg-gold-gradient text-brand-emerald shadow-gold'
            : 'text-fg-secondary hover:text-white'
        }`}
      >
        MY
      </button>
    </div>
  )
}