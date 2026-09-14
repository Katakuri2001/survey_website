'use client'

import { useState, useSyncExternalStore } from 'react'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'
import Link from 'next/link'
import { API_BASE } from '../lib/api'

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
        // Clean up
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
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-accent-warm mb-4">{t('success')}</h2>
          <p className="text-text-secondary mb-2">{t('deliveryReceived')}</p>
          <p className="text-text-secondary text-sm mb-6">{t('thankYou')}</p>
          <Link
            href="/"
            className="px-6 py-3 bg-accent-gold text-bg-primary rounded-xl font-bold hover:bg-accent-warm transition-all"
          >
            {t('home')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header
        title={t('deliveryTitle')}
        backHref="/spin"
      />
      
      <div className="max-w-lg mx-auto p-4 md:p-6">
        {/* Reward Info */}
        <div className="bg-bg-surface rounded-2xl p-5 md:p-6 border border-border mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent-gold/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🎁</span>
            </div>
            <div>
              <p className="text-accent-gold font-medium mb-1">{t('congratulations')}</p>
              <p className="text-text-secondary text-sm">{rewardName}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-4">
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-bg-surface rounded-2xl p-6 md:p-8 border border-border">
          <h2 className="text-2xl font-bold text-accent-warm mb-6">{t('deliveryDesc')}</h2>

          <div className="space-y-5">
            <div>
              <label className="block text-sm text-text-secondary mb-2">{t('fullName')}</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                className="w-full px-4 py-3 bg-bg-surface border border-border rounded-xl focus:border-accent-gold focus:outline-none text-text-primary placeholder-text-muted"
                placeholder={t('fullNamePlaceholder')}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-2">{t('phone')}</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-3 bg-bg-surface border border-border rounded-xl focus:border-accent-gold focus:outline-none text-text-primary placeholder-text-muted"
                placeholder="09 123 456 789"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-2">{t('address')}</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full px-4 py-3 bg-bg-surface border border-border rounded-xl focus:border-accent-gold focus:outline-none text-text-primary placeholder-text-muted resize-none"
                placeholder={t('addressPlaceholder')}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">{t('city')}</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  className="w-full px-4 py-3 bg-bg-surface border border-border rounded-xl focus:border-accent-gold focus:outline-none text-text-primary placeholder-text-muted"
                  placeholder={t('cityPlaceholder')}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">{t('township') || 'Township'}</label>
                <input
                  type="text"
                  value={formData.township}
                  onChange={(e) => setFormData({...formData, township: e.target.value})}
                  className="w-full px-4 py-3 bg-bg-surface border border-border rounded-xl focus:border-accent-gold focus:outline-none text-text-primary placeholder-text-muted"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-2">{t('postalCode')}</label>
              <input
                type="text"
                value={formData.postalCode}
                onChange={(e) => setFormData({...formData, postalCode: e.target.value})}
                className="w-full px-4 py-3 bg-bg-surface border border-border rounded-xl focus:border-accent-gold focus:outline-none text-text-primary placeholder-11111"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-2">{t('deliveryNotes')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full px-4 py-3 bg-bg-surface border border-border rounded-xl focus:border-accent-gold focus:outline-none text-text-primary resize-none placeholder-text-muted"
                placeholder={t('deliveryNotesPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-accent-gold text-bg-primary rounded-xl font-bold hover:bg-accent-warm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t('loading') : t('submitDelivery')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
