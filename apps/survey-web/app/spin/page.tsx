'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useLanguage } from '../context/I18nProvider'
import Header from '../components/Header'
import { API_BASE, clearIdentitySession, getValidToken, markResumeTokenRecovery } from '../lib/api'
import { useToast } from '../components/Toast'
import { useHydrated } from '../lib/useHydrated'
import './cards.css'

interface Reward {
  id: string
  name: string
  weight: number
  color: string
  imageUrl?: string
  remainingQuantity: number
  status: string
  requiresDelivery: boolean
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
  requires_delivery?: number
}

interface MyRewardApiItem {
  id?: string | null
  user_reward_id?: string | null
  userRewardId?: string | null
  reward_id?: string | null
  rewardId?: string | null
  reward_name?: string | null
  rewardName?: string | null
  name?: string | null
  image_url?: string | null
  imageUrl?: string | null
  requires_delivery?: number | boolean | null
  requiresDelivery?: number | boolean | null
  delivery_status?: string | null
  status?: string | null
}

interface PriorAward {
  reward: Reward
  userRewardId: string
}

const SEGMENT_COLORS = [
  '#20100F', // Stout Brown Deep
  '#E01B2C', // Stout Red
  '#3B1F1D', // Stout Brown
  '#B8121F', // Stout Red Dark
  '#55312D', // Stout Brown Light
  '#2A1615', // Surface
] as const

const CONFETTI_COLORS = ['#F7E7BC', '#E2C97F', '#F5E7B8', '#E01B2C', '#F59E0B', '#F04450', '#3B1F1D', '#B8121F'] as const

// Card-draw timing. The shuffle must run at least MIN_SHUFFLE_MS so the draw
// never feels instant even when the API answers quickly; SHUFFLE_BEAT_MS is
// how often the face-down cards hop to a new shuffled arrangement.
const MIN_SHUFFLE_MS = 1400
const SHUFFLE_BEAT_MS = 230

/** Grid columns for a given number of active reward types. */
function columnsFor(count: number): number {
  if (count <= 1) return 1
  if (count === 2 || count === 4) return 2
  return 3
}

/**
 * Deterministic per-beat displacement for the shuffle, so every card hops to a
 * new arrangement on each beat without needing per-card state.
 */
function shuffleOffset(tick: number, index: number): { x: number; y: number; rot: number } {
  const seed = tick + 1
  const a = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453
  const b = Math.sin(seed * 39.3468 + index * 11.135) * 24634.6345
  const r1 = a - Math.floor(a)
  const r2 = b - Math.floor(b)
  return { x: (r1 - 0.5) * 24, y: (r2 - 0.5) * 16, rot: (r1 - 0.5) * 11 }
}

function sessionGet(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function sessionSet(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // Storage is optional; the in-memory state remains usable.
  }
}

function mapMyReward(item: MyRewardApiItem, color: string): PriorAward | null {
  const rewardIdValue = item.reward_id || item.rewardId
  const userRewardIdValue = item.user_reward_id || item.userRewardId || item.id
  const rewardId = typeof rewardIdValue === 'string' ? rewardIdValue.trim() : ''
  const userRewardId = typeof userRewardIdValue === 'string' ? userRewardIdValue.trim() : ''
  const status = String(item.delivery_status || item.status || '').toUpperCase()
  if (!rewardId || !userRewardId || status === 'CANCELLED' || status === 'CANCELED') return null
  const deliveryValue = item.requires_delivery ?? item.requiresDelivery
  const requiresDelivery = deliveryValue !== false && deliveryValue !== 0
  const imageValue = item.image_url || item.imageUrl
  const nameValue = item.reward_name || item.rewardName || item.name
  return {
    userRewardId,
    reward: {
      id: rewardId,
      name: nameValue || 'Reward',
      weight: 0,
      color,
      imageUrl: typeof imageValue === 'string' ? imageValue : undefined,
      remainingQuantity: 0,
      status: 'AWARDED',
      requiresDelivery,
    },
  }
}

