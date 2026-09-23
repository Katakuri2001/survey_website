'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'
import { API_BASE, getValidToken, surveyHeaders } from '../lib/api'
import { useHydrated } from '../lib/useHydrated'

interface ProfileDraft {
  fullName?: string
  phone?: string
  city?: string
  township?: string
}

function loadProfile(): ProfileDraft {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem('survey_profile') || '{}') as ProfileDraft
  } catch {
    return {}
  }
}

function resolveRewardId(): string {
  if (typeof window === 'undefined') return ''
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('reward')
    if (fromQuery) return fromQuery
  } catch {
    // ignore malformed query
  }
  return sessionStorage.getItem('user_reward_id') || ''
}

export default function DeliveryPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const hydrated = useHydrated()

  const [rewardId, setRewardId] = useState('')
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    township: '',
    postalCode: '',
    notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // Read the query/profile on the client only so the page stays a static export.
  useEffect(() => {
    if (!hydrated) return
    const id = resolveRewardId()
    if (!id) {
      router.replace('/spin')
      return
    }
    // Justification: syncs the ?reward= route param into state once on mount — the effect is the only lifecycle point that observes param changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRewardId(id)

    const profile = loadProfile()
    setForm(prev => ({
      ...prev,
      fullName: profile.fullName || prev.fullName,
      phone: profile.phone || prev.phone,
      city: profile.city || prev.city,
      township: profile.township || prev.township,
    }))
  }, [hydrated, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rewardId || loading) return
    setError('')
    setLoading(true)

    const send = async (token: string) =>
      fetch(`${API_BASE}/rewards/delivery`, {
        method: 'POST',
        headers: surveyHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
        body: JSON.stringify({
          userRewardId: rewardId,
          fullName: form.fullName,
          phone: form.phone,
          address: form.address,
          city: form.city,
          township: form.township || undefined,
          postalCode: form.postalCode || undefined,
          notes: form.notes || undefined,
        }),
      })

    try {
      let token = await getValidToken()
      if (!token) {
        setError(t('sessionExpired'))
        router.replace('/info')
        return
      }

      let res = await send(token)
      if (res.status === 401) {
        const refreshed = await getValidToken(true)
        if (refreshed) {
          token = refreshed
          res = await send(token)
        }
      }

      const data = await res.json()
      if (data.success) {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('user_reward_id')
          sessionStorage.removeItem('reward_name')
        }
        setSubmitted(true)
      } else if (data.error?.code === 'NOT_FOUND') {
        setError(t('rewardNotFound'))
      } else {
        setError(data.error?.message || t('failedToSubmit'))
      }
    } catch {
      setError(t('connectionFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center p-4">
        <div className="h-2 w-40 rounded-full shimmer-bg" />
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-navy text-fg-bright">
        <Header title={t('deliveryTitle')} backHref="/" />
        <div className="relative mx-auto max-w-xl px-4 py-16 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gold/15 border border-gold/40 flex items-center justify-center animate-pop">
            <svg className="w-9 h-9 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold gold-text mb-3">{t('deliverySuccess')}</h2>
          <p className="text-fg-secondary mb-8">{t('deliverySuccessDesc')}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-4 bg-gold-gradient text-brand-emerald rounded-2xl font-bold shadow-gold hover:shadow-gold-lg hover:scale-[1.01] transition-all"
          >
            {t('done')}
          </button>
        </div>
      </div>
    )
  }

  const inputClass = `survey-input ${language === 'my' ? 'font-myanmar leading-relaxed' : ''}`

  return (
    <div className="min-h-screen bg-navy text-fg-bright">
      <Header title={t('deliveryTitle')} backHref="/spin" />

      <div className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[420px] h-[300px] rounded-full bg-gold/[0.07] blur-[110px]" />

        <div className="relative mx-auto max-w-xl px-4 py-8 md:py-12">
          <div className="text-center mb-8">
            <h2 className={`font-display text-2xl md:text-3xl font-bold text-white ${language === 'my' ? 'font-myanmar leading-snug' : ''}`}>
              {t('deliveryTitle')}
            </h2>
            <div className="mx-auto my-4 h-px w-20 bg-gradient-to-r from-transparent via-gold to-transparent" />
            <p className="text-fg-secondary">{t('deliveryDesc')}</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-[1.75rem] border border-white/[0.08] bg-surface/90 backdrop-blur p-6 md:p-9 shadow-card animate-fade-up relative overflow-hidden"
          >
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />

            {error && (
              <div className="mb-5 bg-error/10 border border-error/30 rounded-xl p-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-error mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-error text-sm">{error}</p>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-fg-secondary mb-2">{t('fullName')}</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className={inputClass}
                placeholder={t('fullNamePlaceholder')}
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-fg-secondary mb-2">{t('phone')}</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass}
                placeholder="09 123 456 789"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-fg-secondary mb-2">{t('address')}</label>
              <textarea
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className={`${inputClass} min-h-[88px] resize-y`}
                placeholder={t('addressPlaceholder')}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-2">{t('city')}</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className={inputClass}
                  placeholder={t('cityPlaceholder')}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-fg-secondary mb-2">{t('townshipLabel')}</label>
                <input
                  type="text"
                  value={form.township}
                  onChange={(e) => setForm({ ...form, township: e.target.value })}
                  className={inputClass}
                  placeholder={t('townshipPlaceholder')}
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-fg-secondary mb-2">{t('postalCode')}</label>
              <input
                type="text"
                value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                className={inputClass}
                placeholder={t('postalCodePlaceholder')}
              />
            </div>

            <div className="mb-8">
              <label className="block text-sm font-medium text-fg-secondary mb-2">{t('deliveryNotes')}</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={`${inputClass} min-h-[72px] resize-y`}
                placeholder={t('deliveryNotesPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group w-full py-4 bg-gold-gradient text-brand-emerald rounded-2xl font-bold text-lg shadow-gold hover:shadow-gold-lg hover:scale-[1.01] transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('loading') : t('confirmDelivery')}
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
