'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useLanguage } from '../context/I18nProvider'
import Header from '../components/Header'
import {
  API_BASE,
  clearIdentitySession,
  fetchShops,
  getValidToken,
  markResumeTokenRecovery,
  selectShopForSession,
} from '../lib/api'
import { useHydrated } from '../lib/useHydrated'
import type { Shop } from '../lib/api'

const DRAFT_KEY = 'survey_shop_select_draft'

export default function ShopSelectPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const hydrated = useHydrated()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    getValidToken().then((token) => {
      if (cancelled) return
      if (!token) {
        clearIdentitySession()
        router.replace('/info')
        return
      }
      const sid = sessionStorage.getItem('survey_session_id') || sessionStorage.getItem('survey_response_id')
      if (!sid) {
        router.replace('/survey')
        return
      }
      setSessionId(sid)
      fetchShops(language).then((data) => {
        if (cancelled) return
        setShops(data)
        setLoading(false)
      })
    })
    return () => { cancelled = true }
  }, [hydrated, language, router])

  const filteredShops = shops.filter((shop) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      shop.name.toLowerCase().includes(q) ||
      (shop.description || '').toLowerCase().includes(q) ||
      (shop.address || '').toLowerCase().includes(q)
    )
  })

  const handleSelectShop = async (shop: Shop) => {
    if (!sessionId || submitting) return
    setSelectedShopId(shop.id)
    setSubmitting(true)
    setError('')
    const result = await selectShopForSession(sessionId, shop.id)
    if (result.success) {
      // Store selected shop info for display
      try {
        sessionStorage.setItem('selected_shop_id', shop.id)
        sessionStorage.setItem('selected_shop_name', shop.name)
      } catch { /* ignore */ }
      router.push('/reward-select')
    } else {
      setError(result.error || t('common.error'))
      setSubmitting(false)
      setSelectedShopId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-navy flex flex-col items-center justify-center p-4">
        <div className="relative mb-6 animate-pop">
          <div className="absolute -inset-3 rounded-full border border-gold/30 animate-spin-slow" />
          <div className="w-16 h-16 rounded-full gold-border bg-brand-emerald overflow-hidden p-0.5">
            <Image src="/myanmarbeerstout.png" alt="MB" width={64} height={64} className="w-full h-full object-cover rounded-full" />
          </div>
        </div>
        <div className="h-2 w-40 rounded-full shimmer-bg" />
        <p className="text-sm text-fg-muted mt-4">{t('common.loading')}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy text-fg-bright">
      <Header title={t('shopSelect.title', 'Select Shop')} backHref="/survey" />

      <div className="relative mx-auto max-w-xl px-4 py-6">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[420px] h-[260px] rounded-full bg-gold/[0.06] blur-[110px]" />

        {/* Title */}
        <div className="relative text-center mb-6">
          <span className="inline-block px-3 py-1 rounded-full border border-gold/30 bg-gold/10 text-[10px] tracking-[0.3em] uppercase text-gold mb-3">
            03 · Shop Selection
          </span>
          <h2 className="font-display text-2xl font-bold gold-text">{t('shopSelect.title', 'Select Shop')}</h2>
          <p className="text-fg-secondary mt-2 text-sm">{t('shopSelect.desc', 'Choose a shop to continue')}</p>
        </div>

        {/* Search */}
        {shops.length > 8 && (
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('shopSelect.searchPlaceholder', 'Search shops...')}
              className="survey-input w-full"
            />
          </div>
        )}

        {error && (
          <div className="mb-4 bg-error/10 border border-error/30 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-error mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        {/* Shop list */}
        {filteredShops.length === 0 ? (
          <div className="card p-12 text-center text-slate-500">
            <p>{t('shopSelect.noShops', 'No shops available')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredShops.map((shop) => {
              const isSelected = selectedShopId === shop.id
              const isSubmitting = submitting && isSelected
              return (
                <button
                  key={shop.id}
                  type="button"
                  onClick={() => handleSelectShop(shop)}
                  disabled={submitting}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${
                    isSelected
                      ? 'border-gold/40 bg-gold/10 shadow-gold'
                      : 'border-white/[0.08] bg-surface/90 hover:border-gold/30 hover:bg-surface'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-4">
                    {shop.logoUrl ? (
                      <Image
                        src={shop.logoUrl}
                        alt={shop.name}
                        width={56}
                        height={56}
                        className="w-14 h-14 rounded-xl object-cover ring-1 ring-white/10 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
                        <span className="text-xl font-bold text-gold">{shop.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-white truncate">{shop.name}</p>
                      {shop.address && (
                        <p className="text-xs text-fg-muted truncate mt-0.5">{shop.address}</p>
                      )}
                      {shop.description && (
                        <p className="text-xs text-fg-secondary truncate mt-1">{shop.description}</p>
                      )}
                    </div>
                    {isSubmitting ? (
                      <div className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin shrink-0" />
                    ) : (
                      <svg className="w-5 h-5 text-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <p className="text-xs text-fg-muted text-center mt-6">
          {shops.length} {t('shopSelect.shopsAvailable', 'shops available')}
        </p>
      </div>
    </div>
  )
}