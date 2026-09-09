'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'

const API_BASE = 'http://localhost:8787'

interface Reward {
  id: string
  name: string
  weight: number
  color: string
}

const COLORS = ['#FFD700', '#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#E91E63', '#00BCD4']

export default function SpinPage() {
  const { t, language } = useLanguage()
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [rotation, setRotation] = useState(0)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasSpun, setHasSpun] = useState(false)
  const wheelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchRewards()
  }, [])

  async function fetchRewards() {
    try {
      const res = await fetch(`${API_BASE}/rewards?lang=${language}`)
      const data = await res.json()

      if (data.success && data.data.length > 0) {
        setRewards(data.data.map((r: any, i: number) => ({
          id: r.id,
          name: r.name,
          weight: r.weight || 10,
          color: COLORS[i % COLORS.length],
        })))
      } else {
        // Fallback rewards
        setRewards([
          { id: '1', name: 'Umbrella', weight: 30, color: '#FFD700' },
          { id: '2', name: 'Keychain', weight: 25, color: '#4CAF50' },
          { id: '3', name: 'T-Shirt', weight: 20, color: '#2196F3' },
          { id: '4', name: 'Cap', weight: 15, color: '#FF9800' },
          { id: '5', name: 'Sticker', weight: 10, color: '#9C27B0' },
        ])
      }
    } catch (err) {
      // Use fallback rewards
      setRewards([
        { id: '1', name: 'Umbrella', weight: 30, color: '#FFD700' },
        { id: '2', name: 'Keychain', weight: 25, color: '#4CAF50' },
        { id: '3', name: 'T-Shirt', weight: 20, color: '#2196F3' },
        { id: '4', name: 'Cap', weight: 15, color: '#FF9800' },
        { id: '5', name: 'Sticker', weight: 10, color: '#9C27B0' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const spin = async () => {
    if (spinning || hasSpun) return
    
    setSpinning(true)
    setError('')

    try {
      const token = localStorage.getItem('survey_token')
      const res = await fetch(`${API_BASE}/rewards/spin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          campaignId: 'default',
          productId: 'prod-1',
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
        const totalWeight = rewards.reduce((sum, r) => sum + r.weight, 0)
        let cumulative = 0
        let targetIndex = 0
        for (let i = 0; i < rewards.length; i++) {
          cumulative += rewards[i].weight
          if (rewards[i].id === serverReward.rewardId) {
            targetIndex = i
            break
          }
        }

        const segmentAngle = 360 / rewards.length
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
        setError(data.error?.message || 'Spin failed')
      }
    } catch (err) {
      setSpinning(false)
      setError('Connection failed')
    }
  }

  const handleClaim = () => {
    window.location.href = '/delivery'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-800 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-blue-200">{t('loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-800 text-white">
      <Header title={t('spinTitle')} backHref="/survey" />
      
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-yellow-300 mb-2">{t('spinTitle')}</h2>
          <p className="text-blue-200">{t('spinDesc')}</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-sm text-red-200 mb-4">
            {error}
          </div>
        )}

        {/* Spin Wheel */}
        <div className="relative w-72 h-72 mx-auto mb-8">
          {/* Pointer */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
            <div className="w-0 h-0 border-l-[15px] border-r-[15px] border-t-[25px] border-l-transparent border-r-transparent border-t-yellow-400" />
          </div>
          
          {/* Wheel */}
          <div 
            ref={wheelRef}
            className="w-full h-full rounded-full border-4 border-yellow-400 overflow-hidden transition-transform duration-[4000ms] ease-out"
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
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
              <span className="text-2xl">MB</span>
            </div>
          </div>
        </div>

        {/* Spin Button or Result */}
        {result ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 text-center">
            <h3 className="text-2xl font-bold text-yellow-300 mb-2">{t('congratulations')}</h3>
            <p className="text-blue-200 mb-4">{t('youWon')}</p>
            <div className="bg-yellow-500/20 rounded-xl p-4 mb-6">
              <span className="text-xl font-bold text-yellow-300">{result.name}</span>
            </div>
            <button
              onClick={handleClaim}
              className="w-full py-4 bg-yellow-500 text-blue-900 rounded-xl font-bold hover:bg-yellow-400 transition-all"
            >
              {t('claimReward')}
            </button>
          </div>
        ) : (
          <button
            onClick={spin}
            disabled={spinning || hasSpun}
            className={`w-full py-6 rounded-xl font-bold text-xl transition-all ${
              spinning || hasSpun
                ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                : 'bg-yellow-500 text-blue-900 hover:bg-yellow-400 hover:scale-105'
            }`}
          >
            {spinning ? t('spinning') : hasSpun ? (language === 'my' ? 'လှည့်ပြီးပါပြီ' : 'Already Spun') : t('spinButton')}
          </button>
        )}
      </div>
    </div>
  )
}