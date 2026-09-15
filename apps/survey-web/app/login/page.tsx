'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'
import { API_BASE } from '../lib/api'

const inputClass =
  'w-full px-4 py-3.5 bg-surface-deep border border-border rounded-2xl text-fg-bright placeholder-fg-muted focus:border-gold focus:ring-2 focus:ring-gold/30 focus:outline-none transition-all'

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-fg-secondary mb-2">{children}</label>
}

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
    <div className="min-h-screen bg-navy text-fg-bright">
      <Header title={isLogin ? t('loginTitle') : t('registerTitle')} backHref="/" />

      <div className="relative">
        {/* ambient glows */}
        <div className="pointer-events-none absolute -top-20 right-0 w-[380px] h-[380px] rounded-full bg-gold/10 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 -left-24 w-[360px] h-[360px] rounded-full bg-brand-emeraldLight/40 blur-[110px]" />

        <div className="relative mx-auto grid max-w-5xl gap-8 p-4 md:p-8 md:grid-cols-2 md:items-center min-h-[calc(100vh-120px)]">
          {/* ---------- Brand panel (desktop) ---------- */}
          <div className="hidden md:flex relative overflow-hidden rounded-[2rem] bg-emerald-gradient border border-white/10 min-h-[560px] flex-col items-center justify-center p-10 text-center shadow-card">
            <div className="absolute inset-0 bg-hero-glow" />
            <div className="absolute top-10 left-10 w-24 h-24 rounded-full bg-gold/15 blur-2xl animate-float" />
            <div className="absolute bottom-12 right-10 w-32 h-32 rounded-full bg-gold/10 blur-3xl" />
            {/* gold arc */}
            <svg className="absolute top-8 right-8 w-20 h-20 text-gold/40 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeWidth={1} d="M12 3a9 9 0 100 18 9 9 0 000-18m0 4v5m0 0l3.5 3.5" />
            </svg>

            <div className="relative z-10">
              <div className="relative w-28 h-28 mx-auto mb-8 animate-pop">
                <div className="absolute -inset-3 rounded-full border border-gold/30 animate-spin-slow" />
                <div className="w-28 h-28 rounded-full gold-ring bg-brand-emerald overflow-hidden p-1">
                  <img src="/logo.png" alt="MB" className="w-full h-full object-cover rounded-full" />
                </div>
              </div>
              <h2 className="font-display text-4xl font-bold text-white leading-tight">
                {t('heroTitleLine1')}
                <span className="block gold-text mt-1">{t('heroTitleLine2')}</span>
              </h2>
              <div className="mx-auto my-6 h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent" />
              <p className="font-myanmar text-fg-secondary max-w-xs mx-auto">{t('heroDesc')}</p>
            </div>
          </div>

          {/* ---------- Auth card ---------- */}
          <div className="w-full">
            <div className="relative rounded-[1.75rem] border border-white/[0.08] bg-surface/90 backdrop-blur p-6 md:p-10 shadow-card animate-fade-up">
              {/* gold top edge */}
              <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />

              <div className="flex items-center gap-3 mb-7 md:hidden">
                <span className="w-10 h-10 rounded-full gold-border bg-brand-emerald overflow-hidden p-0.5">
                  <img src="/logo.png" alt="MB" className="w-full h-full object-cover rounded-full" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold gold-text">{isLogin ? t('loginTitle') : t('registerTitle')}</h2>
                  <p className="text-xs text-fg-muted">{t('heroTitleLine1')} · {t('heroTitleLine2')}</p>
                </div>
              </div>

              <h2 className="hidden md:block font-display text-3xl font-bold text-white mb-2">{isLogin ? t('loginTitle') : t('registerTitle')}</h2>
              <p className="hidden md:block text-fg-muted mb-8">{isLogin ? t('quickLogin') : t('quickSurvey')}</p>

              {error && (
                <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-5 flex items-start gap-3">
                  <svg className="w-5 h-5 text-error mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-error text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                  <div>
                    <FieldLabel>{t('fullName')}</FieldLabel>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className={inputClass}
                      placeholder={t('fullNamePlaceholder')}
                      required
                    />
                  </div>
                )}

                <div>
                  <FieldLabel>{t('email')}</FieldLabel>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={inputClass}
                    placeholder="example@gmail.com"
                    required
                  />
                </div>

                {!isLogin && (
                  <div>
                    <FieldLabel>{t('phone')}</FieldLabel>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className={inputClass}
                      placeholder="09 123 456 789"
                    />
                  </div>
                )}

                <div>
                  <FieldLabel>{t('password')}</FieldLabel>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={inputClass}
                    placeholder="••••••••"
                    required
                  />
                </div>

                {!isLogin && (
                  <div>
                    <FieldLabel>{t('confirmPassword')}</FieldLabel>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className={inputClass}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gold-gradient text-brand-emerald rounded-2xl font-bold text-lg shadow-gold hover:shadow-gold-lg hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? t('loading') : isLogin ? t('signIn') : t('signUp')}
                </button>
              </form>

              <div className="mt-7 pt-6 border-t border-white/10 text-center">
                <span className="text-fg-muted text-sm">
                  {isLogin ? t('noAccount') : t('hasAccount')}{' '}
                </span>
                <button
                  onClick={() => { setIsLogin(!isLogin); setError(''); }}
                  className="text-gold font-semibold hover:text-warm transition-colors"
                >
                  {isLogin ? t('signUp') : t('signIn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}