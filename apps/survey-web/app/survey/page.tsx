'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'
import { API_BASE } from '../lib/api'

interface Question {
  id: string
  survey_version_id: string
  question_text: string
  question_type: string
  is_required: boolean
  display_order: number
  is_active: boolean
  validation_rules: string | null
  version_title: string
  product_name: string
  option_count: number
  options?: Option[]
}

interface Option {
  id: string
  option_text: string
  option_value: string
}

interface Answer {
  questionId: string
  type: string
  value: string | number | string[]
}

function Star({ filled, onChoose, label }: { filled: boolean; onChoose: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-label={`${label} ${filled ? 'selected' : ''}`}
      className={`group flex flex-col items-center gap-2 p-1 focus:outline-none`}
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

function hasAnswer(q: Question, a: Answer | undefined): boolean {
  if (!a) return false
  if (Array.isArray(a.value)) return a.value.length > 0
  return a.value !== '' && a.value !== undefined && a.value !== null
}

export default function SurveyPage() {
  const { t, language } = useLanguage()
  const router = useRouter()
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [loading, setLoading] = useState(true)
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
  }, [language, productId])

  useEffect(() => {
    if (!productId) return
    let cancelled = false

    fetch(`${API_BASE}/survey/questions/${productId}?lang=${language}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data.success && data.data.questions) {
          setQuestions(data.data.questions)
        } else {
          setQuestions([])
        }
      })
      .catch(() => {
        if (cancelled) return
        setError(t('failedToLoad'))
        setQuestions([])
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setTimeout(() => setReady(true), 50)
        }
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, productId])

  const handleSelect = (questionId: string, optionValue: string, questionType: string) => {
    if (questionType === 'multiple_choice') {
      const current = (answers[questionId]?.value as string[]) || []
      const updated = current.includes(optionValue)
        ? current.filter(o => o !== optionValue)
        : [...current, optionValue]
      setAnswers(prev => ({ ...prev, [questionId]: { questionId, type: questionType, value: updated } }))
    } else {
      setAnswers(prev => ({ ...prev, [questionId]: { questionId, type: questionType, value: optionValue } }))
    }
  }

  const handleTextChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { questionId, type: 'text', value } }))
  }

  const handleRating = (questionId: string, rating: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: { questionId, type: 'rating', value: rating } }))
  }

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1)
    } else {
      setReviewMode(true)
    }
  }

  const handlePrev = () => {
    if (reviewMode) {
      setReviewMode(false)
    } else if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1)
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
      const answerArray = Object.values(answers)
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
          sessionStorage.setItem('survey_product_id', productId)
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

  const total = Math.max(questions.length, 1)
  const progress = reviewMode ? 100 : ((currentQuestion + 1) / total) * 100
  const currentQ = questions[currentQuestion]
  const canGoBack = currentQuestion > 0 || reviewMode
  const answered = currentQ ? hasAnswer(currentQ, answers[currentQ.id]) : false

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

  // ================================ REVIEW ================================
  if (reviewMode) {
    return (
      <div className="min-h-screen bg-navy text-fg-bright">
        <Header title={t('surveyTitle')} backHref="/survey" showBack={currentQuestion > 0} />

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
            {questions.map((q, i) => {
              const answer = answers[q.id]
              const isAnswered = hasAnswer(q, answer)
              let displayAnswer = ''

              if (answer && isAnswered) {
                if (q.question_type === 'rating') {
                  const rating = Number(answer.value)
                  const fullStars = Math.floor(rating)
                  const halfStar = rating - fullStars >= 0.5
                  let stars = ''
                  for (let j = 1; j <= 5; j++) {
                    if (j <= fullStars) stars += '★'
                    else if (j === fullStars + 1 && halfStar) stars += '½'
                    else stars += '☆'
                  }
                  displayAnswer = stars
                } else if (q.question_type === 'multiple_choice' && Array.isArray(answer.value)) {
                  displayAnswer = answer.value.map(v => {
                    const opt = q.options?.find(o => o.option_value === v)
                    return opt ? opt.option_text : v
                  }).join(', ')
                } else if (q.question_type === 'text') {
                  displayAnswer = String(answer.value) || '-'
                } else {
                  const option = q.options?.find(o => o.option_value === answer.value)
                  displayAnswer = option?.option_text || String(answer.value)
                }
              }

              return (
                <div
                  key={q.id}
                  className={`flex items-start gap-4 rounded-2xl border p-4 md:p-5 animate-fade-up ${
                    isAnswered ? 'border-gold/20 bg-surface' : 'border-white/[0.06] bg-surface/40 opacity-70'
                  }`}
                  style={{ animationDelay: `${0.04 * i}s` }}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isAnswered ? 'bg-gold/15 border border-gold/30' : 'bg-white/5'}`}>
                    <span className={`text-sm font-display font-bold ${isAnswered ? 'text-gold' : 'text-fg-muted'}`}>{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium mb-1 ${isAnswered ? 'text-fg-bright' : 'text-fg-secondary'}`}>{q.question_text}</p>
                    <p className="text-sm">
                      {isAnswered
                        ? <span className="text-gold">{displayAnswer}</span>
                        : <span className="text-fg-muted italic">{t('notAnswered')}</span>}
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
              disabled={currentQuestion === 0 && !reviewMode}
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

  // ================================ QUESTION ================================
  return (
    <div className={`min-h-screen bg-navy text-fg-bright transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0'}`}>
      <Header title={t('surveyTitle')} backHref="/info" showBack={currentQuestion > 0} />

      <div className="relative mx-auto max-w-xl px-4 pb-10">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[420px] h-[260px] rounded-full bg-gold/[0.06] blur-[110px]" />

        <div className="relative">
          {/* ---------- progress ---------- */}
          <div className="rounded-2xl border border-white/[0.07] bg-surface/80 backdrop-blur p-4 mb-5 mt-5">
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-3 text-sm text-fg-secondary">
                <span className="w-7 h-7 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center text-[10px] font-bold text-gold">02</span>
                {t('question')} {currentQuestion + 1} <span className="text-fg-muted">{t('of')} {total}</span>
              </span>
              <span className="text-xs font-bold text-gold px-2.5 py-1 rounded-full bg-gold/10 border border-gold/20">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gold-gradient rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.max(progress, (currentQuestion + 1) / total * 100)}%` }}
              />
            </div>
          </div>

          {/* ---------- question card ---------- */}
          <div className="rounded-[1.75rem] border border-white/[0.08] bg-surface/90 backdrop-blur p-6 md:p-8 shadow-card relative overflow-hidden animate-fade-up">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />

            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] tracking-[0.3em] uppercase text-gold/80">Survey · Q{String(currentQuestion + 1).padStart(2, '0')}</span>
              {currentQ?.is_required ? (
                <span className="text-[10px] font-semibold uppercase tracking-widest text-warning px-2.5 py-1 rounded-full bg-warning/10 border border-warning/30">
                  {t('required')}
                </span>
              ) : (
                <span className="text-[10px] text-fg-muted tracking-widest uppercase">Optional</span>
              )}
            </div>

            <h2 className="font-display text-xl md:text-2xl font-bold text-white mb-7 leading-snug">
              {currentQ?.question_text}
            </h2>

            <>
              {currentQ?.question_type === 'text' ? (
                <div>
                  <textarea
                    value={(answers[currentQ.id]?.value as string) || ''}
                    onChange={(e) => handleTextChange(currentQ.id, e.target.value)}
                    className="survey-input resize-none min-h-[120px] leading-relaxed"
                    placeholder={t('textPlaceholder')}
                    rows={4}
                  />
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className={`flex items-center gap-1.5 ${answered ? 'text-success' : 'text-fg-muted'}`}>
                      {answered && (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {answered ? 'Answered' : t('notAnswered')}
                    </span>
                    <span className="text-fg-muted">
                      {answers[currentQ.id]?.value ? `${(answers[currentQ.id].value as string).length} / 500` : '0 / 500'}
                    </span>
                  </div>
                </div>
              ) : currentQ?.question_type === 'rating' ? (
                <div>
                  <div className="flex items-center justify-center gap-2 md:gap-3" key={String(answers[currentQ.id]?.value ?? '')}>
                    {[1, 2, 3, 4, 5].map(rating => (
                      <Star
                        key={rating}
                        filled={!!answers[currentQ.id]?.value && Number(answers[currentQ.id].value) >= rating}
                        onChoose={() => handleRating(currentQ.id, rating)}
                        label={`${rating}`}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-fg-muted px-2">
                    <span>{t('ratingLow')}</span>
                    <span>{t('ratingHigh')}</span>
                  </div>
                </div>
              ) : currentQ?.question_type === 'yes_no' ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleSelect(currentQ.id, 'yes', 'yes_no')}
                    className={`rounded-2xl p-6 flex flex-col items-center gap-2 border-2 transition-all ${
                      answers[currentQ.id]?.value === 'yes'
                        ? 'border-gold bg-gold/15 text-gold shadow-glow'
                        : 'border-white/10 bg-surface-deep text-fg-secondary hover:border-gold/50 hover:text-gold'
                    }`}
                  >
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-display font-bold">Yes</span>
                  </button>
                  <button
                    onClick={() => handleSelect(currentQ.id, 'no', 'yes_no')}
                    className={`rounded-2xl p-6 flex flex-col items-center gap-2 border-2 transition-all ${
                      answers[currentQ.id]?.value === 'no'
                        ? 'border-gold bg-gold/15 text-gold shadow-glow'
                        : 'border-white/10 bg-surface-deep text-fg-secondary hover:border-gold/50 hover:text-gold'
                    }`}
                  >
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="font-display font-bold">No</span>
                  </button>
                </div>
              ) : currentQ?.question_type === 'multiple_choice' ? (
                <div className="space-y-2.5">
                  <p className="text-sm text-fg-muted flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('selectMultiple')}
                  </p>
                  {currentQ?.options.map(option => {
                    const selected = (answers[currentQ.id]?.value as string[])?.includes(option.option_value)
                    return (
                      <button
                        key={option.id}
                        onClick={() => handleSelect(currentQ.id, option.option_value, currentQ.question_type)}
                        className={`w-full px-5 py-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3.5 ${
                          selected
                            ? 'bg-gold/10 border-gold'
                            : 'bg-surface-deep border-white/[0.08] hover:border-gold/40'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                          selected ? 'border-gold bg-gold-gradient' : 'border-slate-500'
                        }`}>
                          {selected && (
                            <svg className="w-4 h-4 text-brand-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className={`flex-1 truncate font-medium ${selected ? 'text-gold' : 'text-fg-secondary'}`}>
                          {option.option_text}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : currentQ?.question_type === 'single_choice' ? (
                <div className="space-y-2.5">
                  <p className="text-sm text-fg-muted flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.87L3 20l1.36-3.72A7.9 7.9 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {t('selectOne')}
                  </p>
                  {currentQ?.options.map(option => {
                    const selected = answers[currentQ.id]?.value === option.option_value
                    return (
                      <button
                        key={option.id}
                        onClick={() => handleSelect(currentQ.id, option.option_value, currentQ.question_type)}
                        className={`w-full px-5 py-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3.5 ${
                          selected
                            ? 'bg-gold/10 border-gold'
                            : 'bg-surface-deep border-white/[0.08] hover:border-gold/40'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                          selected ? 'border-gold' : 'border-slate-500'
                        }`}>
                          {selected && <div className="w-3 h-3 rounded-full bg-gold-gradient animate-pop" />}
                        </div>
                        <span className={`flex-1 truncate font-medium ${selected ? 'text-gold' : 'text-fg-secondary'}`}>
                          {option.option_text}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-fg-secondary">{t('notAnswered')}</p>
              )}
            </>
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
              className="group flex-1 py-4 bg-gold-gradient text-brand-emerald rounded-2xl font-bold text-lg shadow-gold hover:shadow-gold-lg hover:scale-[1.01] transition-all inline-flex items-center justify-center gap-2"
            >
              {currentQuestion === questions.length - 1 ? t('review') : t('next')}
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