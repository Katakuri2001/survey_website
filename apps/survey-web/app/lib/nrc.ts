// NRC Utility Functions
// Shared utilities for NRC formatting, validation, and parsing

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

// Validate NRC data - only stateCode, type, serial required
export function validateNrc(data: NrcData): NrcValidationResult {
  const normalizedSerial = normalizeMyanmarNumerals(data.serial)
  const errors: string[] = []
  
  if (!data.stateCode || !['1','2','3','4','5','6','7','8','9','10','11','12','13','14'].includes(data.stateCode)) {
    errors.push('Region is required (1-14)')
  }
  if (!data.type) {
    errors.push('NRC Type is required')
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

// Format NRC for display (region/type/serial only)
export function formatNrcDisplay(data: NrcData): string {
  const normalizedSerial = normalizeMyanmarNumerals(data.serial)
  if (data.stateCode && data.type && normalizedSerial) {
    return `${data.stateCode}/${data.type}${normalizedSerial}`
  }
  // Partial display
  const parts: string[] = []
  if (data.stateCode) parts.push(data.stateCode)
  if (data.type) parts.push(`/${data.type}`)
  if (normalizedSerial) parts.push(normalizedSerial)
  else if (data.serial) parts.push('______')
  return parts.join('')
}

// Check if NRC data is complete (region, type, serial only)
export function isNrcComplete(data: NrcData): boolean {
  return !!data.stateCode && !!data.type && validateSerial(data.serial)
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
  // Format: 14/N361920
  const match = formatted.match(/^(\d+)\/([A-Z]+)(\d+)$/)
  if (!match) return null
  return {
    stateCode: match[1],
    type: match[2],
    serial: match[3],
  }
}