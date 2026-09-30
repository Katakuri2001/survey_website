'use client'

import { useI18n } from '../context/I18nProvider'
import { SUPPORTED_LOCALES, type Locale } from '../i18n_translation/translation'

/** Short, language-neutral labels: they stay readable whichever locale is active. */
const LABELS: Record<Locale, string> = { my: 'MY', en: 'EN' }

/**
 * Segmented MY | EN control.
 *
 * Both options are always mounted and only their highlight moves, so switching
 * language never shifts the header. Switching is a plain state update — no
 * reload, no navigation, no overlay.
 */
export default function LanguageSwitcher() {
  const { locale, changeLanguage } = useI18n()

  return (
    <div
      role="group"
      aria-label="Language / ဘာသာစကား"
      className="flex items-center gap-1 bg-white/[0.06] border border-white/10 rounded-full p-1 shrink-0"
    >
      {SUPPORTED_LOCALES.map(option => {
        const active = locale === option
        return (
          <button
            key={option}
            type="button"
            lang={option}
            aria-pressed={active}
            aria-label={option === 'my' ? 'Myanmar' : 'English'}
            onClick={() => changeLanguage(option)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-1 focus-visible:ring-offset-navy ${
              active
                ? 'bg-gold-gradient text-brand-emerald shadow-gold'
                : 'text-fg-secondary hover:text-white'
            }`}
          >
            {LABELS[option]}
          </button>
        )
      })}
    </div>
  )
}