function isValidSpinAward(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const value = data as Record<string, unknown>
  const rewardId = typeof value.rewardId === 'string' ? value.rewardId.trim() : typeof value.reward_id === 'string' ? value.reward_id.trim() : ''
  const userRewardId = typeof value.userRewardId === 'string' ? value.userRewardId.trim() : typeof value.user_reward_id === 'string' ? value.user_reward_id.trim() : ''
  const status = String(value.status || value.spinStatus || '').toUpperCase()
  return Boolean(rewardId && userRewardId && status !== 'CANCELLED' && status !== 'CANCELED')
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function SpinPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const { showToast } = useToast()
  const hydrated = useHydrated()
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<{ reward: Reward; userRewardId: string } | null>(null)
  // The tapped card. Everything else stays face-down: unselected cards never
  // reveal a reward, so no reward is assigned to them in the first place.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  // Bumped on every shuffle beat so the face-down cards visibly reorder.
  const [shuffleTick, setShuffleTick] = useState(0)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [surveyCompleted, setSurveyCompleted] = useState(false)
  const [error, setError] = useState('')
  const [hasSpun, setHasSpun] = useState(false)
  const [confettiParticles, setConfettiParticles] = useState<Array<{ id: number; x: string; y: string; color: string; delay: number; duration: number; rotation: number }>>([])
  const [showCelebration, setShowCelebration] = useState(false)
  const prefersReducedMotion = useRef(false)
  const shuffleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const shuffleStartedRef = useRef(0)
  const rewardsLoadedRef = useRef(false)
  const rewardsRef = useRef<Reward[]>([])
  const priorAwardRef = useRef<PriorAward | null>(null)
  const celebrationRef = useRef<HTMLDivElement>(null)

  // Keep the grid visible after a successful draw so the tapped card can flip
  // over in place. A prior award from an earlier visit has no tapped card, so
  // the grid is hidden and only the result card is shown.
  const showCards = selectedIndex !== null || result === null

  const getRewardColor = useCallback((index: number) => SEGMENT_COLORS[index % SEGMENT_COLORS.length], [])

  const fetchRewards = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/rewards?lang=${language}`)
      const data = await res.json().catch(() => null)
      if (data?.success && Array.isArray(data.data)) {
        const mappedRewards: Reward[] = data.data.map((r: RewardApiItem, idx: number) => ({
          id: r.id,
          name: r.name,
          weight: r.weight || 10,
          color: getRewardColor(idx),
          imageUrl: r.image_url,
          remainingQuantity: r.remaining_quantity,
          status: r.status,
          requiresDelivery: r.requires_delivery !== 0,
        }))
        setRewards(mappedRewards)
        rewardsRef.current = mappedRewards
        rewardsLoadedRef.current = true
      } else if (rewardsRef.current.length === 0) {
        setRewards([])
        rewardsLoadedRef.current = true
      }
    } catch {
      setError(t('validation.connectionFailed'))
      if (rewardsRef.current.length === 0) {
        setRewards([])
        rewardsLoadedRef.current = true
      }
    } finally {
      setLoading(false)
    }
  }, [language, t, getRewardColor])

  const applyPriorAward = useCallback((award: PriorAward) => {
    priorAwardRef.current = award
    sessionSet('user_reward_id', award.userRewardId)
    sessionSet('reward_name', award.reward.name)
    const catalogue = rewardsRef.current
    const index = catalogue.findIndex(reward => reward.id === award.reward.id)
    const displayReward = index >= 0
      ? { ...catalogue[index], name: award.reward.name || catalogue[index].name, imageUrl: award.reward.imageUrl || catalogue[index].imageUrl, requiresDelivery: award.reward.requiresDelivery }
      : award.reward
    setResult({ reward: displayReward, userRewardId: award.userRewardId })
    setHasSpun(true)
  }, [])

  const checkExistingSpin = useCallback(async (initialToken?: string): Promise<PriorAward | null> => {
    try {
      let token = initialToken || await getValidToken()
      if (!token) return null
      const request = async (authToken: string) => {
        const res = await fetch(`${API_BASE}/rewards/my`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        return { status: res.status, body: await res.json().catch(() => null) }
      }
      let response = await request(token)
      if (response.status === 401) {
        token = await getValidToken(true) || ''
        if (!token) {
          clearIdentitySession()
          router.replace('/info')
          return null
        }
        response = await request(token)
      }
      if (response.status === 401) {
        clearIdentitySession()
        router.replace('/info')
        return null
      }
      if (!response.body?.success || !Array.isArray(response.body.data)) return null
      for (const [index, item] of (response.body.data as MyRewardApiItem[]).entries()) {
        const award = mapMyReward(item, getRewardColor(index))
        if (award) {
          applyPriorAward(award)
          return award
        }
      }
    } catch {
      // A user with no prior award is the normal case.
    }
    return null
  }, [applyPriorAward, getRewardColor, router])

  useEffect(() => {
    if (!hydrated) return
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotion.current = mediaQuery.matches
    const handler = (e: MediaQueryListEvent) => { prefersReducedMotion.current = e.matches }
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [hydrated])

  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    getValidToken().then(token => {
      if (cancelled) return
      setSurveyCompleted(Boolean(sessionGet('survey_response_id')))
      if (!token) {
        setLoading(false)
        router.replace('/info')
        return
      }
      setAuthReady(true)
      void fetchRewards()
      void checkExistingSpin(token)
    })
    return () => { cancelled = true }
  }, [checkExistingSpin, fetchRewards, hydrated, router])

  useEffect(() => {
    if (!authReady || rewards.length === 0 || !priorAwardRef.current) return
    const award = priorAwardRef.current
    const index = rewards.findIndex(reward => reward.id === award.reward.id)
    if (index < 0) return
    const displayReward = {
      ...rewards[index],
      name: award.reward.name || rewards[index].name,
      imageUrl: award.reward.imageUrl || rewards[index].imageUrl,
      requiresDelivery: award.reward.requiresDelivery,
    }
    setResult({ reward: displayReward, userRewardId: award.userRewardId })
  }, [authReady, rewards])

  const [idempotencyKey, setIdempotencyKey] = useState(() => {
    const existing = sessionGet('spin_idempotency_key')
    if (existing) return existing
    const key = createIdempotencyKey()
    sessionSet('spin_idempotency_key', key)
    return key
  })

  const resetIdempotencyKey = () => {
    const key = createIdempotencyKey()
    sessionSet('spin_idempotency_key', key)
    setIdempotencyKey(key)
  }

  // Spawn confetti particles for celebration
  const spawnConfetti = useCallback(() => {
    if (prefersReducedMotion.current) return
    const particles = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: `${10 + (i * 137) % 80}%`,
      y: `${-5 + (i % 5) * 2}%`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: (i % 8) * 0.05,
      duration: 2 + (i % 5) * 0.4,
      rotation: Math.random() * 360,
    }))
    setConfettiParticles(particles)
    setShowCelebration(true)
  }, [])

  // Clear confetti after animation
  useEffect(() => {
    if (!showCelebration) return
    const timer = setTimeout(() => {
      setConfettiParticles([])
      setShowCelebration(false)
    }, 4000)
    return () => clearTimeout(timer)
  }, [showCelebration])

  // -----------------------------------------------------------------
  // Card draw: shuffle the face-down cards, then reveal the one tapped.
  //
  // The winner is still chosen server-side by the existing weighted
  // algorithm (buildWeightedPool / pickWeightedIndex), so the odds are
  // untouched — only the presentation changes. The API result is rendered on
  // the tapped card and no other card is ever turned over, so unselected
  // cards never display a reward.
  // -----------------------------------------------------------------

  const beginShuffle = useCallback(() => {
    shuffleStartedRef.current = Date.now()
    if (prefersReducedMotion.current) return
    if (shuffleTimerRef.current) clearInterval(shuffleTimerRef.current)
    setShuffleTick(0)
    shuffleTimerRef.current = setInterval(() => {
      setShuffleTick(tick => tick + 1)
    }, SHUFFLE_BEAT_MS)
  }, [])

  const endShuffle = useCallback(() => {
    if (shuffleTimerRef.current) {
      clearInterval(shuffleTimerRef.current)
      shuffleTimerRef.current = null
    }
    setShuffleTick(0)
  }, [])

  // Holds the shuffle for its full length so a fast API response never makes
  // the draw feel instant.
  const settleShuffle = useCallback(async (): Promise<void> => {
    const elapsed = Date.now() - shuffleStartedRef.current
    const budget = prefersReducedMotion.current ? 0 : MIN_SHUFFLE_MS
    const remaining = budget - elapsed
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining))
    endShuffle()
  }, [endShuffle])

  // Never leave the shuffle interval running after unmount.
  useEffect(() => () => {
    if (shuffleTimerRef.current) clearInterval(shuffleTimerRef.current)
  }, [])

  const spin = async () => {
    if (spinning || hasSpun || rewards.length === 0) return
    if (!surveyCompleted) {
      setError(t('spinWheel.surveyRequired'))
      router.push('/survey')
      return
    }

    setSpinning(true)
    setError('')
    beginShuffle()

    const recoverAuth = () => {
      endShuffle()
      setSpinning(false)
      clearIdentitySession()
      router.replace('/info')
    }

    try {
      let token = await getValidToken()
      if (!token) { recoverAuth(); return }

      const resolveContext = async (key: string, endpoint: string) => {
        const stored = sessionGet(key)
        if (stored) return stored
        try {
          const ctxRes = await fetch(`${API_BASE}${endpoint}?lang=${language}`)
          const ctxData = await ctxRes.json()
          if (ctxData.success && ctxData.data && ctxData.data.length > 0) return ctxData.data[0].id
        } catch { /* fall through */ }
        return null
      }

      const productId = await resolveContext('survey_product_id', '/products')
      const campaignId = await resolveContext('survey_campaign_id', '/campaigns')
      const requestBody = JSON.stringify({
        campaignId: campaignId || 'default',
        productId: productId || 'beer',
        idempotencyKey,
      })
      const doSpin = async (authToken: string) => {
        const res = await fetch(`${API_BASE}/rewards/spin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: requestBody,
        })
        return {
          status: res.status,
          body: await res.json().catch(() => null) as {
            success?: boolean
            data?: Record<string, unknown>
            error?: { code?: string; message?: string }
          } | null,
        }
      }

      let response = await doSpin(token)
      if (response.status === 401 || response.body?.error?.code === 'UNAUTHORIZED') {
        token = await getValidToken(true) || ''
        if (!token) { recoverAuth(); return }
        response = await doSpin(token)
      }
      if (response.status === 401 || response.body?.error?.code === 'UNAUTHORIZED') {
        recoverAuth()
        return
      }
      if (response.body?.error?.code === 'RESUME_TOKEN_REQUIRED') {
        markResumeTokenRecovery()
        clearIdentitySession()
        endShuffle()
        setSpinning(false)
        router.replace('/info')
        return
      }

      if (response.body?.success) {
        const serverReward = response.body.data as Record<string, unknown>
        if (!isValidSpinAward(serverReward)) {
          resetIdempotencyKey()
          const prior = await checkExistingSpin(token)
          endShuffle()
          setSpinning(false)
          setSelectedIndex(null)
          setHasSpun(Boolean(prior))
          if (!prior) setError(t('spinWheel.spinFailed'))
          return
        }

        const rewardId = String(serverReward.rewardId || serverReward.reward_id)
        const userRewardId = String(serverReward.userRewardId || serverReward.user_reward_id)
        const rewardName = String(serverReward.rewardName || serverReward.reward_name || t('spinWheel.rewardFallback'))
        const deliveryFlag = serverReward.requiresDelivery ?? serverReward.requires_delivery
        const requiresDelivery = deliveryFlag !== false && deliveryFlag !== 0
        let targetIndex = rewardsRef.current.findIndex(reward => reward.id === rewardId)

        if (targetIndex === -1) {
          await fetchRewards()
          await new Promise(resolve => setTimeout(resolve, 0))
          targetIndex = rewardsRef.current.findIndex(reward => reward.id === rewardId)
        }

        const catalogue = rewardsRef.current
        if (targetIndex === -1 || catalogue.length === 0) {
          const prior = await checkExistingSpin(token)
          const fallbackReward: Reward = prior?.reward || {
            id: rewardId, name: rewardName, weight: 0,
            color: getRewardColor(0), remainingQuantity: 0,
            status: 'AWARDED', requiresDelivery,
          }
          await settleShuffle()
          setSpinning(false)
          setResult({ reward: fallbackReward, userRewardId })
          setHasSpun(true)
          priorAwardRef.current = { reward: fallbackReward, userRewardId }
          sessionSet('user_reward_id', userRewardId)
          sessionSet('reward_name', fallbackReward.name)
          spawnConfetti()
          showToast(`${t('spinWheel.congratulations')} ${t('spinWheel.youWon')}: ${fallbackReward.name}!`, 'success', 5000)
          return
        }

        const displayReward: Reward = {
          ...catalogue[targetIndex],
          // The catalogue was fetched with `?lang=`, so its name is already in
          // the active language. `/rewards/spin` only echoes the untranslated
          // `rewards.name` column, so it is used as the fallback — never the
          // primary display string. Only the rendered label changes; rewardId,
          // stock, weight and userRewardId are untouched.
          name: catalogue[targetIndex].name || rewardName,
          requiresDelivery,
        }
        await settleShuffle()

        setSpinning(false)
        setResult({ reward: displayReward, userRewardId })
        setHasSpun(true)
        priorAwardRef.current = { reward: displayReward, userRewardId }
        sessionSet('user_reward_id', userRewardId)
        sessionSet('reward_name', displayReward.name)
        spawnConfetti()
        showToast(`${t('spinWheel.congratulations')} ${t('spinWheel.youWon')}: ${displayReward.name}!`, 'success', 5000)
      } else {
        endShuffle()
        setSpinning(false)
        setSelectedIndex(null)
        const errorCode = response.body?.error?.code
        if (errorCode === 'NO_REWARDS_AVAILABLE' || errorCode === 'REWARD_UNAVAILABLE' || errorCode === 'CANCELLED' || errorCode === 'CANCELED') {
          resetIdempotencyKey()
          setError(t('spinWheel.noRewardsDesc'))
        } else if (errorCode === 'SPIN_IN_PROGRESS') {
          setError(t('spinWheel.spinProcessing'))
        } else if (errorCode === 'ALREADY_SPUN') {
          setError(t('spinWheel.alreadySpun'))
          const prior = await checkExistingSpin(token)
          if (!prior) setHasSpun(false)
        } else {
          setError(response.body?.error?.message || t('spinWheel.spinFailed'))
        }
      }
    } catch {
      endShuffle()
      setSpinning(false)
      setSelectedIndex(null)
      setError(t('validation.connectionFailed'))
    }
  }

  /**
   * Tapping a card starts the draw. The card is marked selected first so the
   * shuffle runs on that card, and the API response is rendered on the very
   * same card once it flips over.
   */
  const handleCardTap = (index: number) => {
    if (spinning || hasSpun || result !== null) return
    if (!surveyCompleted) {
      setError(t('spinWheel.surveyRequired'))
      router.push('/survey')
      return
    }
    setSelectedIndex(index)
    void spin()
  }

  const handleDone = () => { router.push('/') }

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

  if (rewards.length === 0 && !result) {
    return (
      <div className="min-h-screen bg-navy text-fg-bright relative overflow-hidden flex items-center justify-center p-4">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[400px] rounded-full bg-gold/[0.08] blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 w-[360px] h-[360px] rounded-full bg-brand-emeraldLight/50 blur-[110px]" />
        <Header title={t('spinWheel.spinTitle')} backHref="/survey" />
        <div className="relative mx-auto max-w-xl px-4 py-8 pb-20 text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-surface/50 border border-gold/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-gold/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold gold-text mb-3">{t('spinWheel.noRewardsTitle')}</h2>
          <p className="text-fg-secondary mb-6 max-w-md mx-auto">{t('spinWheel.noRewardsDesc')}</p>
          <button onClick={fetchRewards} className="px-6 py-3 bg-gold-gradient text-brand-emerald rounded-2xl font-bold shadow-gold hover:shadow-gold-lg transition-all">
            {t('spinWheel.tryAgain')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy text-fg-bright relative overflow-hidden">
      {/* Ambient glow effects */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[400px] rounded-full bg-gold/[0.08] blur-[120px] animate-orb-drift" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[360px] h-[360px] rounded-full bg-brand-emeraldLight/50 blur-[110px] animate-orb-drift" style={{ animationDelay: '-4s' }} />
      <div className="pointer-events-none absolute top-1/2 left-0 w-[300px] h-[300px] rounded-full bg-gold/[0.04] blur-[100px] animate-orb-drift" style={{ animationDelay: '-2s' }} />

      <Header title={t('spinWheel.spinTitle')} backHref="/survey" />

      <div className="relative mx-auto max-w-xl px-4 py-8 pb-20">
        {/* Title section */}
        <div className="text-center mb-7 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <span className="inline-block px-3 py-1 rounded-full border border-gold/30 bg-gold/10 text-[10px] tracking-[0.3em] uppercase text-gold mb-3">04 · Lucky Draw</span>
          <h2 className="font-display text-3xl font-bold gold-text">{t('spinWheel.spinTitle')}</h2>
          <p className="text-fg-secondary mt-2">{t('spinWheel.spinDesc')}</p>
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

        {/* Card draw — every card is face-down and shows only the brand logo.
            No reward is rendered until the user taps a card, and then only on
            that card: the others are never turned over. */}
        {showCards && (
          <div
            className="grid gap-3 sm:gap-4 mb-6 mx-auto w-full max-w-md"
            style={{ gridTemplateColumns: `repeat(${columnsFor(rewards.length)}, minmax(0, 1fr))` }}
            role="group"
            aria-label={t('spinWheel.pickCardHint')}
          >
            {rewards.map((reward, index) => {
              const isRevealed = result !== null && selectedIndex === index
              const isSelected = selectedIndex === index
              const isDealing = spinning && result === null
              const shuffle = isDealing ? shuffleOffset(shuffleTick, index) : null

              return (
                <button
                  key={reward.id}
                  type="button"
                  onClick={() => handleCardTap(index)}
                  disabled={spinning || hasSpun || result !== null}
                  aria-pressed={isSelected}
                  aria-label={isRevealed && result ? result.reward.name : t('spinWheel.cardBackAlt')}
                  className={[
                    'card-draw',
                    isRevealed ? 'is-revealed' : '',
                    isSelected ? 'is-selected' : '',
                    isDealing ? 'is-dealing' : '',
                  ].filter(Boolean).join(' ')}
                  style={shuffle
                    ? { transform: `translate(${shuffle.x}px, ${shuffle.y}px) rotate(${shuffle.rot}deg)` }
                    : undefined}
                >
                  <span className="card-inner">
                    {/* Back of the card — the only thing visible before a tap. */}
                    <span className="card-face card-back">
                      <Image src="/myanmarbeerstout.png" alt="" width={160} height={160} className="card-logo" />
                      <span className="card-back-ring" aria-hidden="true" />
                    </span>

                    {/* Front of the card — populated only once revealed. */}
                    <span className="card-face card-front">
                      {isRevealed && result && (
                        result.reward.imageUrl ? (
                          <Image
                            src={result.reward.imageUrl}
                            alt=""
                            width={160}
                            height={160}
                            className="card-reward-img"
                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                          />
                        ) : (
                          <span className="card-initial" style={{ color: result.reward.color }}>
                            {result.reward.name.charAt(0)}
                          </span>
                        )
                      )}
                      {isRevealed && result && (
                        <span className="card-reward-name">{result.reward.name}</span>
                      )}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}


        {/* Confetti Explosion Layer */}
        {confettiParticles.length > 0 && (
          <div className="confetti-explosion-container absolute inset-0 pointer-events-none z-30">
            {confettiParticles.map((particle) => (
              <span key={particle.id} className="confetti-explode" style={{
                left: particle.x,
                top: particle.y,
                width: particle.id % 3 === 0 ? 7 : 5,
                height: particle.id % 2 === 0 ? 12 : 9,
                backgroundColor: particle.color,
                '--delay': `${particle.delay}s`,
                '--duration': `${particle.duration}s`,
                '--dx': `${20 + (particle.id * 137) % 60}%`,
                '--dy': `${100 + particle.id * 5}%`,
              } as React.CSSProperties} />
            ))}
          </div>
        )}

        {/* Spin Button / Result */}
        {result ? (
          <div ref={celebrationRef} className="relative rounded-[1.75rem] border border-gold/30 bg-surface/95 backdrop-blur p-8 text-center overflow-hidden animate-reveal-in shadow-card mx-auto max-w-md animate-celebration">
            {/* Confetti burst behind card */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {Array.from({ length: 24 }).map((_, i) => (
                <span key={i} className="confetti-piece" style={{
                  left: `${(i * 137) % 100}%`,
                  top: `${(i * 89) % 100}%`,
                  width: i % 3 === 0 ? 7 : 5,
                  height: i % 2 === 0 ? 12 : 9,
                  backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                  animationDuration: `${2.5 + (i % 5) * 0.6}s`,
                  animationDelay: `${(i % 7) * 0.2}s`,
                }} />
              ))}
            </div>

            {/* Gold divider line */}
            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />

            <span className="inline-block px-3 py-1 rounded-full border border-gold/30 bg-gold/10 text-[10px] tracking-[0.3em] uppercase text-gold mb-4">05 · Reward</span>
            <h3 className="font-display text-3xl font-bold gold-text mb-2 animate-pop">{t('spinWheel.congratulations')}</h3>
            <p className="text-fg-secondary mb-5">{t('spinWheel.youWon')}</p>

            {/* Reward image with celebration glow */}
            <div className="relative mx-auto mb-5 w-28 h-28 sm:w-32 sm:h-32">
              <div className="absolute inset-0 rounded-3xl bg-gold/20 blur-lg animate-celebration" />
              <div className="relative w-full h-full rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/25 to-transparent flex items-center justify-center animate-spring-pop">
                {result.reward.imageUrl ? (
                  <Image src={result.reward.imageUrl} alt={result.reward.name} width={224} height={224} className="w-full h-full object-cover rounded-3xl" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                ) : (
                  <span className="text-5xl sm:text-6xl font-bold" style={{ color: result.reward.color }}>
                    {result.reward.name.charAt(0)}
                  </span>
                )}
              </div>
            </div>

            <p className="font-display text-xl sm:text-2xl font-bold text-white mb-1">{result.reward.name}</p>
            <p className="text-xs text-fg-muted mb-6">{result.reward.requiresDelivery ? t('spinWheel.rewardAdded') : t('spinWheel.noDeliveryNeeded')}</p>

            {result.reward.requiresDelivery && result.userRewardId && (
              <button onClick={() => router.push(`/delivery?reward=${encodeURIComponent(result.userRewardId)}`)} className="w-full mb-3 py-4 bg-gold-gradient text-brand-emerald rounded-2xl font-bold text-lg shadow-gold hover:shadow-gold-lg hover:scale-[1.01] transition-all inline-flex items-center justify-center gap-2">
                {t('spinWheel.claimReward')}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </button>
            )}

            <button onClick={handleDone} className={`w-full py-4 rounded-2xl font-bold text-lg transition-all inline-flex items-center justify-center gap-2 ${result.reward.requiresDelivery && result.userRewardId ? 'border border-white/15 bg-white/[0.04] text-fg-bright hover:bg-white/[0.08]' : 'bg-gold-gradient text-brand-emerald shadow-gold hover:shadow-gold-lg hover:scale-[1.01]'}`}>
              {t('common.done')}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            {spinning ? (
              <span className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl border border-gold/30 bg-gold/10 text-gold text-sm font-semibold">
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {t('spinWheel.dealing')}
              </span>
            ) : hasSpun ? (
              <span className="px-5 py-3 rounded-2xl border border-white/10 bg-white/[0.04] text-fg-muted text-sm font-semibold">
                {t('spinWheel.alreadySpun')}
              </span>
            ) : (
              <span className="px-5 py-3 rounded-2xl border border-white/10 bg-white/[0.04] text-fg-secondary text-sm">
                {t('spinWheel.pickCardHint')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
