'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useLanguage } from '../context/I18nProvider'
import Header from '../components/Header'
import { fetchRewardResult, getValidToken, clearIdentitySession } from '../lib/api'
import { useHydrated } from '../lib/useHydrated'

export default function RewardResultPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const hydrated = useHydrated()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<{
    hasReward: boolean
    reward: {
      winId: string
      rewardName: string
      shopId: string | null
      shopRewardId: string | null
      rewardImageUrl: string | null
      assignedAt: string
    } | null
    session?: {
      sessionId: string
      status: string
      selectedShopId: string | null
    }
  } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    getValidToken().then((token) => {
      if (cancelled) return
      if (!token) { clearIdentitySession(); router.replace('/info'); return }
      const sid = sessionStorage.getItem('survey_session_id') || sessionStorage.getItem('survey_response_id')
      if (!sid) { router.replace('/survey'); return }
      fetchRewardResult(sid).then((res) => {
        if (cancelled) return
        setResult(res)
        setLoading(false)
      })
    })
    return () => { cancelled = true }
  }, [hydrated, router])

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

  if (error) {
    return (
      <div className="min-h-screen bg-navy text-fg-bright flex flex-col items-center justify-center p-6 text-center">
        <p className="text-error mb-4">{error}</p>
        <button onClick={() => router.push('/')} className="px-6 py-3 rounded-2xl bg-gold-gradient text-brand-emerald font-bold shadow-gold">
          {t('common.back')}
        </button>
      </div>
    )
  }

  const hasReward = result?.hasReward && result?.reward
  const reward = result?.reward
  const shopName = sessionStorage.getItem('selected_shop_name') || 'Shop'
  const rewardName = reward?.rewardName || (sessionStorage.getItem('reward_name') || 'Reward')

  return (
    <div className="min-h-screen bg-navy text-fg-bright relative overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[400px] rounded-full bg-gold/[0.08] blur-[120px] animate-orb-drift" />
      <Header title="Reward Result" backHref="/" showBack={false} />

      <div className="relative mx-auto max-w-xl px-4 py-8 pb-20">
        <div className="text-center mb-8">
          <span className="inline-block px-3 py-1 rounded-full border border-gold/30 bg-gold/10 text-[10px] tracking-[0.3em] uppercase text-gold mb-3">
            Result
          </span>
          <h2 className="font-display text-3xl font-bold gold-text">
            {hasReward ? 'Congratulations!' : 'No Reward'}
          </h2>
          <p className="text-fg-secondary mt-2">
            {hasReward ? 'You won a reward from your selected shop.' : 'No reward was assigned for this shop.'}
          </p>
        </div>

        {hasReward && reward && (
          <div className="relative rounded-[1.75rem] border border-gold/30 bg-surface/95 backdrop-blur p-8 text-center overflow-hidden animate-reveal-in shadow-card mx-auto max-w-md">
            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />

            <div className="relative mx-auto mb-5 w-28 h-28 sm:w-32 sm:h-32">
              <div className="absolute inset-0 rounded-3xl bg-gold/20 blur-lg animate-celebration" />
              <div className="relative w-full h-full rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/25 to-transparent flex items-center justify-center animate-spring-pop">
                {reward.rewardImageUrl ? (
                  <Image src={reward.rewardImageUrl} alt={rewardName} width={224} height={224} className="w-full h-full object-cover rounded-3xl" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                ) : (
                  <span className="text-5xl sm:text-6xl font-bold text-gold">{rewardName.charAt(0)}</span>
                )}
              </div>
            </div>

            <p className="font-display text-xl sm:text-2xl font-bold text-white mb-1">{rewardName}</p>
            <p className="text-xs text-fg-muted mb-2">Reference: {reward.winId.slice(0, 8)}...</p>
            <p className="text-xs text-fg-muted mb-6">Shop: {shopName}</p>

            <div className="bg-surface/50 rounded-xl p-4 text-left text-sm text-fg-secondary space-y-2">
              <p><span className="font-semibold text-white">Status:</span> Reward Assigned</p>
              <p><span className="font-semibold text-white">Shop:</span> {shopName}</p>
              <p><span className="font-semibold text-white">Reward:</span> {rewardName}</p>
              <p><span className="font-semibold text-white">Assigned:</span> {new Date(reward.assignedAt).toLocaleString()}</p>
            </div>
          </div>
        )}

        {!hasReward && (
          <div className="relative rounded-[1.75rem] border border-white/10 bg-surface/95 backdrop-blur p-8 text-center overflow-hidden shadow-card mx-auto max-w-md">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-surface/50 border border-gold/30 flex items-center justify-center">
              <svg className="w-10 h-10 text-gold/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-bold text-white mb-2">No Reward Assigned</h3>
            <p className="text-fg-secondary mb-6">
              No eligible rewards were available for your selected shop at the time of selection.
            </p>
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <button
            onClick={() => router.push('/')}
            className="px-8 py-4 bg-gold-gradient text-brand-emerald rounded-2xl font-bold text-lg shadow-gold hover:shadow-gold-lg hover:scale-[1.01] transition-all inline-flex items-center justify-center gap-2"
          >
            Done
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5-5 5M6 12h12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}