// Myanmar NRC dataset — thin adapter over the `mm-nrc` package.
//
// Source: https://github.com/wai-lin/mm-nrc (MIT, `npm i mm-nrc`).
// Do not hand-edit entries: everything below is derived from mm-nrc at module
// load. State numbers follow the official Burmese-alphabet ordering
// (5 Sagaing … 14 Ayeyawady), and Naypyitaw carries the special number `9*`.
// See docs/myanmar-nrc.md before changing anything here.

import { getNrcStates, getNrcTownshipsByStateId, getNrcTypes } from 'mm-nrc'

export interface Township {
  /**
   * Official 3-Burmese-letter code, romanized for ASCII systems (e.g. `TAMANA`).
   * This is what is printed on a card, what `users.nrc_township` stores, and
   * what `NrcData.townshipCode` holds. Not unique within a state — use `id`
   * when a React key is needed.
   */
  code: string
  /** Stable mm-nrc id (globally unique). */
  id: string
  nameEn: string
  nameMy: string
}

export interface StateRegion {
  /** Official state number: `'1'`…`'14'`, plus `'9*'` for Naypyitaw. */
  code: string
  /** Myanmar-numeral variant of `code` for display (e.g. `'၁၂'`, `'၉*'`). */
  numberMy: string
  nameEn: string
  nameMy: string
  townships: Township[]
}

/** Citizenship type option for the NRC widget. */
export interface NrcTypeOption {
  code: string
  labelEn: string
  labelMy: string
}

// mm-nrc stores English names fully upper-cased ('YANGON', 'SOUTH OKKALAPA');
// title-case each word for display. Names are ASCII (also avoids ES2018
// unicode-property escapes, which the ES2017 target does not allow).
function titleCase(en: string): string {
  return en.toLowerCase().replace(/(^|\s|\()([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
}

export const MYANMAR_NRC_DATA: StateRegion[] = getNrcStates().map(state => ({
  code: state.number.en,
  numberMy: state.number.mm,
  nameEn: titleCase(state.name.en),
  nameMy: state.name.mm,
  townships: getNrcTownshipsByStateId(state.id).map(t => ({
    code: t.short.en,
    id: t.id,
    nameEn: titleCase(t.name.en),
    nameMy: t.name.mm,
  })),
}))

// Citizenship type letters shipped by mm-nrc (N E P T Y S). Note: mm-nrc's own
// reference *regex* says `(N|E|P|T|R|S)` — its data uses `Y` for ယာယီ, so the
// data (not the regex) is the source of truth here.
const VALID_TYPE_CODES = new Set(getNrcTypes().map(t => t.name.en))

// English glosses for the everyday letters (docs/myanmar-nrc.md §1/§2.3);
// rare letters fall back to the Burmese word printed on the card.
const TYPE_LABEL_EN: Record<string, string> = {
  N: 'Full citizen',
  E: 'Associate citizen',
  P: 'Naturalised citizen',
  T: 'Ecclesiastical',
  Y: 'Temporary',
  S: 'Special',
}

export const NRC_TYPES: NrcTypeOption[] = getNrcTypes().map(t => ({
  code: t.name.en,
  labelEn: TYPE_LABEL_EN[t.name.en] ?? t.name.mm,
  labelMy: t.name.mm,
}))

// Helper functions

export function getStateRegion(code: string): StateRegion | undefined {
  return MYANMAR_NRC_DATA.find(s => s.code === code)
}

export function getTownships(stateCode: string): Township[] {
  return getStateRegion(stateCode)?.townships || []
}

/**
 * The upstream data contains a few placeholder `-` codes and repeated short
 * codes. A card stores only the short code, so neither case can be selected
 * safely without an additional identifier. Keep the complete dataset above for
 * reference, but expose only unambiguous records to the form.
 */
export function getSelectableTownships(stateCode: string): Township[] {
  const townships = getTownships(stateCode)
  const counts = new Map<string, number>()
  for (const township of townships) {
    const code = township.code.trim().toUpperCase()
    counts.set(code, (counts.get(code) || 0) + 1)
  }
  return townships.filter(township => {
    const code = township.code.trim().toUpperCase()
    return code !== '-' && counts.get(code) === 1
  })
}

export function getTownshipMatchCount(stateCode: string, townshipCode: string): number {
  const code = townshipCode.trim().toUpperCase()
  return getTownships(stateCode).filter(township => township.code.trim().toUpperCase() === code).length
}

export function isTownshipCodeAmbiguous(stateCode: string, townshipCode: string): boolean {
  const code = townshipCode.trim().toUpperCase()
  return code === '-' || getTownshipMatchCount(stateCode, code) > 1
}

/** Resolve a card code only when it identifies exactly one township. */
export function getTownship(stateCode: string, townshipCode: string): Township | undefined {
  const code = townshipCode.trim().toUpperCase()
  if (!code || code === '-') return undefined
  const matches = getTownships(stateCode).filter(township => township.code.trim().toUpperCase() === code)
  return matches.length === 1 ? matches[0] : undefined
}

export function getStateName(stateCode: string, language: 'en' | 'my'): string {
  const state = getStateRegion(stateCode)
  if (!state) return stateCode
  return language === 'my' ? state.nameMy : state.nameEn
}

export function getTownshipName(stateCode: string, townshipCode: string, language: 'en' | 'my'): string {
  const township = getTownship(stateCode, townshipCode)
  if (!township) return townshipCode
  return language === 'my' ? township.nameMy : township.nameEn
}

export function validateNrcComponents(
  stateCode: string,
  townshipCode: string,
  type: string,
  serial: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!stateCode) errors.push('State/Region is required')
  else if (!getStateRegion(stateCode)) errors.push('Invalid State/Region')

  if (!townshipCode) errors.push('Township is required')
  else if (stateCode && !getTownship(stateCode, townshipCode)) errors.push('Invalid Township for selected State/Region')

  if (!type) errors.push('NRC Type is required')
  else if (!VALID_TYPE_CODES.has(type)) errors.push('Invalid NRC Type')

  const normalizedSerial = serial.trim().replace(/[၀-၉]/g, digit => String('၀၁၂၃၄၅၆၇၈၉'.indexOf(digit)))
  if (!serial.trim()) errors.push('Serial number is required')
  else if (!/^\d{6}$/.test(normalizedSerial)) errors.push('Serial number must be exactly 6 digits')

  return { valid: errors.length === 0, errors }
}

/** Canonical written form, e.g. `12/TAMANA(N)112233` (mm-nrc convention). */
export function formatNrc(stateCode: string, townshipCode: string, type: string, serial: string): string {
  return `${stateCode}/${townshipCode}(${type})${serial}`
}
