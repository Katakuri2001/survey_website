/**
 * i18n_translation/translation.ts
 *
 * Single source of truth for the Myanmar ⇄ English localisation system.
 *
 * Everything locale-related lives here: the supported locales, the default
 * locale, locale validation, storage persistence, asynchronous translation
 * loading and the translation cache. Components must not re-implement any of
 * that logic.
 *
 * Scope: presentation layer only. Business values (product ids, reward ids,
 * answer ids, NRC codes, ratings, ...) are language-neutral and must never be
 * routed through this module.
 */

import myBundle from './my.json'
import enBundle from './en.json'

// ---------------------------------------------------------------------------
// Locale contract
// ---------------------------------------------------------------------------

/** Myanmar is the default language of this product. */
export type Locale = 'my' | 'en'

export const DEFAULT_LOCALE: Locale = 'my'

/** Supported locales, default first. */
export const SUPPORTED_LOCALES = ['my', 'en'] as const satisfies readonly Locale[]

/** localStorage key holding the user's language preference. */
export const LOCALE_STORAGE_KEY = 'myanmarbeer-language'

/** Runtime guard — never trust a value read from storage or the URL. */
export function isLocale(value: unknown): value is Locale {
  return value === 'my' || value === 'en'
}

/** Coerce an arbitrary value to a supported locale, falling back to the default. */
export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

// ---------------------------------------------------------------------------
// Translation resources
// ---------------------------------------------------------------------------

/**
 * Shape of a translation resource. `my.json` and `en.json` are structurally
 * identical by contract — a key present in one must be present in the other.
 */
export type Translations = typeof myBundle

/**
 * Every dotted path in a sectioned translation resource.
 *
 * `'common.next'`, `'surveyQuestions.q1_a'`, ... Deriving this from the JSON
 * itself turns a typo or a removed key into a TypeScript error rather than a
 * silently blank label at runtime.
 */
export type SectionedKeys<T> = {
  [Section in keyof T & string]: T[Section] extends string
    ? Section
    : `${Section}.${keyof T[Section] & string}`
}[keyof T & string]

export type TranslationKey = SectionedKeys<Translations>

/** Fails `tsc` when its argument is not `true`. */
type Assert<T extends true> = T

type SameKeys<A, B> = [SectionedKeys<A>] extends [SectionedKeys<B>]
  ? [SectionedKeys<B>] extends [SectionedKeys<A>]
    ? true
    : false
  : false

type EnJson = typeof import('./en.json')

/**
 * Development-time validation: `en.json` and `my.json` must declare exactly
 * the same keys. Adding a label to one locale and forgetting the other breaks
 * the build instead of falling back to Myanmar for English users.
 *
 * Type-only — it erases at compile time and pulls no extra bytes into the
 * bundle. Exported so the assertion is always evaluated.
 */
export type TranslationParity = Assert<SameKeys<EnJson, Translations>>

/**
 * Resolve a dotted key against a resource.
 *
 * Returns `undefined` for a missing key so callers can apply their own
 * fallback chain instead of rendering an empty string.
 */
export function lookupTranslation(
  resource: Translations,
  key: TranslationKey
): string | undefined {
  let cursor: unknown = resource
  for (const segment of key.split('.')) {
    if (typeof cursor !== 'object' || cursor === null) return undefined
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  return typeof cursor === 'string' ? cursor : undefined
}

// ---------------------------------------------------------------------------
// Async loading + cache
// ---------------------------------------------------------------------------

/**
 * Loaded resources, keyed by locale.
 *
 * Both locales are bundled statically. The default ships with the first paint;
 * English is only ~7.5 KB, so splitting it into a lazy chunk bought nothing and
 * cost a network round-trip — plus a silent failure mode — on every switch.
 */
const cache = new Map<Locale, Translations>([
  [DEFAULT_LOCALE, myBundle],
  ['en', enBundle],
])

/** Non-throwing cache peek for synchronous, zero-latency switching. */
export function getCachedTranslations(locale: Locale): Translations | undefined {
  return cache.get(locale)
}

/** True once a locale's resource is in memory and can be applied instantly. */
export function isTranslationsCached(locale: Locale): boolean {
  return cache.has(locale)
}

/**
 * Resolve a locale to its resource.
 *
 * Both locales are in the bundle, so this is a synchronous map lookup — there is
 * no request to fail and no wrong-language window while a chunk is in flight.
 */
export function loadTranslations(locale: Locale): Translations {
  return cache.get(normalizeLocale(locale)) ?? myBundle
}

/**
 * Kept for call-site compatibility. There is nothing to preload any more: both
 * locales are already in memory by the time this module is evaluated.
 */
export function preloadTranslations(locale: Locale): Translations {
  return loadTranslations(locale)
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function storage(): Storage | null {
  // Access can throw in Safari private mode / when cookies are blocked.
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Read the stored preference.
 *
 * Absent, corrupt or unavailable storage all resolve to `DEFAULT_LOCALE`, so a
 * first-time visitor always lands on Myanmar.
 */
export function readStoredLocale(): Locale {
  const store = storage()
  if (!store) return DEFAULT_LOCALE
  try {
    return normalizeLocale(store.getItem(LOCALE_STORAGE_KEY))
  } catch {
    return DEFAULT_LOCALE
  }
}

/** Persist the preference. Best-effort: a storage failure must not break the UI. */
export function writeStoredLocale(locale: Locale): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // Ignore — the in-memory locale still applies for this session.
  }
}
