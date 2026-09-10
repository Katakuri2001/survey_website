'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'

const API_BASE = 'http://localhost:8787'

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
  const [rewardName, setRewardName] = useState('')
  const [userRewardId, setUserRewardId] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRewardName(sessionStorage.getItem('reward_name') || 'Your Reward')
      setUserRewardId(sessionStorage.getItem('user_reward_id') || '')
    }
  }, [])

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
    } catch (err) {
      setError(t('connectionFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-800 text-white flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-yellow-300 mb-4">{t('success')}</h2>
          <p className="text-blue-200 mb-2">{t('deliveryReceived')}</p>
          <p className="text-blue-300 text-sm mb-6">{t('thankYou')}</p>
          <a
            href="/"
            className="inline-block px-8 py-3 bg-yellow-500 text-blue-900 rounded-xl font-bold hover:bg-yellow-400 transition-all"
          >
            {t('home')}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-800 text-white">
      <Header title={t('deliveryTitle')} backHref="/spin" />
      
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Reward Info */}
        <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🎁</span>
            </div>
            <div>
              <p className="text-yellow-300 font-medium">{t('congratulations')}</p>
              <p className="text-sm text-blue-200">{rewardName}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-sm text-red-200 mb-4">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <h2 className="text-xl font-bold mb-6 text-yellow-300">{t('deliveryDesc')}</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">{t('fullName')}</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-yellow-400 focus:outline-none text-white placeholder-blue-300"
                placeholder={t('fullNamePlaceholder')}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">{t('phone')}</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-yellow-400 focus:outline-none text-white placeholder-blue-300"
                placeholder="09 123 456 789"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">{t('address')}</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full h-24 px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-yellow-400 focus:outline-none text-white placeholder-blue-300 resize-none"
                placeholder={t('addressPlaceholder')}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">{t('city')}</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-yellow-400 focus:outline-none text-white placeholder-blue-300"
                  placeholder={t('cityPlaceholder')}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">{t('township') || 'Township'}</label>
                <input
                  type="text"
                  value={formData.township}
                  onChange={(e) => setFormData({...formData, township: e.target.value})}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-yellow-400 focus:outline-none text-white placeholder-blue-300"
                  placeholder={t('statePlaceholder')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">{t('postalCode')}</label>
              <input
                type="text"
                value={formData.postalCode}
                onChange={(e) => setFormData({...formData, postalCode: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-yellow-400 focus:outline-none text-white placeholder-blue-300"
                placeholder="11111"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-200 mb-2">{t('deliveryNotes')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full h-20 px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-yellow-400 focus:outline-none text-white placeholder-blue-300 resize-none"
                placeholder={t('deliveryNotesPlaceholder')}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-yellow-500 text-blue-900 rounded-xl font-bold hover:bg-yellow-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t('loading') : t('submitDelivery')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}