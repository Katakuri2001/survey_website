// NRC Utility Functions
// Shared utilities for NRC formatting, validation, and parsing

import { validateNrcComponents, formatNrc, getStateName, getTownshipName, getTownships, MYANMAR_NRC_DATA } from '../data/myanmar-nrc'

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

// Validate NRC data
export function validateNrc(data: NrcData): NrcValidationResult {
  const normalizedSerial = normalizeMyanmarNumerals(data.serial)
  const result = validateNrcComponents(
    data.stateCode,
    data.townshipCode,
    data.type,
    normalizedSerial
  )
  return {
    valid: result.valid,
    errors: result.errors,
    formatted: result.valid ? formatNrc(data.stateCode, data.townshipCode, data.type, normalizedSerial) : undefined,
  }
}

// Format NRC for display
export function formatNrcDisplay(data: NrcData): string {
  const normalizedSerial = normalizeMyanmarNumerals(data.serial)
  if (data.stateCode && data.townshipCode && data.type && normalizedSerial) {
    return formatNrc(data.stateCode, data.townshipCode, data.type, normalizedSerial)
  }
  // Partial display
  const parts: string[] = []
  if (data.stateCode) parts.push(data.stateCode)
  if (data.townshipCode) parts.push(`/${data.townshipCode}`)
  if (data.type) parts.push(` (${data.type})`)
  if (normalizedSerial) parts.push(normalizedSerial)
  else if (data.serial) parts.push('______')
  return parts.join('')
}

// Get display name for state
export function getStateDisplayName(stateCode: string, language: 'en' | 'my'): string {
  return getStateName(stateCode, language)
}

// Get display name for township
export function getTownshipDisplayName(stateCode: string, townshipCode: string, language: 'en' | 'my'): string {
  return getTownshipName(stateCode, townshipCode, language)
}

// Get available townships for a state
export function getAvailableTownships(stateCode: string) {
  return getTownships(stateCode)
}

// Get all states
export function getAllStates() {
  return MYANMAR_NRC_DATA
}

// NRC Type options (stable codes with localized labels)
export const NRC_TYPES = [
  { code: 'N', labelEn: 'National', labelMy: 'နိုင်' },
  { code: 'E', labelEn: 'Associate', labelMy: 'ဧည့်' },
  { code: 'P', labelEn: 'Passport', labelMy: 'ဧည့်' },
  { code: 'NRC', labelEn: 'NRC', labelMy: 'NRC' },
] as const

export type NrcTypeCode = typeof NRC_TYPES[number]['code']

// Parse formatted NRC string back to components (best effort)
export function parseNrc(formatted: string): Partial<NrcData> | null {
  // Format: 14/HATHATA (N)361920
  const match = formatted.match(/^(\d+)\/([A-Z0-9]+)\s*\(([A-Z]+)\)(\d+)$/)
  if (!match) return null
  return {
    stateCode: match[1],
    townshipCode: match[2],
    type: match[3],
    serial: match[4],
  }
}

// Check if NRC data is complete
export function isNrcComplete(data: NrcData): boolean {
  return !!data.stateCode && !!data.townshipCode && !!data.type && validateSerial(data.serial)
}