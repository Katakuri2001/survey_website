'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'
import { API_BASE } from '../lib/api'

export default function LoginPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!isLogin && formData.password !== formData.confirmPassword) {
        setError(t('passwordMismatch'))
        setLoading(false)
        return
      }

      const endpoint = isLogin ? '/auth/login' : '/auth/register'
      const body = isLogin
        ? { email: formData.email, password: formData.password }
        : { fullName: formData.fullName, email: formData.email, phone: formData.phone, password: formData.password }

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()

      if (data.success) {
        localStorage.setItem('survey_token', data.data.token)
        localStorage.setItem('survey_user', JSON.stringify(data.data.user))
        router.push('/info')
      } else {
        setError(data.error?.message || t('error'))
      }
    } catch {
      setError(t('connectionFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header
        title={isLogin ? t('loginTitle') : t('registerTitle')}
        backHref="/"
      />
      
      <div className="min-h-screen p-4 md:p-8">
        {/* Left: Visual hero for desktop */}
        <div className="hidden md:block h-[500px] md:h-[600px] bg-gradient-to-b from-bg-primary via-bg-secondary to-accent-gold/20 relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent-gold/10 rounded-full blur-2xl animate-spin" />
          </div>
          <div className="absolute bottom-10 right-10 text-right">
            <p className="text-sm text-text-secondary">Myanmar Beer</p>
            <p className="text-2xl font-bold text-bg-primary">Good Beer</p>
            <p className="text-text-secondary">Better Moments</p>
          </div>
        </div>

        {/* Right: Auth card */}
        <div className="hidden md:block w-96 md:w-[380px] bg-bg-surface border border-border rounded-2xl p-8 md:p-10 mt-10 mx-auto shadow-xl">
          <h2 className="text-2xl font-bold text-bg-primary mb-4">{isLogin ? t('loginTitle') : t('registerTitle')}</h2>
          <p className="text-text-secondary mb-6">{isLogin ? t('quickLogin') : t('quickSurvey')}</p>

          {error && (
            <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-4">
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
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
            )}

            <div>
              <label className="block text-sm text-text-secondary mb-2">{t('email')}</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full px-4 py-3 bg-bg-surface border border-border rounded-xl focus:border-accent-gold focus:outline-none text-text-primary placeholder-text-muted"
                  placeholder="example@gmail.com"
                required
              />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm text-text-secondary mb-2">{t('phone')}</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-3 bg-bg-surface border border-border rounded-xl focus:border-accent-gold focus:outline-none text-text-primary placeholder-text-muted"
                  placeholder="09 123 456 789"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-text-secondary mb-2">{t('password')}</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-4 py-3 bg-bg-surface border border-border rounded-xl focus:border-accent-gold focus:outline-none text-text-primary placeholder-text-muted"
                  placeholder="••••••••"
                required
              />
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm text-text-secondary mb-2">{t('confirmPassword')}</label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className="w-full px-4 py-3 bg-bg-surface border border-border rounded-xl focus:border-accent-gold focus:outline-none text-text-primary placeholder-text-muted"
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-accent-gold text-bg-primary rounded-xl font-bold hover:bg-accent-warm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('loading') : isLogin ? t('signIn') : t('signUp')}
            </button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center">
            <span className="text-text-secondary">
              {isLogin ? t('noAccount') : t('hasAccount')}{' '}
            </span>
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-accent-gold font-medium hover:text-accent-warm transition-colors"
            >
              {isLogin ? t('signUp') : t('signIn')}
            </button>
          </div>
        </div>

        {/* Mobile full-width form */}
        <div className="md:hidden">
          <div className="bg-bg-surface border border-border rounded-2xl p-6 mb-6">
            <h2 className="text-xl font-bold text-bg-primary mb-4">{isLogin ? t('loginTitle') : t('registerTitle')}</h2>
            
            {error && (
              <div className="bg-error/10 border border-error/30 rounded-xl p-3 mb-3">
                <p className="text-error text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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
                <label className="block text-sm text-text-secondary mb-2">{t('email')}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 bg-bg-surface border border-border rounded-xl focus:border-accent-gold focus:outline-none text-text-primary placeholder-text-muted"
                  placeholder="example@gmail.com"
                  required
                />
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-sm text-text-secondary mb-2">{t('phone')}</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-3 bg-bg-surface border border-border rounded-xl focus:border-accent-gold focus:outline-none text-text-primary placeholder-text-muted"
                  placeholder="09 123 456 789"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-text-secondary mb-2">{t('password')}</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-3 bg-bg-surface border border-border rounded-xl focus:border-accent-gold focus:outline-none text-text-primary placeholder-text-muted"
                  placeholder="••••••••"
                  required
                />
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-sm text-text-secondary mb-2">{t('confirmPassword')}</label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                    className="w-full px-4 py-3 bg-bg-surface border border-border rounded-xl focus:border-accent-gold focus:outline-none text-text-primary placeholder-text-muted"
                  placeholder="••••••••"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-accent-gold text-bg-primary rounded-xl font-bold hover:bg-accent-warm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('loading') : isLogin ? t('signIn') : t('signUp')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
