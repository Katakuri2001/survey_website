'use client'

import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react'
import { translations, Language, TranslationKey } from '../lib/translations'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('my')

  // Stable across renders so consumers (and effects that depend on `t`) do not
  // re-run just because the provider tree re-rendered.
  const t = useCallback(
    (key: TranslationKey): string => translations[language][key] || translations.en[key],
    [language]
  )

  const value = useMemo(() => ({ language, setLanguage, t }), [language, t])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}