'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'
import { API_BASE, clearIdentitySession, getValidToken, markResumeTokenRecovery } from '../lib/api'
import { useToast } from '../components/Toast'
import { useHydrated } from '../lib/useHydrated'
import './spin-enhancements.css'

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
  const [rotation, setRotation] = useState(0)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [surveyCompleted, setSurveyCompleted] = useState(false)
  const [error, setError] = useState('')
  const [hasSpun, setHasSpun] = useState(false)
  const [confettiParticles, setConfettiParticles] = useState<Array<{ id: number; x: string; y: string; color: string; delay: number; duration: number; rotation: number }>>([])
  const [showCelebration, setShowCelebration] = useState(false)
  const prefersReducedMotion = useRef(false)
  const animationRef = useRef<Animation | null>(null)
  const spinAnimationRef = useRef<Animation | null>(null)
  const wheelRef = useRef<HTMLDivElement>(null)
  const mediaQueryRef = useRef<MediaQueryList | null>(null)
  const rotationRef = useRef(0)
  const rewardsLoadedRef = useRef(false)
  const rewardsRef = useRef<Reward[]>([])
  const priorAwardRef = useRef<PriorAward | null>(null)
  const celebrationRef = useRef<HTMLDivElement>(null)

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
      setError(t('connectionFailed'))
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
    if (index >= 0 && catalogue.length > 0) {
      const segmentAngle = 360 / catalogue.length
      const targetAngle = -(index * segmentAngle + segmentAngle / 2) - 90
      const finalRotation = 5 * 360 + targetAngle
      setRotation(finalRotation)
      rotationRef.current = finalRotation
    } else {
      setRotation(0)
      rotationRef.current = 0
    }
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
    mediaQueryRef.current = mediaQuery
    prefersReducedMotion.current = mediaQuery.matches
    const handler = (e: MediaQueryListEvent) => { prefersReducedMotion.current = e.matches }
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [hydrated])

  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    setSurveyCompleted(Boolean(sessionGet('survey_response_id')))
    getValidToken().then(token => {
      if (cancelled) return
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
    const segmentAngle = 360 / rewards.length
    const targetAngle = -(index * segmentAngle + segmentAngle / 2) - 90
    const finalRotation = 5 * 360 + targetAngle
    setRotation(finalRotation)
    rotationRef.current = finalRotation
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

  // Premium spin animation using Web Animations API with spring physics
  const animateWheel = useCallback((
    targetRotation: number,
    duration: number = 4500
  ): Promise<void> => {
    return new Promise((resolve) => {
      const wheel = wheelRef.current
      if (!wheel) { resolve(); return }

      wheel.getAnimations().forEach(anim => anim.cancel())
      spinAnimationRef.current = null
      animationRef.current = null

      const startRotation = rotationRef.current
      const totalRotation = targetRotation

      if (prefersReducedMotion.current) {
        wheel.style.transform = `rotate(${startRotation + totalRotation}deg)`
        setRotation(startRotation + totalRotation)
        rotationRef.current = startRotation + totalRotation
        setTimeout(resolve, 300)
        return
      }

      // Spring physics easing: fast entry, gentle deceleration with overshoot
      const keyframes = [
        { transform: `rotate(${startRotation}deg)`, offset: 0, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
        { transform: `rotate(${startRotation + totalRotation * 0.12}deg)`, offset: 0.08, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
        { transform: `rotate(${startRotation + totalRotation * 0.35}deg)`, offset: 0.25, easing: 'cubic-bezier(0.55, 0.06, 0.68, 0.19)' },
        { transform: `rotate(${startRotation + totalRotation * 0.55}deg)`, offset: 0.4, easing: 'cubic-bezier(0.55, 0.06, 0.68, 0.19)' },
        { transform: `rotate(${startRotation + totalRotation * 0.72}deg)`, offset: 0.58, easing: 'cubic-bezier(0.55, 0.06, 0.68, 0.19)' },
        { transform: `rotate(${startRotation + totalRotation * 0.85}deg)`, offset: 0.75, easing: 'cubic-bezier(0.55, 0.06, 0.68, 0.19)' },
        { transform: `rotate(${startRotation + totalRotation * 0.93}deg)`, offset: 0.88, easing: 'cubic-bezier(0.55, 0.06, 0.68, 0.19)' },
        { transform: `rotate(${startRotation + totalRotation * 0.98}deg)`, offset: 0.95, easing: 'cubic-bezier(0.55, 0.06, 0.68, 0.19)' },
        { transform: `rotate(${startRotation + totalRotation}deg)`, offset: 1, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' },
      ]

      const animation = wheel.animate(keyframes, {
        duration,
        fill: 'forwards',
        easing: 'linear',
      })

      animationRef.current = animation

      animation.onfinish = () => {
        const finalRotation = startRotation + totalRotation
        setRotation(finalRotation)
        rotationRef.current = finalRotation
        animationRef.current = null
        resolve()
      }

      animation.oncancel = () => {
        animationRef.current = null
        resolve()
      }
    })
  }, [])

  // Gentle pointer bounce with spring physics
  const triggerPointerBounce = useCallback(() => {
    if (prefersReducedMotion.current) return
    const pointer = document.querySelector('.spin-pointer')
    if (pointer) {
      pointer.animate(
        [
          { transform: 'translateX(-50%) rotate(0deg) scale(1)', offset: 0 },
          { transform: 'translateX(-50%) rotate(-5deg) scale(1.12)', offset: 0.12 },
          { transform: 'translateX(-50%) rotate(3deg) scale(0.94)', offset: 0.28 },
          { transform: 'translateX(-50%) rotate(-2deg) scale(1.06)', offset: 0.42 },
          { transform: 'translateX(-50%) rotate(1deg) scale(1)', offset: 0.58 },
          { transform: 'translateX(-50%) rotate(-0.5deg) scale(1.02)', offset: 0.74 },
          { transform: 'translateX(-50%) rotate(0deg) scale(1)', offset: 1 },
        ],
        { duration: 700, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
      )
    }
  }, [])

  // Starts an indefinite wheel spin the instant the user presses Spin
  const startContinuousSpin = useCallback(() => {
    const wheel = wheelRef.current
    if (!wheel || prefersReducedMotion.current) return
    wheel.getAnimations().forEach(anim => anim.cancel())
    const base = rotationRef.current
    const animation = wheel.animate(
      [
        { transform: `rotate(${base}deg)` },
        { transform: `rotate(${base + 360}deg)` },
      ],
      { duration: 800, iterations: Infinity, easing: 'linear' }
    )
    spinAnimationRef.current = animation
  }, [])

  const currentWheelRotation = useCallback((): number => {
    const animation = spinAnimationRef.current
    if (!animation) return rotationRef.current
    const timing = animation.effect?.getTiming()
    const rawDuration = timing?.duration
    const duration = typeof rawDuration === 'number' && rawDuration > 0 ? rawDuration : 800
    const currentTime = typeof animation.currentTime === 'number' ? animation.currentTime : 0
    const progress = (currentTime % duration) / duration
    return rotationRef.current + progress * 360
  }, [])

  const stopContinuousSpin = useCallback((): number => {
    const current = currentWheelRotation()
    const animation = spinAnimationRef.current
    spinAnimationRef.current = null
    if (animation) animation.cancel()
    rotationRef.current = current
    setRotation(current)
    return current
  }, [currentWheelRotation])

  const landOnReward = useCallback(async (targetIndex: number, count: number): Promise<void> => {
    const from = stopContinuousSpin()
    const segmentAngle = 360 / count
    const targetAngle = -(targetIndex * segmentAngle + segmentAngle / 2) - 90

    const desiredMod = ((targetAngle % 360) + 360) % 360
    const fromMod = ((from % 360) + 360) % 360
    let delta = desiredMod - fromMod
    if (delta < 0) delta += 360

    const extraRotations = prefersReducedMotion.current ? 0 : 4 * 360
    await animateWheel(delta + extraRotations, prefersReducedMotion.current ? 300 : 5000)
    triggerPointerBounce()
  }, [stopContinuousSpin, animateWheel, triggerPointerBounce])

  const spin = async () => {
    if (spinning || hasSpun || rewards.length === 0) return
    if (!surveyCompleted) {
      setError('Please complete the survey first')
      router.push('/survey')
      return
    }

    setSpinning(true)
    setError('')
    startContinuousSpin()

    const recoverAuth = () => {
      stopContinuousSpin()
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
        stopContinuousSpin()
        setSpinning(false)
        router.replace('/info')
        return
      }

      if (response.body?.success) {
        const serverReward = response.body.data as Record<string, unknown>
        if (!isValidSpinAward(serverReward)) {
          resetIdempotencyKey()
          const prior = await checkExistingSpin(token)
          stopContinuousSpin()
          setSpinning(false)
          setHasSpun(Boolean(prior))
          if (!prior) setError(t('spinFailed'))
          return
        }

        const rewardId = String(serverReward.rewardId || serverReward.reward_id)
        const userRewardId = String(serverReward.userRewardId || serverReward.user_reward_id)
        const rewardName = String(serverReward.rewardName || serverReward.reward_name || 'Reward')
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
          stopContinuousSpin()
          setSpinning(false)
          setResult({ reward: fallbackReward, userRewardId })
          setHasSpun(true)
          priorAwardRef.current = { reward: fallbackReward, userRewardId }
          sessionSet('user_reward_id', userRewardId)
          sessionSet('reward_name', fallbackReward.name)
          spawnConfetti()
          showToast(`${t('congratulations')} ${t('youWon')}: ${fallbackReward.name}!`, 'success', 5000)
          return
        }

        const displayReward: Reward = {
          ...catalogue[targetIndex],
          name: rewardName || catalogue[targetIndex].name,
          requiresDelivery,
        }
        await landOnReward(targetIndex, catalogue.length)
        await new Promise(resolve => setTimeout(resolve, 250))

        setSpinning(false)
        setResult({ reward: displayReward, userRewardId })
        setHasSpun(true)
        priorAwardRef.current = { reward: displayReward, userRewardId }
        sessionSet('user_reward_id', userRewardId)
        sessionSet('reward_name', displayReward.name)
        spawnConfetti()
        showToast(`${t('congratulations')} ${t('youWon')}: ${displayReward.name}!`, 'success', 5000)
      } else {
        stopContinuousSpin()
        setSpinning(false)
        const errorCode = response.body?.error?.code
        if (errorCode === 'NO_REWARDS_AVAILABLE' || errorCode === 'REWARD_UNAVAILABLE' || errorCode === 'CANCELLED' || errorCode === 'CANCELED') {
          resetIdempotencyKey()
          setError(t('noRewardsDesc'))
        } else if (errorCode === 'SPIN_IN_PROGRESS') {
          setError(t('spinProcessing'))
        } else if (errorCode === 'ALREADY_SPUN') {
          setError(t('alreadySpun'))
          const prior = await checkExistingSpin(token)
          if (!prior) setHasSpun(false)
        } else {
          setError(response.body?.error?.message || t('spinFailed'))
        }
      }
    } catch {
      stopContinuousSpin()
      setSpinning(false)
      setError(t('connectionFailed'))
    }
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
        <p className="text-sm text-fg-muted mt-4">{t('loading')}</p>
      </div>
    )
  }

  if (rewards.length === 0 && !result) {
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
          <button onClick={fetchRewards} className="px-6 py-3 bg-gold-gradient text-brand-emerald rounded-2xl font-bold shadow-gold hover:shadow-gold-lg transition-all">
            {t('tryAgain')}
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

      <Header title={t('spinTitle')} backHref="/survey" />

      <div className="relative mx-auto max-w-xl px-4 py-8 pb-20">
        {/* Title section */}
        <div className="text-center mb-7 animate-fade-up" style={{ animationDelay: '0.1s' }}>
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
          {rewards.map((reward) => (
            <span key={reward.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-xs text-fg-secondary transition-all hover:bg-white/[0.08]" style={{ borderColor: `${reward.color}80` }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: reward.color }} />
              {reward.name}
            </span>
          ))}
        </div>

        {/* Wheel Container */}
        <div className="relative w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-96 mx-auto mb-9">
          {/* Outer glow ring with wheel glow */}
          <div className={`absolute -inset-4 rounded-full bg-gold/25 blur-2xl animate-wheel-glow ${spinning || result ? 'opacity-100' : 'opacity-70'}`} />

          {/* Expanding ring on win */}
          {result && (
            <div className="absolute -inset-2 rounded-full border-2 border-gold/40 animate-ring-expand" style={{ animationDuration: '0.6s' }} />
          )}

          {/* Pointer/Indicator - Fixed at top */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center spin-pointer">
            <div className="relative">
              <div className="w-0 h-0 border-l-[18px] border-r-[18px] border-b-[30px] border-l-transparent border-r-transparent border-b-gold drop-shadow-lg" />
              <div className="absolute bottom-[-8px] left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-gold-gradient border-2 border-navy-deep shadow-gold" />
            </div>
          </div>

          {/* Wheel Rim & Face */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-warm via-gold to-[#997C3E] p-[5px] shadow-gold-lg animate-wheel-glow">
            <div className="w-full h-full rounded-full bg-navy-deep relative overflow-hidden">
              {/* Gold sweep overlay */}
              <div className="absolute inset-0 animate-gold-sweep opacity-30 pointer-events-none" />

              {/* Rotating wheel face */}
              <div ref={wheelRef} className="absolute inset-0" style={{ transform: `rotate(${rotation}deg)` }}>
                {rewards.map((reward, i) => {
                  const segmentAngle = 360 / rewards.length
                  const startAngle = i * segmentAngle
                  const midAngle = startAngle + segmentAngle / 2

                  return (
                    <div key={reward.id} className="absolute inset-0 flex items-center justify-center" style={{ clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((startAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((startAngle + segmentAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle + segmentAngle - 90) * Math.PI / 180)}%)`, backgroundColor: reward.color }}>
                      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, transparent 40%, currentColor 40%)', backgroundSize: '20px 20px' }} />

                      {/* Segment label - counter-rotated for readability */}
                      <div className="relative z-10 flex items-center justify-center pointer-events-none" style={{ transform: `rotate(${-rotation - 90 + midAngle}deg) translateY(-112px)` }}>
                        <span className="inline-block max-w-[80px] sm:max-w-[92px] px-2 py-1.5 rounded-lg text-center text-[10px] sm:text-xs font-bold leading-snug text-white bg-navy/85 border border-white/15 shadow-lg backdrop-blur-[2px] whitespace-nowrap truncate">
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
                    <div key={`spoke-${index}`} className="absolute left-1/2 top-1/2 h-1/2 w-[2px] origin-top bg-white/25 pointer-events-none" style={{ transform: `rotate(${index * segmentAngle - 90}deg)` }} />
                  )
                })}

                {/* Inner decorative rings */}
                <div className="absolute inset-3 rounded-full border border-white/15 pointer-events-none" />
                <div className="absolute inset-14 rounded-full border border-white/10 pointer-events-none" />
                {/* Extra decorative ring for depth */}
                <div className="absolute inset-24 rounded-full border border-white/5 pointer-events-none" />
              </div>

              {/* Center hub */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className={`w-[74px] h-[74px] rounded-full p-[3px] bg-gradient-to-br from-warm via-gold to-[#997C3E] shadow-gold-lg animate-pulse-gold ${result ? 'animate-celebration' : ''}`}>
                  <div className="w-full h-full rounded-full bg-brand-emerald overflow-hidden flex items-center justify-center">
                    <Image src="/myanmarbeerstout.png" alt="MB" width={74} height={74} className="w-full h-full object-cover rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Winner highlight overlay */}
          {result && (
            <div className="absolute inset-0 rounded-full pointer-events-none z-20 animate-pop" style={{ transform: `rotate(${rotation}deg)` }}>
              <div className="absolute left-1/2 top-4 w-[2px] h-1/4 origin-top bg-gold/60" style={{ transform: `rotate(${180 - rotation}deg)`, boxShadow: '0 0 12px 2px rgba(245, 197, 66, 0.8)' }} />
            </div>
          )}
        </div>

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
            <h3 className="font-display text-3xl font-bold gold-text mb-2 animate-pop">{t('congratulations')}</h3>
            <p className="text-fg-secondary mb-5">{t('youWon')}</p>

            {/* Reward image with celebration glow */}
            <div className="relative mx-auto mb-5 w-28 h-28 sm:w-32 sm:h-32">
              <div className="absolute inset-0 rounded-3xl bg-gold/20 blur-lg animate-celebration" />
              <div className="relative w-full h-full rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/25 to-transparent flex items-center justify-center animate-spring-bounce">
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
            <p className="text-xs text-fg-muted mb-6">{result.reward.requiresDelivery ? t('rewardAdded') : t('noDeliveryNeeded')}</p>

            {result.reward.requiresDelivery && result.userRewardId && (
              <button onClick={() => router.push(`/delivery?reward=${encodeURIComponent(result.userRewardId)}`)} className="w-full mb-3 py-4 bg-gold-gradient text-brand-emerald rounded-2xl font-bold text-lg shadow-gold hover:shadow-gold-lg hover:scale-[1.01] transition-all inline-flex items-center justify-center gap-2">
                {t('claimReward')}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </button>
            )}

            <button onClick={handleDone} className={`w-full py-4 rounded-2xl font-bold text-lg transition-all inline-flex items-center justify-center gap-2 ${result.reward.requiresDelivery && result.userRewardId ? 'border border-white/15 bg-white/[0.04] text-fg-bright hover:bg-white/[0.08]' : 'bg-gold-gradient text-brand-emerald shadow-gold hover:shadow-gold-lg hover:scale-[1.01]'}`}>
              {t('done')}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </button>
          </div>
        ) : (
          <button onClick={spin} disabled={spinning || hasSpun} className={`group w-full py-5 rounded-2xl font-display font-bold text-xl transition-all ${spinning || hasSpun ? 'bg-white/[0.05] text-fg-muted cursor-not-allowed border border-white/10' : 'bg-gold-gradient text-brand-emerald shadow-gold-lg hover:scale-[1.02] hover:shadow-gold inline-flex items-center justify-center gap-3'}`}>
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
