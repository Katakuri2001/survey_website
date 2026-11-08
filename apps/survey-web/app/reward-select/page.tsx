'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useLanguage } from '../context/I18nProvider'
import Header from '../components/Header'
import { useToast } from '../components/Toast'
import { useHydrated } from '../lib/useHydrated'
import {
  allocateReward,
  clearIdentitySession,
  fetchRewardResult,
  getValidToken,
  markResumeTokenRecovery,
} from '../lib/api'
import '../spin/cards.css'

interface Reward {
  id: string
  name: string
  color: string
  imageUrl?: string
}

const SEGMENT_COLORS = [
  '#20100F', '#E01B2C', '#3B1F1D', '#B8121F', '#55312D', '#2A1615',
] as const

const CONFETTI_COLORS = ['#F7E7BC', '#E2C97F', '#F5E7B8', '#E01B2C', '#F59E0B', '#F04450', '#3B1F1D', '#B8121F'] as const

const MIN_SHUFFLE_MS = 1400
const SHUFFLE_BEAT_MS = 230

function columnsFor(count: number): number {
  if (count <= 1) return 1
  if (count === 2 || count === 4) return 2
  return 3
}

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
  try { return window.sessionStorage.getItem(key) } catch { return null }
}

function sessionSet(key: string, value: string): void {
  try { window.sessionStorage.setItem(key, value) } catch { /* ignore */ }
}

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function RewardSelectPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const { showToast } = useToast()
  const hydrated = useHydrated()

  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<{ rewardName: string; rewardImageUrl: string | null; shopId: string } | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [shuffleTick, setShuffleTick] = useState(0)
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const [error, setError] = useState('')
  const [hasSpun, setHasSpun] = useState(false)
  const [confettiParticles, setConfettiParticles] = useState<Array<{ id: number; x: string; y: string; color: string; delay: number; duration: number; rotation: number }>>([])
  const [showCelebration, setShowCelebration] = useState(false)
  const prefersReducedMotion = useRef(false)
  const shuffleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const shuffleStartedRef = useRef(0)
  const idempotencyKeyRef = useRef(createIdempotencyKey())

  const getRewardColor = useCallback((index: number) => SEGMENT_COLORS[index % SEGMENT_COLORS.length], [])

  // Card count — we show a fixed set of cards (5) representing the draw
  const cardCount = 5
  const cards = Array.from({ length: cardCount }, (_, i) => i)
  const showCards = selectedIndex !== null || result === null

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
    getValidToken().then((token) => {
      if (cancelled) return
      if (!token) { clearIdentitySession(); router.replace('/info'); return }
      const sid = sessionStorage.getItem('survey_session_id') || sessionStorage.getItem('survey_response_id')
      if (!sid) { router.replace('/survey'); return }
      const shopId = sessionStorage.getItem('selected_shop_id')
      if (!shopId) { router.replace('/shop-select'); return }
      setAuthReady(true)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [hydrated, router])

  // Check for existing reward on mount
  useEffect(() => {
    if (!authReady) return
    const sid = sessionStorage.getItem('survey_session_id') || sessionStorage.getItem('survey_response_id')
    if (!sid) return
    fetchRewardResult(sid).then((res) => {
      if (res?.hasReward && res.reward) {
        setHasSpun(true)
        setResult({
          rewardName: res.reward.rewardName,
          rewardImageUrl: res.reward.rewardImageUrl,
          shopId: res.reward.shopId || '',
        })
      }
    })
  }, [authReady])

  const beginShuffle = useCallback(() => {
    shuffleStartedRef.current = Date.now()
    if (prefersReducedMotion.current) return
    if (shuffleTimerRef.current) clearInterval(shuffleTimerRef.current)
    setShuffleTick(0)
    shuffleTimerRef.current = setInterval(() => setShuffleTick(t => t + 1), SHUFFLE_BEAT_MS)
  }, [])

  const endShuffle = useCallback(() => {
    if (shuffleTimerRef.current) { clearInterval(shuffleTimerRef.current); shuffleTimerRef.current = null }
    setShuffleTick(0)
  }, [])

  const settleShuffle = useCallback(async (): Promise<void> => {
    const elapsed = Date.now() - shuffleStartedRef.current
    const budget = prefersReducedMotion.current ? 0 : MIN_SHUFFLE_MS
    const remaining = budget - elapsed
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining))
    endShuffle()
  }, [endShuffle])

  useEffect(() => () => {
    if (shuffleTimerRef.current) clearInterval(shuffleTimerRef.current)
  }, [])

  const spawnConfetti = useCallback(() => {
    if (prefersReducedMotion.current) return
    const particles = Array.from({ length: 40 }, (_, i) => ({
      id: i, x: `${10 + (i * 137) % 80}%`, y: `${-5 + (i % 5) * 2}%`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: (i % 8) * 0.05, duration: 2 + (i % 5) * 0.4, rotation: Math.random() * 360,
    }))
    setConfettiParticles(particles)
    setShowCelebration(true)
  }, [])

  useEffect(() => {
    if (!showCelebration) return
    const timer = setTimeout(() => { setConfettiParticles([]); setShowCelebration(false) }, 4000)
    return () => clearTimeout(timer)
  }, [showCelebration])

  const handleCardTap = (index: number) => {
    if (spinning || hasSpun || result !== null) return
    setSelectedIndex(index)
    void draw()
  }

  const draw = async () => {
    if (spinning || hasSpun) return
    const sid = sessionStorage.getItem('survey_session_id') || sessionStorage.getItem('survey_response_id')
    if (!sid) { router.replace('/survey'); return }

    setSpinning(true)
    setError('')
    beginShuffle()

    const recoverAuth = () => {
      endShuffle(); setSpinning(false); clearIdentitySession(); router.replace('/info')
    }

    try {
      const token = await getValidToken()
      if (!token) { recoverAuth(); return }

      const allocation = await allocateReward(sid, idempotencyKeyRef.current, `card_${selectedIndex ?? 0}`)

      if (allocation.kind === 'ERROR') {
        endShuffle(); setSpinning(false); setSelectedIndex(null)
        setError(allocation.error || 'Failed to allocate reward')
        return
      }

      if (allocation.kind === 'NO_ELIGIBLE_REWARD') {
        await settleShuffle()
        setSpinning(false); setSelectedIndex(null)
        setError('No eligible rewards are currently available for this shop.')
        return
      }

      if (allocation.kind === 'NO_REWARD') {
        await settleShuffle()
        setSpinning(false); setSelectedIndex(null)
        setHasSpun(true)
        setResult({ rewardName: 'No reward', rewardImageUrl: null, shopId: allocation.shopId || '' })
        return
      }

      // REWARD_ASSIGNED or DUPLICATE
      await settleShuffle()
      setSpinning(false)
      setHasSpun(true)
      const name = allocation.rewardName || 'Reward'
      const imageUrl = allocation.rewardImageUrl || null
      const shopId = allocation.shopId || sessionStorage.getItem('selected_shop_id') || ''
      setResult({ rewardName: name, rewardImageUrl: imageUrl, shopId })
      sessionSet('user_reward_id', allocation.winId || '')
      sessionSet('reward_name', name)
      spawnConfetti()
      showToast(`Congratulations! You won: ${name}!`, 'success', 5000)
    } catch {
      endShuffle(); setSpinning(false); setSelectedIndex(null)
      setError('Connection error. Please try again.')
    }
  }

  const handleDone = () => { router.push('/reward-result') }

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

  if (hasSpun && result) {
    // Show result inline
    return (
      <div className="min-h-screen bg-navy text-fg-bright relative overflow-hidden">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[400px] rounded-full bg-gold/[0.08] blur-[120px] animate-orb-drift" />
        <Header title="Reward" backHref="/shop-select" />
        <div className="relative mx-auto max-w-xl px-4 py-8 pb-20">
          {confettiParticles.length > 0 && (
            <div className="confetti-explosion-container absolute inset-0 pointer-events-none z-30">
              {confettiParticles.map((particle) => (
                <span key={particle.id} className="confetti-explode" style={{
                  left: particle.x, top: particle.y,
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
          <div className="relative rounded-[1.75rem] border border-gold/30 bg-surface/95 backdrop-blur p-8 text-center overflow-hidden animate-reveal-in shadow-card mx-auto max-w-md animate-celebration">
            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
            <span className="inline-block px-3 py-1 rounded-full border border-gold/30 bg-gold/10 text-[10px] tracking-[0.3em] uppercase text-gold mb-4">Reward</span>
            <h3 className="font-display text-3xl font-bold gold-text mb-2 animate-pop">Congratulations!</h3>
            <p className="text-fg-secondary mb-5">You won</p>
            <div className="relative mx-auto mb-5 w-28 h-28 sm:w-32 sm:h-32">
              <div className="absolute inset-0 rounded-3xl bg-gold/20 blur-lg animate-celebration" />
              <div className="relative w-full h-full rounded-3xl border border-gold/40 bg-gradient-to-br from-gold/25 to-transparent flex items-center justify-center animate-spring-pop">
                {result.rewardImageUrl ? (
                  <Image src={result.rewardImageUrl} alt={result.rewardName} width={224} height={224} className="w-full h-full object-cover rounded-3xl" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                ) : (
                  <span className="text-5xl sm:text-6xl font-bold text-gold">{result.rewardName.charAt(0)}</span>
                )}
              </div>
            </div>
            <p className="font-display text-xl sm:text-2xl font-bold text-white mb-1">{result.rewardName}</p>
            <p className="text-xs text-fg-muted mb-6">Reward assigned</p>
            <button onClick={handleDone} className="w-full py-4 bg-gold-gradient text-brand-emerald rounded-2xl font-bold text-lg shadow-gold hover:shadow-gold-lg hover:scale-[1.01] transition-all inline-flex items-center justify-center gap-2">
              View Result
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy text-fg-bright relative overflow-hidden">
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[400px] rounded-full bg-gold/[0.08] blur-[120px] animate-orb-drift" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[360px] h-[360px] rounded-full bg-brand-emeraldLight/50 blur-[110px] animate-orb-drift" style={{ animationDelay: '-4s' }} />
      <Header title="Lucky Draw" backHref="/shop-select" />

      <div className="relative mx-auto max-w-xl px-4 py-8 pb-20">
        <div className="text-center mb-7 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <span className="inline-block px-3 py-1 rounded-full border border-gold/30 bg-gold/10 text-[10px] tracking-[0.3em] uppercase text-gold mb-3">Reward Selection</span>
          <h2 className="font-display text-3xl font-bold gold-text">Lucky Draw</h2>
          <p className="text-fg-secondary mt-2">Pick a card to reveal your reward</p>
        </div>

        {error && (
          <div className="mb-5 bg-error/10 border border-error/30 rounded-xl p-4 flex items-start gap-3 animate-fade-in">
            <svg className="w-5 h-5 text-error mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        {showCards && (
          <div
            className="grid gap-3 sm:gap-4 mb-6 mx-auto w-full max-w-md"
            style={{ gridTemplateColumns: `repeat(${columnsFor(cardCount)}, minmax(0, 1fr))` }}
            role="group"
            aria-label="Pick a card"
          >
            {cards.map((index) => {
              const isRevealed = result !== null && selectedIndex === index
              const isSelected = selectedIndex === index
              const isDealing = spinning && result === null
              const shuffle = isDealing ? shuffleOffset(shuffleTick, index) : null
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleCardTap(index)}
                  disabled={spinning || hasSpun || result !== null}
                  aria-pressed={isSelected}
                  className={[
                    'card-draw',
                    isRevealed ? 'is-revealed' : '',
                    isSelected ? 'is-selected' : '',
                    isDealing ? 'is-dealing' : '',
                  ].filter(Boolean).join(' ')}
                  style={shuffle ? { transform: `translate(${shuffle.x}px, ${shuffle.y}px) rotate(${shuffle.rot}deg)` } : undefined}
                >
                  <span className="card-inner">
                    <span className="card-face card-back">
                      <Image src="/myanmarbeerstout.png" alt="" width={160} height={160} className="card-logo" />
                      <span className="card-back-ring" aria-hidden="true" />
                    </span>
                    <span className="card-face card-front">
                      {isRevealed && result && (
                        result.rewardImageUrl ? (
                          <Image src={result.rewardImageUrl} alt="" width={160} height={160} className="card-reward-img" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                        ) : (
                          <span className="card-initial" style={{ color: getRewardColor(0) }}>{result.rewardName.charAt(0)}</span>
                        )
                      )}
                      {isRevealed && result && (
                        <span className="card-reward-name">{result.rewardName}</span>
                      )}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex justify-center">
          {spinning ? (
            <span className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl border border-gold/30 bg-gold/10 text-gold text-sm font-semibold">
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Dealing...
            </span>
          ) : hasSpun ? (
            <span className="px-5 py-3 rounded-2xl border border-white/10 bg-white/[0.04] text-fg-muted text-sm font-semibold">
              Already drawn
            </span>
          ) : (
            <span className="px-5 py-3 rounded-2xl border border-white/10 bg-white/[0.04] text-fg-secondary text-sm">
              Pick a card
            </span>
          )}
        </div>
      </div>
    </div>
  )
}