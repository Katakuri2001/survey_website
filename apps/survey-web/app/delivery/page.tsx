'use client'

import { useState, useSyncExternalStore } from 'react'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'
import Link from 'next/link'
import { API_BASE } from '../lib/api'

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-fg-secondary mb-2">{children}</label>
}

export default function DeliveryPage() {
  const { t } = useLanguage()
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    township: '',
    postalCode: '',
    notes: ''
  })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const noopSubscribe = () => () => {}
  const rewardName = useSyncExternalStore(
    noopSubscribe,
    () => (typeof window !== 'undefined' ? sessionStorage.getItem('reward_name') || t('yourReward') : t('yourReward')),
    () => t('yourReward')
  )
  const userRewardId = useSyncExternalStore(
    noopSubscribe,
    () => (typeof window !== 'undefined' ? sessionStorage.getItem('user_reward_id') || '' : ''),
    () => ''
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userRewardId) {
      setError(t('noReward'))
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const token = localStorage.getItem('survey_token')
      const res = await fetch(`${API_BASE}/rewards/delivery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userRewardId,
          fullName: formData.fullName,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          township: formData.township,
          postalCode: formData.postalCode,
          notes: formData.notes,
        })
      })
      const data = await res.json()

      if (data.success) {
        setSubmitted(true)
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('user_reward_id')
          sessionStorage.removeItem('reward_name')
          sessionStorage.removeItem('survey_response_id')
        }
      } else {
        setError(data.error?.message || t('failedToSubmit'))
      }
    } catch {
      setError(t('connectionFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center relative overflow-hidden">
        <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[480px] h-[360px] rounded-full bg-gold/[0.08] blur-[120px]" />
        <div className="relative text-center px-4 animate-reveal-in">
          <div className="w-24 h-24 bg-success/15 border border-success/40 rounded-full flex items-center justify-center mx-auto mb-7 animate-ring-pulse">
            <svg className="w-12 h-12 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-bold gold-text mb-4">{t('success')}</h2>
          <div className="mx-auto my-5 h-px w-20 bg-gradient-to-r from-transparent via-gold to-transparent" />
          <p className="text-fg-secondary mb-2">{t('deliveryReceived')}</p>
          <p className="text-fg-muted text-sm mb-9">{t('thankYou')}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-9 py-4 bg-gold-gradient text-brand-emerald rounded-full font-bold text-lg shadow-gold hover:shadow-gold-lg hover:scale-[1.02] transition-all"
          >
            {t('home')}
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
            </svg>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy text-fg-bright overflow-hidden">
      <Header title={t('deliveryTitle')} backHref="/spin" />

      <div className="relative mx-auto max-w-xl px-4 pb-12">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[420px] h-[280px] rounded-full bg-gold/[0.07] blur-[110px]" />

        <div className="relative">
          {/* reward banner */}
          <div className="mt-5 mb-5 rounded-2xl border border-gold/25 bg-gradient-to-r from-surface to-surface/60 p-5 flex items-center gap-4 animate-fade-up">
            <div className="w-12 h-12 rounded-2xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0 gold-border">
              <svg className="w-6 h-6 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l9-4 9 4-9 4-9-4zm0 0v8m9 4l9-4v-8m-9 4l-9-4m9 4v8" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs tracking-widest uppercase text-gold mb-0.5">{t('congratulations')}</p>
              <p className="font-display font-bold text-white truncate">{rewardName}</p>
            </div>
          </div>

          {error && (
            <div className="mb-5 bg-error/10 border border-error/30 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-error mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          {/* form */}
          <form onSubmit={handleSubmit} className="rounded-[1.75rem] border border-white/[0.08] bg-surface/90 backdrop-blur p-6 md:p-9 shadow-card animate-fade-up relative overflow-hidden" style={{ animationDelay: '0.1s' }}>
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
            <h2 className="font-display text-xl md:text-2xl font-bold text-white mb-7">{t('deliveryDesc')}</h2>

            <div className="space-y-5">
              <div>
                <FieldLabel>{t('fullName')}</FieldLabel>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="survey-input"
                  placeholder={t('fullNamePlaceholder')}
                  required
                />
              </div>

              <div>
                <FieldLabel>{t('phone')}</FieldLabel>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="survey-input"
                  placeholder="09 123 456 789"
                  required
                />
              </div>

              <div>
                <FieldLabel>{t('address')}</FieldLabel>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="survey-input resize-none min-h-[90px]"
                  placeholder={t('addressPlaceholder')}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>{t('city')}</FieldLabel>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="survey-input"
                    placeholder={t('cityPlaceholder')}
                    required
                  />
                </div>
                <div>
                  <FieldLabel>{t('township') || 'Township'}</FieldLabel>
                  <input
                    type="text"
                    value={formData.township}
                    onChange={(e) => setFormData({ ...formData, township: e.target.value })}
                    className="survey-input"
                  />
                </div>
              </div>

              <div>
                <FieldLabel>{t('postalCode')}</FieldLabel>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  className="survey-input"
                />
              </div>

              <div>
                <FieldLabel>{t('deliveryNotes')}</FieldLabel>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="survey-input resize-none min-h-[80px]"
                  placeholder={t('deliveryNotesPlaceholder')}
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !userRewardId}
                className="w-full py-4 bg-gold-gradient text-brand-emerald rounded-2xl font-bold text-lg shadow-gold hover:shadow-gold-lg hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {submitting ? t('loading') : t('submitDelivery')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}