'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'
import { API_BASE } from '../lib/api'

interface Reward {
  id: string
  name: string
  weight: number
  color: string
}

interface SpinResult extends Reward {
  userRewardId: string
}

interface RewardApiItem {
  id: string
  name: string
  weight: number
}

const COLORS = ['#00994B', '#163B2C', '#F0E826', '#1F4F35']
const LIGHT_TEXT = new Set(['#F0E826', '#D4AF37'])

const CONFETTI_COLORS = ['#F0E826', '#00994B', '#D4AF37', '#1F4F35', '#00A351', '#163B2C']

export default function SpinPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<SpinResult | null>(null)
  const [rotation, setRotation] = useState(0)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasSpun, setHasSpun] = useState(false)
  const wheelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    fetch(`${API_BASE}/rewards?lang=${language}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data.success && data.data.length > 0) {
          setRewards(data.data.map((r: RewardApiItem, i: number) => ({
            id: r.id,
            name: r.name,
            weight: r.weight || 10,
            color: COLORS[i % COLORS.length],
          })))
        } else {
          setRewards([])
        }
      })
      .catch(() => {
        if (cancelled) return
        setError(t('connectionFailed'))
        setRewards([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  const spin = async () => {
    if (spinning || hasSpun) return

    setSpinning(true)
    setError('')

    try {
      const token = localStorage.getItem('survey_token')
      const resolveContext = async (key: string, endpoint: string) => {
        const stored = sessionStorage.getItem(key)
        if (stored) return stored
        try {
          const ctxRes = await fetch(`${API_BASE}${endpoint}?lang=${language}`)
          const ctxData = await ctxRes.json()
          if (ctxData.success && ctxData.data && ctxData.data.length > 0) {
            return ctxData.data[0].id
          }
        } catch { /* fall through */ }
        return null
      }
      const productId = await resolveContext('survey_product_id', '/products')
      const campaignId = await resolveContext('survey_campaign_id', '/campaigns')
      const res = await fetch(`${API_BASE}/rewards/spin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          campaignId: campaignId || 'default',
          productId: productId || 'prod-1',
        })
      })
      const data = await res.json()

      if (data.success) {
        const serverReward = data.data
        const displayReward = rewards.find(r => r.id === serverReward.rewardId) || {
          id: serverReward.rewardId,
          name: serverReward.rewardName,
          weight: 10,
          color: '#00994B',
        }

        let targetIndex = 0
        for (let i = 0; i < rewards.length; i++) {
          if (rewards[i].id === serverReward.rewardId) {
            targetIndex = i
            break
          }
        }

        const segmentAngle = 360 / Math.max(rewards.length, 1)
        const targetAngle = 360 - (targetIndex * segmentAngle + segmentAngle / 2)
        const totalRotation = 360 * 5 + targetAngle

        setRotation(prev => prev + totalRotation)

        setTimeout(() => {
          setSpinning(false)
          setResult({ ...displayReward, userRewardId: serverReward.userRewardId })
          setHasSpun(true)
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('user_reward_id', serverReward.userRewardId)
            sessionStorage.setItem('reward_name', serverReward.rewardName)
          }
        }, 4000)
      } else {
        setSpinning(false)
        setError(data.error?.message || t('spinFailed'))
      }
    } catch {
      setSpinning(false)
      setError(t('connectionFailed'))
    }
  }

  const handleClaim = () => {
    router.push('/delivery')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-navy flex flex-col items-center justify-center p-4">
        <div className="relative mb-6 animate-pop">
          <div className="absolute -inset-3 rounded-full border border-gold/30 animate-spin-slow" />
          <div className="w-16 h-16 rounded-full gold-border bg-brand-emerald overflow-hidden p-0.5">
            <img src="/logo.png" alt="MB" className="w-full h-full object-cover rounded-full" />
          </div>
        </div>
        <div className="h-2 w-40 rounded-full shimmer-bg" />
        <p className="text-sm text-fg-muted mt-4">{t('loading')}</p>
      </div>
    )
  }

  const lightText = (color: string) => LIGHT_TEXT.has(color) ? 'text-brand-emerald' : 'text-white'

  return (
    <div className="min-h-screen bg-navy text-fg-bright relative overflow-hidden">
      {/* ambient */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[400px] rounded-full bg-gold/[0.08] blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[360px] h-[360px] rounded-full bg-brand-emeraldLight/50 blur-[110px]" />

      <Header title={t('spinTitle')} backHref="/survey" />

      <div className="relative mx-auto max-w-xl px-4 py-8 pb-20">
        {/* ---------- title ---------- */}
        <div className="text-center mb-7">
          <span className="inline-block px-3 py-1 rounded-full border border-gold/30 bg-gold/10 text-[10px] tracking-[0.3em] uppercase text-gold mb-3">04 · Lucky Spin</span>
          <h2 className="font-display text-3xl font-bold gold-text">{t('spinTitle')}</h2>
          <p className="text-fg-secondary mt-2">{t('spinDesc')}</p>
        </div>

        {error && (
          <div className="mb-5 bg-error/10 border border-error/30 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-error mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        {/* ---------- reward legend ---------- */}
        {rewards.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            {rewards.map(reward => (
              <span key={reward.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-xs text-fg-secondary">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: reward.color }} />
                {reward.name}
              </span>
            ))}
          </div>
        )}

        {/* ---------- wheel ---------- */}
        {rewards.length > 0 && (
          <div className="relative w-80 h-80 mx-auto mb-9">
            {/* glow */}
            <div className={`absolute -inset-4 rounded-full bg-gold/25 blur-2xl animate-pulse-gold ${spinning || result ? '' : 'opacity-70'}`} />

            {/* pointer */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
              <div className="w-0 h-0 border-l-[18px] border-r-[18px] border-t-[30px] border-l-transparent border-r-transparent border-t-gold drop-shadow-lg" />
            </div>

            {/* rim */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-warm via-gold to-[#8a6d1c] p-[5px] shadow-gold-lg">
              <div className="w-full h-full rounded-full bg-navy-deep relative overflow-hidden">
                {/* rotating face */}
                <div
                  ref={wheelRef}
                  className="absolute inset-0 transition-transform ease-out"
                  style={{ transform: `rotate(${rotation}deg)`, transitionDuration: '4000ms' }}
                >
                  {rewards.map((reward, index) => {
                    const segmentAngle = 360 / Math.max(rewards.length, 1)
                    const startAngle = index * segmentAngle
                    const mid = startAngle + segmentAngle / 2
                    return (
                      <div
                        key={reward.id}
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((startAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((startAngle + segmentAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle + segmentAngle - 90) * Math.PI / 180)}%)`,
                          backgroundColor: reward.color,
                        }}
                      >
                        <span
                          className={`text-[11px] font-bold whitespace-nowrap drop-shadow ${lightText(reward.color)}`}
                          style={{
                            transform: `rotate(${-rotation - 90 + mid}deg) translateY(-42px)`,
                            transition: 'transform 4000ms',
                          }}
                        >
                          {reward.name}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* inner separator ring */}
                <div className="absolute inset-3 rounded-full border border-white/15 pointer-events-none" />
                <div className="absolute inset-14 rounded-full border border-white/10 pointer-events-none" />
              </div>
            </div>

            {/* center hub */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="w-[74px] h-[74px] rounded-full p-[3px] bg-gradient-to-br from-warm via-gold to-[#8a6d1c] shadow-gold-lg">
                <div className="w-full h-full rounded-full bg-brand-emerald overflow-hidden flex items-center justify-center">
                  <img src="/logo.png" alt="MB" className="w-full h-full object-cover rounded-full" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------- spin button / result ---------- */}
        {result ? (
          <div className="relative rounded-[1.75rem] border border-gold/30 bg-surface/95 backdrop-blur p-8 text-center overflow-hidden animate-reveal-in shadow-card mx-auto max-w-md">
            {/* confetti */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 18 }).map((_, i) => (
                <span
                  key={i}
                  className="confetti-piece"
                  style={{
                    left: `${(i * 137) % 100}%`,
                    width: i % 3 === 0 ? 6 : 4,
                    height: i % 2 === 0 ? 10 : 8,
                    backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                    animationDuration: `${2.5 + (i % 5) * 0.6}s`,
                    animationDelay: `${(i % 7) * 0.2}s`,
                  }}
                />
              ))}
            </div>

            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />

            <span className="inline-block px-3 py-1 rounded-full border border-gold/30 bg-gold/10 text-[10px] tracking-[0.3em] uppercase text-gold mb-4">05 · Reward</span>
            <h3 className="font-display text-3xl font-bold gold-text mb-2 animate-pop">{t('congratulations')}</h3>
            <p className="text-fg-secondary mb-5">{t('youWon')}</p>

            <div className="relative mx-auto mb-5 w-24 h-24">
              <div className="absolute inset-0 rounded-3xl bg-gold/20 blur-lg" />
              <div className="relative w-24 h-24 rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/25 to-transparent flex items-center justify-center">
                <span className="text-4xl" style={{ color: result.color }}>{result.name.charAt(0)}</span>
              </div>
            </div>

            <p className="font-display text-xl font-bold text-white mb-1">{result.name}</p>
            <p className="text-xs text-fg-muted mb-7">{t('rewardAdded')}</p>

            <button
              onClick={handleClaim}
              className="w-full py-4 bg-gold-gradient text-brand-emerald rounded-2xl font-bold text-lg shadow-gold hover:shadow-gold-lg hover:scale-[1.01] transition-all inline-flex items-center justify-center gap-2"
            >
              {t('claimReward')}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={spin}
            disabled={spinning || hasSpun || rewards.length === 0}
            className={`group w-full py-5 rounded-2xl font-display font-bold text-xl transition-all ${
              spinning || hasSpun || rewards.length === 0
                ? 'bg-white/[0.05] text-fg-muted cursor-not-allowed border border-white/10'
                : 'bg-gold-gradient text-brand-emerald shadow-gold-lg hover:scale-[1.02] hover:shadow-gold inline-flex items-center justify-center gap-3'
            }`}
          >
            {spinning ? (
              <>
                <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t('spinning')}
              </>
            ) : hasSpun ? (
              t('alreadySpun')
            ) : (
              <>
                {t('spinButton')}
                <svg className="w-6 h-6 group-hover:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}