'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'
import { API_BASE } from '../lib/api'

interface Question {
  id: string
  question_type: string
  question_text: string
  is_required: boolean
  display_order: number
}

interface Answer {
  questionId: string
  type: string
  value: string | number
}

interface Taste {
  n: number
  key: string
  rating: Question | null
  desc: Question | null
}

function Star({ filled, onChoose, label }: { filled: boolean; onChoose: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-label={`${label} ${filled ? 'selected' : ''}`}
      className="group flex flex-col items-center gap-2 p-1 focus:outline-none"
    >
      <svg
        viewBox="0 0 24 24"
        className={`w-12 h-12 md:w-14 md:h-14 transition-all drop-shadow ${
          filled
            ? 'text-gold fill-gold animate-pop'
            : 'text-slate-600 fill-slate-700 group-hover:text-gold/60 group-hover:fill-gold/20'
        }`}
      >
        <path d="M12 2l2.955 6.628 7.045.636-5.38 4.715 1.657 6.886L12 17.63l-6.277 3.235 1.657-6.886L2 9.264l7.045-.636L12 2z" />
      </svg>
    </button>
  )
}

export default function SurveyPage() {
  const { t, language } = useLanguage()
  const router = useRouter()
  const [tastes, setTastes] = useState<Taste[]>([])
  const [currentTaste, setCurrentTaste] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [loading, setLoading] = useState(true)
  const [guarded, setGuarded] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [ready, setReady] = useState(false)

  const [productId, setProductId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('product')
    }
    return null
  })

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('survey_token') : null
    if (!token) {
      router.replace('/info')
      return
    }
    setGuarded(true)
  }, [router])

  useEffect(() => {
    if (!guarded || !productId) return

    if (!productId) {
      fetch(`${API_BASE}/products?lang=${language}`)
        .then(r => r.json())
        .then(data => {
          if (data.success && data.data && data.data.length > 0) {
            setProductId(data.data[0].id)
          } else {
            setProductId('prod-1')
          }
        })
        .catch(() => setProductId('prod-1'))
    }
  }, [language, productId, guarded])

  useEffect(() => {
    if (!guarded || !productId) return
    let cancelled = false

    fetch(`${API_BASE}/survey/questions/${productId}?lang=${language}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const questions: Question[] = data.success && data.data.questions ? data.data.questions : []
        const ordered = [...questions].sort((a, b) => a.display_order - b.display_order)

        const built: Taste[] = []
        for (let i = 0; i < ordered.length; i += 2) {
          const first = ordered[i]
          const second = ordered[i + 1]
          if (!first) continue
          const rating = first.question_type === 'rating' || first.question_type === 'number' ? first :
            (second && (second.question_type === 'rating' || second.question_type === 'number')) ? second : null
          const desc = second && second.question_type === 'text' ? second :
            (first.question_type === 'text' ? first : null)
          if (!rating || !desc) continue
          built.push({ n: built.length, key: `taste-${built.length + 1}`, rating, desc })
        }

        setTastes(built)
      })
      .catch(() => {
        if (cancelled) return
        setError(t('failedToLoad'))
        setTastes([])
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setTimeout(() => setReady(true), 50)
        }
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, productId, guarded])

  const handleRating = (questionId: string, rating: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: { questionId, type: 'rating', value: rating } }))
  }

  const handleTextChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { questionId, type: 'text', value } }))
  }

  const isTasteComplete = (taste: Taste): boolean => {
    const rating = taste.rating ? answers[taste.rating.id]?.value : undefined
    const desc = taste.desc ? String(answers[taste.desc.id]?.value ?? '').trim() : ''
    return rating !== undefined && rating !== '' && desc.length > 0
  }

  const handleNext = () => {
    if (currentTaste < tastes.length - 1) {
      setCurrentTaste(prev => prev + 1)
    } else {
      setReviewMode(true)
    }
  }

  const handlePrev = () => {
    if (reviewMode) {
      setReviewMode(false)
    } else if (currentTaste > 0) {
      setCurrentTaste(prev => prev - 1)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      let campaignId: string | null = null
      try {
        const campRes = await fetch(`${API_BASE}/campaigns?lang=${language}`)
        const campData = await campRes.json()
        if (campData.success && campData.data && campData.data.length > 0) {
          campaignId = campData.data[0].id
        }
      } catch { /* campaign optional */ }

      const answerArray: Answer[] = Object.values(answers)
      let userId: string | null = null
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('survey_token') : null
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]))
          if (payload.sub) userId = payload.sub
        }
      } catch { /* not logged in */ }

      const res = await fetch(`${API_BASE}/survey/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          campaignId,
          userId,
          language,
          answers: answerArray,
        })
      })
      const data = await res.json()

      if (data.success) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('survey_response_id', data.data.responseId)
          sessionStorage.setItem('survey_product_id', productId || '')
          if (campaignId) sessionStorage.setItem('survey_campaign_id', campaignId)
        }
        router.push('/spin')
      } else {
        setError(data.error?.message || t('failedToSubmit'))
      }
    } catch {
      setError(t('connectionFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const total = Math.max(tastes.length, 1)
  const progress = reviewMode ? 100 : ((currentTaste + 1) / total) * 100
  const current = tastes[currentTaste]
  const canGoBack = currentTaste > 0 || reviewMode
  const complete = current ? isTasteComplete(current) : false

  if (loading || !guarded) {
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

  if (tastes.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-navy text-fg-bright flex flex-col items-center justify-center p-6 text-center">
        <h2 className="font-display text-xl font-bold text-white mb-2">{t('surveyTitle')}</h2>
        <p className="text-fg-muted mb-6">{error || t('failedToLoad')}</p>
        <button
          onClick={() => router.push('/info')}
          className="px-6 py-3 rounded-2xl bg-gold-gradient text-brand-emerald font-bold shadow-gold"
        >
          {t('back')}
        </button>
      </div>
    )
  }

  // ================================ REVIEW ================================
  if (reviewMode) {
    return (
      <div className="min-h-screen bg-navy text-fg-bright">
        <Header title={t('surveyTitle')} backHref="/survey" showBack={currentTaste > 0} />

        <div className="relative mx-auto max-w-xl px-4 py-8">
          <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[420px] h-[260px] rounded-full bg-gold/[0.07] blur-[110px]" />

          <div className="relative text-center mb-8">
            <span className="inline-block px-3 py-1 rounded-full border border-gold/30 bg-gold/10 text-[10px] tracking-[0.3em] uppercase text-gold mb-3">03 · Review</span>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white">{t('reviewAnswers')}</h2>
            <div className="mx-auto my-4 h-px w-20 bg-gradient-to-r from-transparent via-gold to-transparent" />
          </div>

          {error && (
            <div className="mb-5 bg-error/10 border border-error/30 rounded-xl p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-error mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-3 mb-8">
            {tastes.map((taste, i) => {
              const ratingValue = taste.rating ? Number(answers[taste.rating.id]?.value ?? 0) : 0
              const descValue = taste.desc ? String(answers[taste.desc.id]?.value ?? '') : ''
              const isAnswered = ratingValue > 0 && descValue.trim().length > 0
              return (
                <div
                  key={taste.key}
                  className={`flex items-start gap-4 rounded-2xl border p-4 md:p-5 animate-fade-up ${
                    isAnswered ? 'border-gold/20 bg-surface' : 'border-white/[0.06] bg-surface/40 opacity-70'
                  }`}
                  style={{ animationDelay: `${0.04 * i}s` }}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isAnswered ? 'bg-gold/15 border border-gold/30' : 'bg-white/5'}`}>
                    <span className={`text-sm font-display font-bold ${isAnswered ? 'text-gold' : 'text-fg-muted'}`}>{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium mb-1 text-fg-bright">
                      {t('taste')} {taste.n + 1}
                    </p>
                    <p className="text-sm mb-1">
                      <span className="text-gold">{"★".repeat(ratingValue)}{"☆".repeat(5 - ratingValue)}</span>
                    </p>
                    <p className={`text-sm ${descValue ? 'text-fg-secondary' : 'text-fg-muted italic'}`}>
                      {descValue || t('notAnswered')}
                    </p>
                  </div>
                  {isAnswered && (
                    <svg className="w-5 h-5 text-success mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handlePrev}
              className="px-6 py-4 rounded-2xl border border-white/10 bg-white/[0.04] text-fg-secondary font-semibold hover:bg-white/10 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('back')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-4 bg-gold-gradient text-brand-emerald rounded-2xl font-bold text-lg shadow-gold hover:shadow-gold-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t('loading') : t('submit')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ================================ TASTE ================================
  return (
    <div className={`min-h-screen bg-navy text-fg-bright transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}>
      <Header title={t('surveyTitle')} backHref="/info" showBack={currentTaste > 0} />

      <div className="relative mx-auto max-w-xl px-4 pb-10">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[420px] h-[260px] rounded-full bg-gold/[0.06] blur-[110px]" />

        <div className="relative">
          {/* ---------- progress ---------- */}
          <div className="rounded-2xl border border-white/[0.07] bg-surface/80 backdrop-blur p-4 mb-5 mt-5">
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-3 text-sm text-fg-secondary">
                <span className="w-7 h-7 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center text-[10px] font-bold text-gold">02</span>
                {t('taste')} {currentTaste + 1} <span className="text-fg-muted">{t('of')} {total}</span>
              </span>
              <span className="text-xs font-bold text-gold px-2.5 py-1 rounded-full bg-gold/10 border border-gold/20">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gold-gradient rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.max(progress, ((currentTaste + 1) / total) * 100)}%` }}
              />
            </div>
          </div>

          {/* ---------- taste card ---------- */}
          <div className="rounded-[1.75rem] border border-white/[0.08] bg-surface/90 backdrop-blur p-6 md:p-8 shadow-card relative overflow-hidden animate-fade-up">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />

            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] tracking-[0.3em] uppercase text-gold/80">
                {t('tasteTest')} · {t('taste')} {String(currentTaste + 1).padStart(2, '0')}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-warning px-2.5 py-1 rounded-full bg-warning/10 border border-warning/30">
                {t('required')}
              </span>
            </div>

            <h2 className={`font-display text-xl md:text-2xl font-bold text-white mb-2 leading-snug ${language === 'my' ? 'font-myanmar' : ''}`}>
              {t('taste')} {currentTaste + 1}
            </h2>

            {/* rating */}
            {current?.rating && (
              <div className="mt-4">
                <p className={`text-sm text-fg-muted mb-3 ${language === 'my' ? 'font-myanmar' : ''}`}>{current.rating.question_text}</p>
                <div className="flex items-center justify-center gap-2 md:gap-3" key={String(answers[current.rating.id]?.value ?? '')}>
                  {[1, 2, 3, 4, 5].map(rating => (
                    <Star
                      key={rating}
                      filled={!!answers[current.rating.id]?.value && Number(answers[current.rating.id].value) >= rating}
                      onChoose={() => handleRating(current.rating!.id, rating)}
                      label={`${rating}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* description */}
            {current?.desc && (
              <div className="mt-6">
                <p className={`text-sm text-fg-muted mb-3 ${language === 'my' ? 'font-myanmar' : ''}`}>{current.desc.question_text}</p>
                <textarea
                  value={(answers[current.desc.id]?.value as string) || ''}
                  onChange={(e) => handleTextChange(current.desc!.id, e.target.value)}
                  className="survey-input resize-none min-h-[120px] leading-relaxed"
                  placeholder={t('textPlaceholder')}
                  rows={4}
                  required
                />
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className={`flex items-center gap-1.5 ${complete ? 'text-success' : 'text-fg-muted'}`}>
                    {complete && (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {complete ? t('answered') : t('notAnswered')}
                  </span>
                  <span className="text-fg-muted">
                    {answers[current.desc.id]?.value ? `${(answers[current.desc.id].value as string).length} / 500` : '0 / 500'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ---------- nav ---------- */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={handlePrev}
              disabled={!canGoBack}
              aria-label={t('back')}
              className="w-14 h-14 rounded-2xl border border-white/10 bg-white/[0.04] text-fg-secondary hover:bg-white/10 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center justify-center"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              disabled={!complete}
              className="group flex-1 py-4 bg-lager-gradient text-white rounded-2xl font-bold text-lg shadow-lager hover:shadow-lager-lg hover:scale-[1.01] transition-all inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {currentTaste === tastes.length - 1 ? t('review') : t('next')}
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5-5 5M6 12h12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}