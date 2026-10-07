'use client'

/**
 * I18nProvider
 *
 * Holds the active locale and hands out `t` / `locale` / `changeLanguage`.
 *
 * This provider owns *localisation only*. Survey answers, form drafts, auth
 * tokens and reward state deliberately live elsewhere — switching language
 * re-renders translated strings and touches nothing else, so no application
 * state can be reset by changing language.
 *
 * Language switching is entirely client-side: no reload, no navigation, no
 * router call, no overlay, no artificial delay.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  DEFAULT_LOCALE,
  loadTranslations,
  lookupTranslation,
  normalizeLocale,
  readStoredLocale,
  writeStoredLocale,
  type Locale,
  type Translations,
  type TranslationKey,
} from '../i18n_translation/translation'
import defaultBundle from '../i18n_translation/my.json'

/**
 * `useLayoutEffect` warns when it runs during server rendering. On the server
 * we fall back to `useEffect`; on the client we want the layout version so a
 * restored locale is applied *before* the browser paints, which keeps an
 * English user from seeing a flash of Myanmar.
 */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

// Both locales are bundled statically, so there is nothing to warm up front.

interface I18nContextValue {
  locale: Locale
  changeLanguage: (next: Locale) => void
  t: (key: TranslationKey, fallback?: string) => string
  /** @deprecated Kept so existing `useLanguage()` call sites keep working. */
  language: Locale
  /** @deprecated Alias of `changeLanguage`. */
  setLanguage: (next: Locale) => void
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE)
  // The default bundle is statically imported, so the first render is already
  // fully translated — never an empty or half-populated UI.
  const [bundle, setBundle] = useState<Translations>(defaultBundle)

  const applyLocale = useCallback((next: Locale) => {
    const target = normalizeLocale(next)
    // Both locales are already in the bundle, so switching is a synchronous
    // state update — no request, no wrong-language window, nothing to fail.
    setBundle(loadTranslations(target))
    setLocale(target)
    writeStoredLocale(target)
  }, [])

  // Restore the saved preference. Runs before paint when the cache is warm.
  useIsomorphicLayoutEffect(() => {
    const stored = readStoredLocale()
    if (stored !== DEFAULT_LOCALE) applyLocale(stored)
  }, [applyLocale])

  // Keep <html lang="..."> in sync. Mutating after hydration avoids the
  // mismatch a server/client disagreement on this attribute would cause.
  useEffect(() => {
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale
    }
  }, [locale])

  const t = useCallback(
    (key: TranslationKey, fallback?: string): string => {
      const value =
        lookupTranslation(bundle, key) ??
        // A locale missing a key still renders sensible text.
        (locale === DEFAULT_LOCALE ? undefined : lookupTranslation(defaultBundle, key))
      return value ?? fallback ?? key
    },
    [bundle, locale]
  )

  const changeLanguage = applyLocale

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      changeLanguage,
      t,
      // Backwards-compatible aliases used by existing call sites.
      language: locale,
      setLanguage: applyLocale,
    }),
    [locale, changeLanguage, t, applyLocale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** Spec-facing hook: `const { t, locale, changeLanguage } = useI18n()`. */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used within an I18nProvider')
  return context
}

/** Existing hook name, kept so current components need no import changes. */
export function useLanguage(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useLanguage must be used within an I18nProvider')
  return context
}
