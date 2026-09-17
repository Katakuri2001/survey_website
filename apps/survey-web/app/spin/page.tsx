'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'
import { API_BASE, getValidToken } from '../lib/api'
import Image from 'next/image'

interface Reward {
  id: string
  name: string
  weight: number
  color: string
  imageUrl?: string
  remainingQuantity: number
  status: string
}

interface RewardApiItem {
  id: string
  name: string
  weight: number
  winning_ratio?: number
  remaining_quantity: number
  status: string
  image_url?: string
  low_stock_threshold: number
}

const SEGMENT_COLORS = [
  '#082D1B', // Primary Emerald
  '#1E293B', // Surface
  '#0F172A', // Background
  '#163B2C', // Brand Emerald
  '#00994B', // Green
  '#1F4F35', // Emerald Light
]

const CONFETTI_COLORS = ['#F5C542', '#D4AF37', '#F0E826', '#00994B', '#F59E0B', '#22C55E']

export default function SpinPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<{ reward: Reward; userRewardId: string } | null>(null)
  const [rotation, setRotation] = useState(0)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasSpun, setHasSpun] = useState(false)
  const [wheelRotation, ____setWheelRotation] = useState(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
    return false
  })
  const animationRef = useRef<number | null>(null)
  const wheelRef = useRef<HTMLDivElement>(null)
  const mediaQueryRef = useRef<MediaQueryList | null>(null)

  // Generate consistent colors for rewards based on index
  const getRewardColor = (index: number) => SEGMENT_COLORS[index % SEGMENT_COLORS.length]

  // Fetch available rewards
  const fetchRewards = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/rewards?lang=${language}`)
      const data = await res.json()
      if (data.success && data.data.length > 0) {
        const mappedRewards: Reward[] = data.data.map((r: RewardApiItem, i: number) => ({
          id: r.id,
          name: r.name,
          weight: r.weight || 10,
          color: getRewardColor(i),
          imageUrl: r.image_url,
          remainingQuantity: r.remaining_quantity,
          status: r.status,
        }))
        setRewards(mappedRewards)
      } else {
        setRewards([])
      }
    } catch {
      setError(t('connectionFailed'))
      setRewards([])
    } finally {
      setLoading(false)
    }
  }, [language, t])

  // Check existing spin
  const checkExistingSpin = useCallback(async () => {
    try {
      const token = await getValidToken()
      if (!token) return

      const res = await fetch(`${API_BASE}/rewards/my`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success && data.data.length > 0) {
        // User has won rewards - check if it's for this campaign
        const latestReward = data.data[0]
        if (latestReward.reward_id) {
          // Find the reward in our local rewards
          const reward = rewards.find(r => r.id === latestReward.reward_id)
          if (reward) {
            setResult({ reward, userRewardId: latestReward.id })
            setHasSpun(true)
            // Set rotation to show the correct segment
            const targetIndex = rewards.findIndex(r => r.id === latestReward.reward_id)
            if (targetIndex !== -1) {
              const segmentAngle = 360 / rewards.length
              const targetAngle = -(targetIndex * segmentAngle + segmentAngle / 2) - 90
              const fullRotations = 5 * 360
              setRotation(fullRotations + targetAngle)
            }
          }
        }
      }
    } catch {
      // Ignore - user hasn't spun yet
    }
  }, [rewards])

  // Set up reduced motion listener on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      mediaQueryRef.current = mediaQuery
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
      mediaQuery.addEventListener('change', handler)
      return () => mediaQuery.removeEventListener('change', handler)
    }
  }, [])

  // Fetch rewards and check existing spin on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRewards()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkExistingSpin()
  }, [fetchRewards, checkExistingSpin])

  // Generate idempotency key for this spin session
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  // Premium spin animation using Web Animations API
  const animateWheel = useCallback((
    targetRotation: number,
    duration: number = 4500
  ): Promise<void> => {
    return new Promise((resolve) => {
      const wheel = wheelRef.current
      if (!wheel) {
        resolve()
        return
      }

      // Cancel any existing animation
      if (animationRef.current) {
        wheel.getAnimations().forEach(anim => anim.cancel())
      }

      const startRotation = rotation
      const totalRotation = targetRotation

      // Reduced motion: simple quick rotation
      if (prefersReducedMotion) {
        wheel.style.transform = `rotate(${startRotation + totalRotation}deg)`
        setRotation(startRotation + totalRotation)
        setTimeout(resolve, 300)
        return
      }

      // Custom easing: fast start, gradual slowdown with overshoot correction
      // This creates a physically realistic deceleration
      const keyframes = [
        { transform: `rotate(${startRotation}deg)`, offset: 0, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
        { transform: `rotate(${startRotation + totalRotation * 0.15}deg)`, offset: 0.1, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
        { transform: `rotate(${startRotation + totalRotation * 0.45}deg)`, offset: 0.3, easing: 'cubic-bezier(0.33, 0.66, 0.66, 1)' },
        { transform: `rotate(${startRotation + totalRotation * 0.7}deg)`, offset: 0.55, easing: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)' },
        { transform: `rotate(${startRotation + totalRotation * 0.88}deg)`, offset: 0.75, easing: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)' },
        { transform: `rotate(${startRotation + totalRotation * 0.96}deg)`, offset: 0.9, easing: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)' },
        { transform: `rotate(${startRotation + totalRotation}deg)`, offset: 1, easing: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)' },
      ]

      const animation = wheel.animate(keyframes, {
        duration,
        fill: 'forwards',
        easing: 'linear',
      })

      animationRef.current = animation.id as unknown as number

      animation.onfinish = () => {
        setRotation(startRotation + totalRotation)
        animationRef.current = null
        resolve()
      }

      animation.oncancel = () => {
        animationRef.current = null
        resolve()
      }
    })
  }, [rotation, prefersReducedMotion])

  // Gentle pointer bounce animation
  const triggerPointerBounce = useCallback(() => {
    if (prefersReducedMotion) return
    const pointer = document.querySelector('.spin-pointer')
    if (pointer) {
      pointer.animate(
        [
          { transform: 'translateX(-50%) rotate(0deg)', offset: 0 },
          { transform: 'translateX(-50%) rotate(-3deg)', offset: 0.15 },
          { transform: 'translateX(-50%) rotate(2deg)', offset: 0.3 },
          { transform: 'translateX(-50%) rotate(-1deg)', offset: 0.45 },
          { transform: 'translateX(-50%) rotate(0deg)', offset: 0.6 },
        ],
        { duration: 600, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
      )
    }
  }, [prefersReducedMotion])

  const spin = async () => {
    if (spinning || hasSpun || rewards.length === 0) return

    setSpinning(true)
    setError('')

    try {
      const token = await getValidToken()
      if (!token) {
        setSpinning(false)
        setError(t('failedToLoad'))
        return
      }

      // Get context IDs
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

      const doSpin = async (authToken: string) => {
        const res = await fetch(`${API_BASE}/rewards/spin`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            campaignId: campaignId || 'default',
            productId: productId || 'beer',
            idempotencyKey,
          }),
        })
        return res.json()
      }

      let data = await doSpin(token)

      // Token refresh on expiry
      if (!data.success && (data.error?.message === 'Invalid token' || data.error?.message === 'Unauthorized')) {
        const refreshed = await getValidToken(true)
        if (refreshed) data = await doSpin(refreshed)
      }

      if (data.success) {
        const serverReward = data.data
        const targetIndex = rewards.findIndex(r => r.id === serverReward.rewardId)

        if (targetIndex === -1) {
          throw new Error('Reward not found in local rewards')
        }

        const displayReward = rewards[targetIndex]

        // Calculate target angle
        const segmentAngle = 360 / rewards.length
        // Pointer is at top (0deg / -90deg in CSS), so we need to align segment center to pointer
        // Segment center is at: targetIndex * segmentAngle + segmentAngle/2
        // We want this center to land at -90deg (top)
        const targetAngle = -(targetIndex * segmentAngle + segmentAngle / 2) - 90

        // Add 5 full rotations + target angle
        const fullRotations = 5 * 360
        const totalRotation = fullRotations + targetAngle

        // Animate the wheel
        await animateWheel(totalRotation)

        // Trigger pointer bounce
        triggerPointerBounce()

        // Small delay for settling feel
        await new Promise(r => setTimeout(r, 300))

        setSpinning(false)
        setResult({ reward: displayReward, userRewardId: serverReward.userRewardId })
        setHasSpun(true)

        if (typeof window !== 'undefined') {
          sessionStorage.setItem('user_reward_id', serverReward.userRewardId)
          sessionStorage.setItem('reward_name', serverReward.rewardName)
        }
      } else {
        setSpinning(false)
        const errorCode = data.error?.code
        if (errorCode === 'NO_REWARDS_AVAILABLE') {
          setError(t('noRewardsDesc'))
        } else {
          setError(data.error?.message || t('spinFailed'))
        }
      }
    } catch {
      setSpinning(false)
      setError(t('connectionFailed'))
    }
  }

  const handleDone = () => {
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-navy flex flex-col items-center justify-center p-4">
        <div className="relative mb-6 animate-pop">
          <div className="absolute -inset-3 rounded-full border border-gold/30 animate-spin-slow" />
          <div className="w-16 h-16 rounded-full gold-border bg-brand-emerald overflow-hidden p-0.5">
            <Image src="/logo.png" alt="MB" width={64} height={64} className="w-full h-full object-cover rounded-full" />
          </div>
        </div>
        <div className="h-2 w-40 rounded-full shimmer-bg" />
        <p className="text-sm text-fg-muted mt-4">{t('loading')}</p>
      </div>
    )
  }

  // Empty state - no rewards available
  if (rewards.length === 0) {
    return (
      <div className="min-h-screen bg-navy text-fg-bright relative overflow-hidden flex items-center justify-center p-4">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[400px] rounded-full bg-gold/[0.08] blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 w-[360px] h-[360px] rounded-full bg-brand-emeraldLight/50 blur-[110px]" />

        <Header title={t('spinTitle')} backHref="/survey" />

        <div className="relative mx-auto max-w-xl px-4 py-8 pb-20 text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-surface/50 border border-gold/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-gold/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold gold-text mb-3">{t('noRewardsTitle')}</h2>
          <p className="text-fg-secondary mb-6 max-w-md mx-auto">{t('noRewardsDesc')}</p>
          <button
            onClick={fetchRewards}
            className="px-6 py-3 bg-gold-gradient text-brand-emerald rounded-2xl font-bold shadow-gold hover:shadow-gold-lg transition-all"
          >
            {t('tryAgain')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy text-fg-bright relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[400px] rounded-full bg-gold/[0.08] blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[360px] h-[360px] rounded-full bg-brand-emeraldLight/50 blur-[110px]" />

      <Header title={t('spinTitle')} backHref="/survey" />

      <div className="relative mx-auto max-w-xl px-4 py-8 pb-20">
        {/* Title section */}
        <div className="text-center mb-7">
          <span className="inline-block px-3 py-1 rounded-full border border-gold/30 bg-gold/10 text-[10px] tracking-[0.3em] uppercase text-gold mb-3">04 · Lucky Spin</span>
          <h2 className="font-display text-3xl font-bold gold-text">{t('spinTitle')}</h2>
          <p className="text-fg-secondary mt-2">{t('spinDesc')}</p>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-5 bg-error/10 border border-error/30 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
            <svg className="w-5 h-5 text-error mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        {/* Reward legend */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          {rewards.map((reward, _index) => (
            <span
              key={reward.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-xs text-fg-secondary transition-all"
              style={{ borderColor: `${reward.color}80` }}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: reward.color }} />
              {reward.name}
            </span>
          ))}
        </div>

        {/* Wheel Container */}
        <div className="relative w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-96 mx-auto mb-9">
          {/* Outer glow ring */}
          <div className={`absolute -inset-4 rounded-full bg-gold/25 blur-2xl animate-pulse-gold ${spinning || result ? 'opacity-100' : 'opacity-70'}`} />

          {/* Pointer/Indicator - Fixed at top */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center spin-pointer">
            <div className="relative">
              {/* Pointer triangle */}
              <div className="w-0 h-0 border-l-[18px] border-r-[18px] border-b-[30px] border-l-transparent border-r-transparent border-b-gold drop-shadow-lg" />
              {/* Pointer base circle */}
              <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gold-gradient border-2 border-navy-deep shadow-gold" />
            </div>
          </div>

          {/* Wheel Rim & Face */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-warm via-gold to-[#8a6d1c] p-[5px] shadow-gold-lg">
            <div className="w-full h-full rounded-full bg-navy-deep relative overflow-hidden">
              {/* Rotating wheel face */}
              <div
                ref={wheelRef}
                className="absolute inset-0"
                style={{ transform: `rotate(${wheelRotation}deg)` }}
              >
                {rewards.map((reward, _index) => {
                  const segmentAngle = 360 / rewards.length
                  const startAngle = _index * segmentAngle
                  const midAngle = startAngle + segmentAngle / 2

                  return (
                    <div
                      key={reward.id}
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((startAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((startAngle + segmentAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle + segmentAngle - 90) * Math.PI / 180)}%)`,
                        backgroundColor: reward.color,
                      }}
                    >
                      {/* Segment background pattern */}
                      <div
                        className="absolute inset-0 opacity-10"
                        style={{
                          backgroundImage: 'radial-gradient(circle at 50% 0%, transparent 40%, currentColor 40%)',
                          backgroundSize: '20px 20px',
                        }}
                      />

                      {/* Reward label - positioned at segment center, counter-rotated */}
                      <div
                        className="relative z-10 flex items-center justify-center pointer-events-none"
                        style={{
                          transform: `rotate(${-wheelRotation - 90 + midAngle}deg) translateY(-112px)`,
                        }}
                      >
                        <span
                          className="inline-block max-w-[80px] sm:max-w-[92px] px-2 py-1.5 rounded-lg text-center text-[10px] sm:text-xs font-bold leading-snug text-white bg-navy/85 border border-white/15 shadow-lg backdrop-blur-[2px] whitespace-nowrap truncate"
                        >
                          {reward.name}
                        </span>
                      </div>
                    </div>
                  )
                })}

                {/* Wedge boundary spokes */}
                {rewards.map((_, index) => {
                  const segmentAngle = 360 / rewards.length
                  return (
                    <div
                      key={`spoke-${index}`}
                      className="absolute left-1/2 top-1/2 h-1/2 w-[2px] origin-top bg-white/25 pointer-events-none"
                      style={{ transform: `rotate(${index * segmentAngle - 90}deg)` }}
                    />
                  )
                })}

                {/* Inner decorative rings */}
                <div className="absolute inset-3 rounded-full border border-white/15 pointer-events-none" />
                <div className="absolute inset-14 rounded-full border border-white/10 pointer-events-none" />
              </div>

              {/* Center hub */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="w-[74px] h-[74px] rounded-full p-[3px] bg-gradient-to-br from-warm via-gold to-[#8a6d1c] shadow-gold-lg animate-pulse-gold">
                  <div className="w-full h-full rounded-full bg-brand-emerald overflow-hidden flex items-center justify-center">
                    <Image src="/logo.png" alt="MB" width={74} height={74} className="w-full h-full object-cover rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Winner highlight overlay (shown after spin) */}
          {result && (
            <div
              className="absolute inset-0 rounded-full pointer-events-none z-20 animate-pop"
              style={{
                transform: `rotate(${rotation}deg)`,
              }}
            >
              <div
                className="absolute left-1/2 top-4 w-[2px] h-1/4 origin-top bg-gold/60"
                style={{
                  transform: `rotate(${180 - rotation}deg)`,
                  boxShadow: '0 0 12px 2px rgba(245, 197, 66, 0.8)',
                }}
              />
            </div>
          )}
        </div>

        {/* Spin Button / Result */}
        {result ? (
          <div className="relative rounded-[1.75rem] border border-gold/30 bg-surface/95 backdrop-blur p-8 text-center overflow-hidden animate-reveal-in shadow-card mx-auto max-w-md">
            {/* Confetti */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 20 }).map((_, i) => (
                <span
                  key={i}
                  className="confetti-piece"
                  style={{
                    left: `${(i * 137) % 100}%`,
                    width: i % 3 === 0 ? 7 : 5,
                    height: i % 2 === 0 ? 12 : 9,
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

            <div className="relative mx-auto mb-5 w-28 h-28 sm:w-32 sm:h-32">
              <div className="absolute inset-0 rounded-3xl bg-gold/20 blur-lg" />
              <div className="relative w-full h-full rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/25 to-transparent flex items-center justify-center">
                {result.reward.imageUrl ? (
                  <img
                    src={result.reward.imageUrl}
                    alt={result.reward.name}
                    className="w-full h-full object-cover rounded-3xl"
                  />
                ) : (
                  <span className="text-5xl sm:text-6xl font-bold" style={{ color: result.reward.color }}>
                    {result.reward.name.charAt(0)}
                  </span>
                )}
              </div>
            </div>

            <p className="font-display text-xl sm:text-2xl font-bold text-white mb-1">{result.reward.name}</p>
            <p className="text-xs text-fg-muted mb-7">{t('rewardAdded')}</p>

            <button
              onClick={handleDone}
              className="w-full py-4 bg-gold-gradient text-brand-emerald rounded-2xl font-bold text-lg shadow-gold hover:shadow-gold-lg hover:scale-[1.01] transition-all inline-flex items-center justify-center gap-2"
            >
              {t('done')}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={spin}
            disabled={spinning || hasSpun}
            className={`group w-full py-5 rounded-2xl font-display font-bold text-xl transition-all ${
              spinning || hasSpun
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
                <svg className="w-6 h-6 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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