'use client'

import { useState, useCallback } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { getAllStates, getAvailableTownships, NRC_TYPES, validateNrc, formatNrcDisplay, isNrcComplete, type NrcData } from '../lib/nrc'

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
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const states = getAllStates()
  const townships = getAvailableTownships(value.stateCode)

  // Validate helper
  const runValidation = useCallback(() => {
    if (touched.stateCode && touched.townshipCode && touched.type && touched.serial) {
      const result = validateNrc(value)
      setValidationErrors(result.errors)
    }
  }, [value, touched])

  const handleStateChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStateCode = e.target.value
    onChange({
      ...value,
      stateCode: newStateCode,
      townshipCode: '', // Reset township when state changes
    })
    setTouched(prev => ({ ...prev, stateCode: true }))
    runValidation()
  }, [onChange, value, runValidation])

  const handleTownshipChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...value, townshipCode: e.target.value })
    setTouched(prev => ({ ...prev, townshipCode: true }))
    runValidation()
  }, [onChange, value, runValidation])

  const handleTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...value, type: e.target.value })
    setTouched(prev => ({ ...prev, type: true }))
    runValidation()
  }, [onChange, value, runValidation])

  const handleSerialChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, max 6
    const input = e.target.value.replace(/\D/g, '').slice(0, 6)
    onChange({ ...value, serial: input })
    setTouched(prev => ({ ...prev, serial: true }))
    runValidation()
  }, [onChange, value, runValidation])

  const isValid = isNrcComplete(value)
  const showPreview = value.stateCode || value.townshipCode || value.type || value.serial

  return (
    <div className="space-y-4">
      <FieldLabel required={required}>{t('nrc')}</FieldLabel>

      {/* State / Region */}
      <div>
        <select
          value={value.stateCode}
          onChange={handleStateChange}
          disabled={disabled}
          required={required}
          className={`${selectClass} ${touched.stateCode && validationErrors.some(e => e.includes('State')) ? 'border-error' : ''}`}
          aria-invalid={touched.stateCode && validationErrors.some(e => e.includes('State'))}
        >
          <option value="" className="bg-surface-deep">{t('stateRegion')}</option>
          {states.map(state => (
            <option key={state.code} value={state.code} className="bg-surface-deep font-myanmar">
              {state.code} — {language === 'my' ? state.nameMy : state.nameEn}
            </option>
          ))}
        </select>
      </div>

      {/* Township */}
      <div>
        <select
          value={value.townshipCode}
          onChange={handleTownshipChange}
          disabled={disabled || townships.length === 0}
          required={required}
          className={`${selectClass} ${touched.townshipCode && validationErrors.some(e => e.includes('Township')) ? 'border-error' : ''}`}
          aria-invalid={touched.townshipCode && validationErrors.some(e => e.includes('Township'))}
        >
          <option value="" className="bg-surface-deep">
            {townships.length === 0 ? t('selectStateFirst') : t('townshipCodeLabel')}
          </option>
          {townships.map(township => (
            <option key={township.code} value={township.code} className="bg-surface-deep font-myanmar">
              {township.code} — {language === 'my' ? township.nameMy : township.nameEn}
            </option>
          ))}
        </select>
        {townships.length === 0 && (
          <p className="text-xs text-fg-muted mt-1">{t('selectStateForTownship')}</p>
        )}
      </div>

      {/* Type & Serial Number - Side by side on larger screens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <select
            value={value.type}
            onChange={handleTypeChange}
            disabled={disabled}
            required={required}
            className={`${selectClass} ${touched.type && validationErrors.some(e => e.includes('Type')) ? 'border-error' : ''}`}
            aria-invalid={touched.type && validationErrors.some(e => e.includes('Type'))}
          >
            <option value="" className="bg-surface-deep">{t('nrcType')}</option>
            {NRC_TYPES.map(type => (
              <option key={type.code} value={type.code} className="bg-surface-deep font-myanmar">
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
            className={`survey-input text-sm text-center ${touched.serial && validationErrors.some(e => e.includes('Serial')) ? 'border-error' : ''} ${language === 'my' ? 'font-myanmar' : ''}`}
            placeholder="361920"
            aria-invalid={touched.serial && validationErrors.some(e => e.includes('Serial'))}
            inputMode="numeric"
            pattern="[0-9]*"
          />
        </div>
      </div>

      {/* Validation Errors */}
      {(validationErrors.length > 0 || error) && (
        <div className="space-y-1 text-sm text-error">
          {validationErrors.map((err, i) => (
            <p key={i} className="flex items-center gap-1">
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
            <span className="font-medium">{t('nrcPreview')}</span>
            {isValid && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-success/20 text-success font-mono">{t('valid')}</span>
            )}
          </div>
          <div className="font-mono text-base tracking-wide bg-surface-deep/50 rounded-lg px-3 py-2 text-center select-all">
            {formatNrcDisplay(value)}
          </div>
          {!isValid && value.serial && (
            <p className="text-xs text-fg-muted mt-1 text-center">{t('completeAllFields')}</p>
          )}
        </div>
      )}

      {/* Example */}
      <p className="text-xs text-fg-muted text-center">{t('nrcExample')}</p>
    </div>
  )
}