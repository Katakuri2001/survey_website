'use client'

import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'

const API_BASE = 'http://localhost:8787'

export default function LoginPage() {
  const { t, language } = useLanguage()
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
        window.location.href = '/info'
      } else {
        setError(data.error?.message || t('error'))
      }
    } catch (err) {
      setError(t('connectionFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    // For demo, create a quick guest user
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Guest User',
          email: `guest_${Date.now()}@example.com`,
          password: 'guest123',
        })
      })
      const data = await res.json()

      if (data.success) {
        localStorage.setItem('survey_token', data.data.token)
        localStorage.setItem('survey_user', JSON.stringify(data.data.user))
        window.location.href = '/info'
      }
    } catch (err) {
      setError(t('connectionFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-800 text-white">
      <Header title={isLogin ? t('loginTitle') : t('registerTitle')} backHref="/" />
      
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-4 bg-white text-gray-800 rounded-xl font-medium hover:bg-gray-100 transition-all flex items-center justify-center gap-3 mb-6 disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {t('loginWithGmail')}
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-white/20" />
          <span className="text-sm text-blue-200">{t('orContinueWith')}</span>
          <div className="flex-1 h-px bg-white/20" />
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-sm text-red-200 mb-4">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          {!isLogin && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-blue-200 mb-2">{t('fullName')}</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-yellow-400 focus:outline-none text-white placeholder-blue-300"
                placeholder={t('fullNamePlaceholder')}
                required={!isLogin}
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-blue-200 mb-2">{t('email')}</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-yellow-400 focus:outline-none text-white placeholder-blue-300"
              placeholder="example@gmail.com"
              required
            />
          </div>

          {!isLogin && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-blue-200 mb-2">{t('phone')}</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-yellow-400 focus:outline-none text-white placeholder-blue-300"
                placeholder="09 123 456 789"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-blue-200 mb-2">{t('password')}</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-yellow-400 focus:outline-none text-white placeholder-blue-300"
              placeholder="••••••••"
              required
            />
          </div>

          {!isLogin && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-blue-200 mb-2">{t('confirmPassword')}</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-yellow-400 focus:outline-none text-white placeholder-blue-300"
                placeholder="••••••••"
                required={!isLogin}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-yellow-500 text-blue-900 rounded-xl font-bold hover:bg-yellow-400 transition-all disabled:opacity-50"
          >
            {loading ? t('loading') : isLogin ? t('signIn') : t('signUp')}
          </button>
        </form>

        {/* Toggle */}
        <div className="mt-6 text-center">
          <span className="text-blue-200">
            {isLogin ? t('noAccount') : t('hasAccount')}{' '}
          </span>
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-yellow-400 font-medium hover:text-yellow-300"
          >
            {isLogin ? t('signUp') : t('signIn')}
          </button>
        </div>
      </div>
    </div>
  )
}