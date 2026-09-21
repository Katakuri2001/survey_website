'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'
import NrcInput from '../components/NrcInput'
import { API_BASE } from '../lib/api'
import { getTurnstileToken } from '../lib/turnstile'
import { useHydrated } from '../lib/useHydrated'
import type { NrcData } from '../lib/nrc'

const DRAFT_KEY = 'survey_info_draft'

const emptyNrc: NrcData = {
  stateCode: '',
  townshipCode: '',
  type: '',
  serial: '',
}

const emptyDraft = {
  fullName: '',
  phone: '',
  dobDay: '',
  dobMonth: '',
  dobYear: '',
  nrc: emptyNrc,
}

function loadDraft() {
  if (typeof window === 'undefined') return emptyDraft
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return emptyDraft
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return { ...emptyDraft, ...parsed }
    }
  } catch {
    // ignore corrupted draft
  }
  return emptyDraft
}

const STEPS = [
  { n: '01', label: 'Personal' },
  { n: '02', label: 'Survey' },
  { n: '03', label: 'Review' },
  { n: '04', label: 'Spin' },
  { n: '05', label: 'Reward' },
]

const selectClass =
  'survey-select text-fg-bright text-sm w-full px-3.5 py-3'

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-fg-secondary mb-2">{children}</label>
}

export default function InfoPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [formData, setFormData] = useState(loadDraft)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const hydrated = useHydrated()

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData))
    } catch {
      // storage full or unavailable; form still works in-memory
    }
  }, [formData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const dob = `${formData.dobYear}-${formData.dobMonth.padStart(2, '0')}-${formData.dobDay.padStart(2, '0')}`

    try {
      const turnstileToken = await getTurnstileToken()
      const res = await fetch(`${API_BASE}/users/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          phone: formData.phone,
          dob,
          stateCode: formData.nrc.stateCode,
          nrcType: formData.nrc.type,
          nrcNumber: formData.nrc.serial,
          turnstileToken,
        })
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message || `Server error: ${res.status}`)
        return
      }

      if (data.success) {
        localStorage.setItem('survey_token', data.data.token)
        localStorage.setItem('survey_user', JSON.stringify(data.data.user))
        // Store full profile so token can be refreshed if it expires mid-session
        localStorage.setItem('survey_profile', JSON.stringify({
          fullName: formData.fullName,
          phone: formData.phone,
          dob,
          stateCode: formData.nrc.stateCode,
          nrcType: formData.nrc.type,
          nrcNumber: formData.nrc.serial,
        }))
        localStorage.removeItem(DRAFT_KEY)
        router.push('/survey')
      } else {
        setError(data.error?.message || t('error'))
      }
    } catch (err) {
      console.error('Connection error:', err)
      setError(`${t('connectionFailed')}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1))
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1))
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 60 }, (_, i) => String(currentYear - 18 - i))

  const Option = ({ value, label }: { value: string; label: string }) => (
    <option value={value} className="bg-surface-deep text-fg-bright">{label}</option>
  )

  return (
    <div className="min-h-screen bg-navy text-fg-bright">
      <Header title={t('infoTitle')} backHref="/" />

      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[420px] h-[300px] rounded-full bg-gold/[0.07] blur-[110px]" />

        <div className="relative mx-auto max-w-xl px-4 py-8 md:py-12">
          {/* -------- Step tracker -------- */}
          <div className="mb-8 flex items-center justify-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                      i === 0
                        ? 'bg-gold-gradient text-brand-emerald shadow-gold'
                        : i === 1
                          ? 'bg-white/10 text-fg-secondary border border-white/10'
                          : 'bg-transparent text-fg-muted'
                    }`}
                  >
                    {i < 1 ? '✓' : s.n}
                  </span>
                  <span className={`text-[9px] tracking-wide uppercase ${i === 0 ? 'text-gold' : 'text-fg-muted'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`mx-1.5 md:mx-3 h-px w-4 md:w-8 mb-5 ${i < 1 ? 'bg-gold/50' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>

          {/* -------- Intro -------- */}
          <div className="text-center mb-8">
            <h2 className={`font-display text-2xl md:text-3xl font-bold text-white ${language === 'my' ? 'font-myanmar leading-snug' : ''}`}>{t('infoTitle')}</h2>
            <div className="mx-auto my-4 h-px w-20 bg-gradient-to-r from-transparent via-gold to-transparent" />
            <p className="text-fg-secondary">{t('infoDesc')}</p>
          </div>

          {/* -------- Form -------- */}
          <form key={hydrated ? 'info-form-ready' : 'info-form'} onSubmit={handleSubmit} className="rounded-[1.75rem] border border-white/[0.08] bg-surface/90 backdrop-blur p-6 md:p-9 shadow-card animate-fade-up relative overflow-hidden">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />

            {error && (
              <div className="mb-5 bg-error/10 border border-error/30 rounded-xl p-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-error mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-error text-sm">{error}</p>
              </div>
            )}

            {/* Full name */}
            <div className="mb-6">
              <FieldLabel>{t('fullName')}</FieldLabel>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className={`survey-input ${language === 'my' ? 'font-myanmar leading-relaxed' : ''}`}
                placeholder={t('fullNamePlaceholder')}
                required
              />
            </div>

            {/* Phone */}
            <div className="mb-6">
              <FieldLabel>{t('phone')}</FieldLabel>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={`survey-input ${language === 'my' ? 'font-myanmar leading-relaxed' : ''}`}
                placeholder="09 123 456 789"
                required
              />
            </div>

            {/* DOB */}
            <div className="mb-6">
              <FieldLabel>{t('dob')}</FieldLabel>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <select
                    value={formData.dobDay}
                    onChange={(e) => setFormData({ ...formData, dobDay: e.target.value })}
                    className={selectClass}
                    required
                  >
                    <option value="" className="bg-surface-deep">{t('day')}</option>
                    {days.map(d => <Option key={d} value={d} label={d} />)}
                  </select>
                </div>
                <div>
                  <select
                    value={formData.dobMonth}
                    onChange={(e) => setFormData({ ...formData, dobMonth: e.target.value })}
                    className={selectClass}
                    required
                  >
                    <option value="" className="bg-surface-deep">{t('month')}</option>
                    {months.map(m => <Option key={m} value={m} label={m} />)}
                  </select>
                </div>
                <div>
                  <select
                    value={formData.dobYear}
                    onChange={(e) => setFormData({ ...formData, dobYear: e.target.value })}
                    className={selectClass}
                    required
                  >
                    <option value="" className="bg-surface-deep">{t('year')}</option>
                    {years.map(y => <Option key={y} value={y} label={y} />)}
                  </select>
                </div>
              </div>
            </div>

            {/* NRC */}
            <div className="mb-6">
              <NrcInput
                value={formData.nrc}
                onChange={(nrc) => setFormData({ ...formData, nrc })}
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group w-full py-4 bg-lager-gradient text-white rounded-2xl font-bold text-lg shadow-lager hover:shadow-lager-lg hover:scale-[1.01] transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('loading') : t('next')}
              {!loading && (
                <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5-5 5M6 12h12" />
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}