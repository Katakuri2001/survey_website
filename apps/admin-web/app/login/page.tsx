'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

import { API_BASE } from '../lib/api'

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/auth/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()

      if (data.success) {
        localStorage.setItem('admin_token', data.data.token)
        router.push('/dashboard')
      } else {
        setError(data.error?.message || 'Login failed')
      }
    } catch {
      setError('Connection failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-surface-canvas">
      {/* Brand panel (hidden on mobile) */}
      <div className="relative hidden w-[55%] overflow-hidden bg-forest text-white lg:flex lg:flex-col lg:justify-between">
        {/* Radial gold glows */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-gold/20 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-[28rem] w-[28rem] rounded-full bg-gold/15 blur-[130px]" />
        <div className="pointer-events-none absolute bottom-24 right-24 h-64 w-64 rounded-full bg-warm/10 blur-[90px]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, #E2C97F 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative z-10 flex items-center gap-3 px-12 pt-10">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-2 ring-gold ring-offset-2 ring-offset-forest">
            <Image src="/myanmarbeerstout.png" alt="Myanmar Beer" width={48} height={48} className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="font-display text-lg font-bold leading-tight text-white">Myanmar Beer</p>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold-300">Family of Brands</p>
          </div>
        </div>

        <div className="relative z-10 px-12 pb-24 lg:pt-24">
          <h2 className="font-display max-w-md text-4xl font-bold leading-tight text-white">
            Premium survey intelligence for{' '}
            <span className="text-warm">Myanmar&apos;s most beloved brands</span>.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75">
            Monitor participation, rewards, deliveries and product sentiment from a single
            elegant command center — built for the Myanmar Beer family.
          </p>
          <div className="mt-10 flex items-center gap-4">
            <div className="h-px w-10 bg-gold" />
            <p className="text-xs font-medium tracking-[0.2em] text-gold-300 uppercase">Since 1994</p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-card ring-2 ring-gold">
              <Image src="/myanmarbeerstout.png" alt="MB" width={64} height={64} className="h-full w-full object-cover" />
            </div>
            <h1 className="font-display text-2xl font-bold text-ink">Myanmar Beer Admin</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in to manage your survey platform</p>
          </div>

          <div className="hidden text-center lg:mb-8 lg:block">
            <h1 className="font-display text-3xl font-bold text-ink">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in to manage your survey platform</p>
          </div>

          <div className="card animate-fade-up rounded-3xl p-8 shadow-xl">
            {error && (
              <div className="mb-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="admin@myanmarbeer.com"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="Enter password"
                  required
                />
              </div>

              <button type="submit" disabled={loading} className="btn-gold w-full py-3 shadow-gold">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-400">
              Demo access · <span className="font-medium text-gold-600">admin@myanmarbeer.com</span>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400 lg:hidden">
            © {new Date().getFullYear()} Myanmar Beer · Family of Brands
          </p>
        </div>
      </div>
    </div>
  )
}