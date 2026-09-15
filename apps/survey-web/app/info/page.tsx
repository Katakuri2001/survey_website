'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'

const myanmarStates = [
  'ကချင်ပြည်နယ်', 'ကယားပြည်နယ်', 'ကရင်ပြည်နယ်', 'ချင်းပြည်နယ်',
  'မကွေးတိုင်းဒေသကြီး', 'မန္တလေးတိုင်းဒေသကြီး', 'မွန်ပြည်နယ်', 'ရခိုင်ပြည်နယ်',
  'ရှမ်းပြည်နယ်', 'ဧရိဝတီတိုင်းဒေသကြီး', 'ရန်ကုန်တိုင်းဒေသကြီး',
  'နေပြည်တော် ပြည်ထောင်စုနယ်မြေ'
]

const nrcTypes = ['နိုင်ငံသား', 'နိုင်ငံသား', 'ဧရိယာ']

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
  const { t } = useLanguage()
  const [formData, setFormData] = useState({
    dobDay: '',
    dobMonth: '',
    dobYear: '',
    gender: '',
    nrcState: '',
    nrcType: '',
    nrcNumber: '',
    occupation: '',
    city: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    router.push('/survey')
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
      <Header title={t('infoTitle')} backHref="/login" />

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
                  <div className={`mx-1.5 md:mx-3 h-px w-5 md:w-8 mb-5 ${i < 1 ? 'bg-gold/50' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>

          {/* -------- Intro -------- */}
          <div className="text-center mb-8">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white">{t('infoTitle')}</h2>
            <div className="mx-auto my-4 h-px w-20 bg-gradient-to-r from-transparent via-gold to-transparent" />
            <p className="text-fg-secondary">{t('infoDesc')}</p>
          </div>

          {/* -------- Form -------- */}
          <form onSubmit={handleSubmit} className="rounded-[1.75rem] border border-white/[0.08] bg-surface/90 backdrop-blur p-6 md:p-9 shadow-card animate-fade-up relative overflow-hidden">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />

            {/* DOB */}
            <div className="mb-6">
              <FieldLabel>{t('dob')}</FieldLabel>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <select
                    value={formData.dobDay}
                    onChange={(e) => setFormData({ ...formData, dobDay: e.target.value })}
                    className={selectClass}
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
                  >
                    <option value="" className="bg-surface-deep">{t('year')}</option>
                    {years.map(y => <Option key={y} value={y} label={y} />)}
                  </select>
                </div>
              </div>
            </div>

            {/* Gender */}
            <div className="mb-6">
              <FieldLabel>{t('gender')}</FieldLabel>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'male', label: t('male') },
                  { value: 'female', label: t('female') },
                  { value: 'other', label: t('other') }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, gender: option.value })}
                    className={`py-3 rounded-2xl font-semibold text-sm transition-all border ${
                      formData.gender === option.value
                        ? 'bg-gold-gradient text-brand-emerald border-gold shadow-gold'
                        : 'bg-surface-deep border-white/10 text-fg-secondary hover:border-gold/50 hover:text-gold'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* NRC */}
            <div className="mb-6">
              <FieldLabel>{t('nrc')}</FieldLabel>
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 mb-2">
                <select
                  value={formData.nrcState}
                  onChange={(e) => setFormData({ ...formData, nrcState: e.target.value })}
                  className={selectClass}
                >
                  <option value="" className="bg-surface-deep">{t('stateRegion')}</option>
                  {myanmarStates.map(s => <Option key={s} value={s} label={s} />)}
                </select>
                <select
                  value={formData.nrcType}
                  onChange={(e) => setFormData({ ...formData, nrcType: e.target.value })}
                  className={`${selectClass} w-24`}
                >
                  <option value="" className="bg-surface-deep">{t('nrcType')}</option>
                  {nrcTypes.map((n, i) => <Option key={i} value={n} label={n} />)}
                </select>
                <input
                  type="text"
                  value={formData.nrcNumber}
                  onChange={(e) => setFormData({ ...formData, nrcNumber: e.target.value })}
                  className="survey-input w-28 text-sm"
                  placeholder={t('nrcPlaceholder')}
                  maxLength={6}
                />
              </div>
              <p className="text-xs text-fg-muted">{t('nrcExample')}</p>
            </div>

            {/* Occupation */}
            <div className="mb-6">
              <FieldLabel>{t('occupation')}</FieldLabel>
              <input
                type="text"
                value={formData.occupation}
                onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                className="survey-input"
                placeholder={t('occupationPlaceholder')}
              />
            </div>

            {/* City */}
            <div className="mb-7">
              <FieldLabel>{t('city')}</FieldLabel>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="survey-input"
                placeholder={t('cityPlaceholder')}
              />
            </div>

            <button
              type="submit"
              className="group w-full py-4 bg-gold-gradient text-brand-emerald rounded-2xl font-bold text-lg shadow-gold hover:shadow-gold-lg hover:scale-[1.01] transition-all inline-flex items-center justify-center gap-2"
            >
              {t('next')}
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}