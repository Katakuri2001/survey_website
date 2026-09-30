'use client'

import { useState, useCallback } from 'react'
import { useLanguage } from '../context/I18nProvider'
import {
  NRC_TYPES,
  normalizeMyanmarNumerals,
  validateNrc,
  formatNrcDisplay,
  isNrcComplete,
  type NrcData,
} from '../lib/nrc'
import { MYANMAR_NRC_DATA, getSelectableTownships } from '../data/myanmar-nrc'

interface NrcInputProps {
  value: NrcData
  onChange: (value: NrcData) => void
  disabled?: boolean
  required?: boolean
  error?: string
}

const selectClass = 'survey-select text-fg-bright text-sm w-full px-3.5 py-3'

interface FieldLabelProps {
  children: React.ReactNode
  required?: boolean
}

function FieldLabel({ children, required = false }: FieldLabelProps) {
  return (
    <label className="block text-sm font-medium text-fg-secondary mb-2 flex items-center gap-1">
      {children}
      {required && <span className="text-error">*</span>}
    </label>
  )
}

export default function NrcInput({ value, onChange, disabled = false, required = true, error }: NrcInputProps) {
  const { t, language } = useLanguage()
  const [touched, setTouched] = useState<Partial<Record<keyof NrcData, boolean>>>({})

  const myanmarFont = language === 'my' ? 'font-myanmar' : ''
  // Derive validation from the current controlled value. Calling a validator
  // immediately after `onChange` used to validate the previous render and left
  // the error state one interaction behind.
  const allErrors = validateNrc(value).errors
  const hasError = (field: keyof NrcData, marker: string) =>
    Boolean(touched[field] && allErrors.some(message => message.includes(marker)))
  const visibleErrors = allErrors.filter(message => {
    if (message.includes('Region')) return Boolean(touched.stateCode)
    if (message.includes('Township')) return Boolean(touched.townshipCode)
    if (message.includes('Type')) return Boolean(touched.type)
    if (message.includes('Serial')) return Boolean(touched.serial)
    return true
  })

  const handleStateChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    // Switching region invalidates the township chosen under the old region.
    onChange({ ...value, stateCode: e.target.value, townshipCode: '' })
    setTouched(prev => ({ ...prev, stateCode: true, townshipCode: false }))
  }, [onChange, value])

  const handleTownshipChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...value, townshipCode: e.target.value })
    setTouched(prev => ({ ...prev, townshipCode: true }))
  }, [onChange, value])

  const handleTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...value, type: e.target.value })
    setTouched(prev => ({ ...prev, type: true }))
  }, [onChange, value])

  const handleSerialChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Normalize Myanmar numerals before filtering so a Burmese keyboard is
    // accepted, then keep the stored/displayed value canonical ASCII.
    const input = normalizeMyanmarNumerals(e.target.value)
      .replace(/[^0-9]/g, '')
      .slice(0, 6)
    onChange({ ...value, serial: input })
    setTouched(prev => ({ ...prev, serial: true }))
  }, [onChange, value])

  const isValid = isNrcComplete(value)
  const showPreview = value.stateCode || value.townshipCode || value.type || value.serial
  const townships = getSelectableTownships(value.stateCode)

  return (
    <div className="space-y-4">
      <FieldLabel required={required}>{t('personalInfo.nrc')}</FieldLabel>

      {/* Region & Township */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <select
            value={value.stateCode}
            onChange={handleStateChange}
            disabled={disabled}
            required={required}
            className={`${selectClass} ${hasError('stateCode', 'Region') ? 'border-error' : ''}`}
            aria-invalid={hasError('stateCode', 'Region')}
          >
            <option value="" className="bg-surface-deep">{t('personalInfo.region')}</option>
            {MYANMAR_NRC_DATA.map(state => (
              <option key={state.code} value={state.code} className={`bg-surface-deep ${myanmarFont}`}>
                {language === 'my'
                  ? `${state.numberMy} — ${state.nameMy}`
                  : `${state.code} — ${state.nameEn}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={value.townshipCode ?? ''}
            onChange={handleTownshipChange}
            disabled={disabled || !value.stateCode}
            required={required}
            className={`${selectClass} ${hasError('townshipCode', 'Township') ? 'border-error' : ''}`}
            aria-invalid={hasError('townshipCode', 'Township')}
          >
            <option value="" className="bg-surface-deep">{t('delivery.townshipLabel')}</option>
            {townships.map(tw => (
              <option key={tw.id} value={tw.code} className={`bg-surface-deep ${myanmarFont}`}>
                {language === 'my' ? tw.nameMy : tw.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Type & Serial Number - Side by side on larger screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <select
            value={value.type}
            onChange={handleTypeChange}
            disabled={disabled}
            required={required}
            className={`${selectClass} ${hasError('type', 'Type') ? 'border-error' : ''}`}
            aria-invalid={hasError('type', 'Type')}
          >
            <option value="" className="bg-surface-deep">{t('personalInfo.nrcType')}</option>
            {NRC_TYPES.map(type => (
              <option key={type.code} value={type.code} className={`bg-surface-deep ${myanmarFont}`}>
                {type.code} — {language === 'my' ? type.labelMy : type.labelEn}
              </option>
            ))}
          </select>
        </div>

        <div>
          <input
            type="text"
            value={value.serial}
            onChange={handleSerialChange}
            onBlur={() => setTouched(prev => ({ ...prev, serial: true }))}
            disabled={disabled}
            required={required}
            maxLength={6}
            className={`survey-input text-sm text-center ${hasError('serial', 'Serial') ? 'border-error' : ''} ${myanmarFont}`}
            placeholder="361920"
            aria-invalid={hasError('serial', 'Serial')}
            inputMode="numeric"
          />
        </div>
      </div>

      {/* Validation Errors */}
      {(visibleErrors.length > 0 || error) && (
        <div className="space-y-1 text-sm text-error" role="alert">
          {visibleErrors.map((err, i) => (
            <p key={`${err}-${i}`} className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {err}
            </p>
          ))}
          {error && <p className="flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>{error}</p>}
        </div>
      )}

      {/* Live Preview */}
      {showPreview && (
        <div className={`pt-2 border-t border-white/10 ${isValid ? 'text-gold' : 'text-fg-muted'}`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium">{t('personalInfo.nrcPreview')}</span>
          </div>
          <div className="font-mono text-base tracking-wide bg-surface-deep/50 rounded-lg px-3 py-2 text-center select-all">
            {formatNrcDisplay(value)}
          </div>
          {!isValid && value.serial && (
            <p className="text-xs text-fg-muted mt-1 text-center">{t('personalInfo.completeAllFields')}</p>
          )}
        </div>
      )}

      {!isValid && (
        <p className="text-xs text-fg-muted text-center">{t('personalInfo.nrcExample')}</p>
      )}
    </div>
  )
}
