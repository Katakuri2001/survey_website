// NRC Utility Functions
// Shared utilities for NRC formatting, validation, and parsing.
// Data (states, townships, type letters) comes from `mm-nrc` via
// `app/data/myanmar-nrc.ts` — see docs/myanmar-nrc.md before changing.

import { getStateRegion, getTownship, isTownshipCodeAmbiguous, NRC_TYPES } from '../data/myanmar-nrc'

export { NRC_TYPES }
export type { NrcTypeOption } from '../data/myanmar-nrc'

export interface NrcData {
  stateCode: string
  townshipCode: string
  type: string
  serial: string
}

export interface NrcValidationResult {
  valid: boolean
  errors: string[]
  formatted?: string
}

// Citizenship letters shipped by mm-nrc@0.2.5 (N E P T Y S).
export type NrcTypeCode = 'N' | 'E' | 'P' | 'T' | 'Y' | 'S'

// Normalize Myanmar numerals to ASCII digits
export function normalizeMyanmarNumerals(input: string): string {
  const myanmarDigits = '၀၁၂၃၄၅၆၇၈၉'
  return input.split('').map(ch => {
    const idx = myanmarDigits.indexOf(ch)
    return idx >= 0 ? String(idx) : ch
  }).join('')
}

// Validate serial number (exactly 6 digits)
export function validateSerial(serial: string): boolean {
  const normalized = normalizeMyanmarNumerals(serial.trim())
  return /^\d{6}$/.test(normalized)
}

// Validate NRC data — all four components are required (state, township,
// type letter, serial). Error messages must keep the substrings
// 'Region'/'Township'/'Type'/'Serial' — NrcInput matches on them for
// inline error styling.
export function validateNrc(data: NrcData): NrcValidationResult {
  const normalizedSerial = normalizeMyanmarNumerals(data.serial)
  const errors: string[] = []

  if (!getStateRegion(data.stateCode)) {
    errors.push('Region is required')
  }
  if (!data.townshipCode) {
    errors.push('Township is required')
  } else if (data.stateCode && isTownshipCodeAmbiguous(data.stateCode, data.townshipCode)) {
    errors.push('Township code is ambiguous; choose a unique township')
  } else if (data.stateCode && !getTownship(data.stateCode, data.townshipCode)) {
    errors.push('Invalid Township for selected Region')
  }
  if (!data.type) {
    errors.push('NRC Type is required')
  } else if (!NRC_TYPES.some(t => t.code === data.type)) {
    errors.push('Invalid NRC Type')
  }
  if (!validateSerial(normalizedSerial)) {
    errors.push('Serial number must be exactly 6 digits')
  }

  return {
    valid: errors.length === 0,
    errors,
    formatted: errors.length === 0 ? formatNrcDisplay({ ...data, serial: normalizedSerial }) : undefined,
  }
}

// Format NRC for display — canonical full form `12/TAMANA(N)112233`,
// falling back to a progressive rendering while fields are still empty.
export function formatNrcDisplay(data: NrcData): string {
  const normalizedSerial = normalizeMyanmarNumerals(data.serial)
  if (data.stateCode && data.townshipCode && data.type && normalizedSerial) {
    return `${data.stateCode}/${data.townshipCode}(${data.type})${normalizedSerial}`
  }
  // Partial display
  const parts: string[] = []
  if (data.stateCode) parts.push(data.stateCode)
  if (data.townshipCode) parts.push(`/${data.townshipCode}`)
  if (data.type) parts.push(`(${data.type})`)
  if (normalizedSerial) parts.push(normalizedSerial)
  else if (data.serial) parts.push('______')
  return parts.join('')
}

// Check if NRC data is complete (region, township, type, serial)
export function isNrcComplete(data: NrcData): boolean {
  return validateNrc(data).valid
}

// Parse a canonical formatted NRC string back to components (best effort).
// The dataset is the authority: placeholder and ambiguous short codes are not
// accepted merely because they fit the textual shape.
export function parseNrc(formatted: string): Partial<NrcData> | null {
  // Format: 12/TAMANA(N)112233
  const match = normalizeMyanmarNumerals(formatted.trim())
    .match(/^(\d{1,2}\*?)\/([A-Z][A-Z0-9-]*)\(([A-Z])\)(\d{1,})$/)
  if (!match) return null
  const data: NrcData = {
    stateCode: match[1],
    townshipCode: match[2],
    type: match[3],
    serial: match[4],
  }
  return validateNrc(data).valid ? data : null
}
