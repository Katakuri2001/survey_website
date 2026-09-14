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

const COLORS = ['#FFD700', '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#E91E63', '#00BCD4']

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

  // Intro animation when page first loads and hasn't spun yet
  useEffect(() => {
    // Simple fade-in on first render
    const timeout = setTimeout(() => {
      // No blocking animation - just ensure content is visible
    }, 500)
    return () => clearTimeout(timeout)
  }, [])

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
        // Find matching local reward for display
        const displayReward = rewards.find(r => r.id === serverReward.rewardId) || {
          id: serverReward.rewardId,
          name: serverReward.rewardName,
          weight: 10,
          color: '#FFD700',
        }

        // Calculate rotation to land on the reward
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
          // Store for delivery page
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
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="w-16 h-16 bg-accent-gold rounded-full flex items-center justify-center mx-auto mb-4">
          <img src="/logo.png" alt="MB" className="w-full h-full object-cover rounded-full" />
        </div>
        <p className="text-text-secondary">{t('loading')}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header
        title={t('spinTitle')}
        backHref="/survey"
      />
      
      <div className="min-h-screen p-4 md:p-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-accent-warm mb-2">{t('spinTitle')}</h2>
          <p className="text-text-secondary">{t('spinDesc')}</p>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/30 rounded-xl p-4 mb-4">
            <p className="text-error text-sm">{error}</p>
          </div>
        )}

        {/* Reward Preview */}
        {rewards.length > 0 && (
          <div className="bg-bg-surface rounded-2xl p-6 mb-6 border border-border max-w-md mx-auto">
            <h3 className="text-lg font-bold text-accent-warm mb-3">{t('yourReward')}</h3>
            <div className="flex flex-col items-center gap-3">
              {rewards.map((reward, i) => (
                <div
                  key={reward.id}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    i === 0 ? 'bg-accent-gold/20 border-accent-gold' : 'bg-bg-surface border-border'
                  } ${spinning || hasSpun ? '' : 'transition-colors cursor-pointer hover:bg-accent-gold/20'}`}
                  onClick={() => {/* Could preview reward */}}
                >
                  <span className={`text-2xl ${reward.color}`}>⭐</span>
                </div>
              ))}
              <p className="text-xs text-text-secondary">Tap to spin</p>
            </div>
          </div>
        )}

        {/* Spin Wheel */}
        {rewards.length > 0 && (
          <div className="relative w-80 h-80 mx-auto mb-8">
            {/* Pointer */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
              <div className="w-0 h-0 border-l-[20px] border-r-[20px] border-t-[30px] border-l-transparent border-r-transparent border-t-accent-gold" />
            </div>
            
            {/* Wheel */}
            <div 
              ref={wheelRef}
              className="w-full h-full rounded-full border-4 border-accent-gold overflow-hidden transition-transform duration-5000 ease-out"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              {rewards.map((reward, index) => {
                const segmentAngle = 360 / rewards.length
                const startAngle = index * segmentAngle
                return (
                  <div
                    key={reward.id}
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((startAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((startAngle + segmentAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle + segmentAngle - 90) * Math.PI / 180)}%)`,
                      backgroundColor: reward.color,
                    }}
                  >
                    <span className="text-xs font-bold text-white transform -rotate-90 whitespace-nowrap">
                      {reward.name}
                    </span>
                  </div>
                )
              })}
            </div>
            
            {/* Center circle */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-bg-primary rounded-full flex items-center justify-center shadow-2xl">
                <img src="/logo.png" alt="MB" className="w-full h-full object-cover rounded-full" />
              </div>
            </div>
          </div>
        )}

        {/* Spin Button or Result */}
        {result ? (
          <div className="bg-bg-surface rounded-2xl p-8 md:p-10 text-center border border-border max-w-md mx-auto">
            <h3 className="text-3xl font-bold text-accent-warm mb-3">{t('congratulations')}</h3>
            <p className="text-text-secondary mb-4">{t('youWon')}</p>
            
            <div className="w-24 h-24 bg-accent-gold/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <span className={`text-4xl ${result.color} font-bold`}>{result.name.charAt(0)}</span>
            </div>
            
            <p className="text-2xl text-accent-gold mb-6">{result.name}</p>
            
            {/* Confetti effect placeholder - simple checkmark */}
            <div className="w-16 h-16 bg-accent-gold/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-accent-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <p className="text-text-secondary mb-8">Your reward has been added to your account!</p>
            
            <button
              onClick={handleClaim}
              className="w-full py-3 bg-accent-gold text-bg-primary rounded-xl font-bold hover:bg-accent-warm transition-all"
            >
              {t('claimReward')}
            </button>
          </div>
        ) : (
          <button
            onClick={spin}
            disabled={spinning || hasSpun}
            className={`w-full py-6 rounded-3xl font-bold text-lg transition-all ${
              spinning || hasSpun
                ? 'bg-bg-surface text-text-secondary cursor-not-allowed'
                : 'bg-accent-gold text-bg-primary hover:bg-accent-warm hover:scale-105'
            }`}
          >
            {spinning ? t('spinning') : hasSpun ? t('alreadySpun') : t('spinButton')}
          </button>
        )}
      </div>
    </div>
  )
}
