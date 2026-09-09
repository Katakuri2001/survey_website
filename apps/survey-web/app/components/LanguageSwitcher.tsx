'use client'

import { useLanguage } from '../context/LanguageContext'

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="flex items-center gap-2 bg-white/10 rounded-full p-1">
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
          language === 'en'
            ? 'bg-yellow-500 text-blue-900'
            : 'text-white hover:bg-white/10'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage('my')}
        className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
          language === 'my'
            ? 'bg-yellow-500 text-blue-900'
            : 'text-white hover:bg-white/10'
        }`}
      >
        MY
      </button>
    </div>
  )
}