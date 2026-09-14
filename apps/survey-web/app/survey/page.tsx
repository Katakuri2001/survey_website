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

  // Get product ID from URL or resolve the first active product
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
        if (!cancelled) setLoading(false)
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
        // Store response ID for spin
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

  // Calculate progress
  const progress = reviewMode ? 100 : ((currentQuestion + 1) / Math.max(questions.length, 1)) * 100
  const currentQ = questions[currentQuestion]
  // Determine if can go back
  const canGoBack = currentQuestion > 0 || reviewMode

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary min-h-screen">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-16 h-16 bg-accent-gold rounded-full flex items-center justify-center mx-auto mb-4">
            <img src="/logo.png" alt="MB" className="w-full h-full object-cover rounded-full" />
          </div>
          <p className="text-sm text-text-secondary">{t('loading')}</p>
        </div>
      </div>
    )
  }

  // Review mode
  if (reviewMode) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <Header
          title={t('surveyTitle')}
          backHref="/survey"
          showBack={currentQuestion > 0}
        />
        {error && <div className="mx-auto max-w-lg px-4 py-3 mb-4 bg-error/10 text-error rounded-xl text-sm">{error}</div>}
        <div className="min-h-screen p-4 md:p-6">
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-accent-warm mb-3">{t('reviewAnswers')}</h2>
              <p className="text-text-secondary mb-6">Please review your answers before submitting</p>
            </div>

            <div className="space-y-3">
              {questions.map((q, i) => {
                const answer = answers[q.id]
                let displayAnswer = ''

                if (answer) {
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
                  <div key={q.id} className="bg-bg-surface rounded-xl p-5 border border-border mb-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-bg-surface flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-text-primary">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-text-primary font-medium mb-1 truncate">{q.question_text}</p>
                        {displayAnswer && <p className="text-text-secondary text-sm mb-1">{displayAnswer}</p>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-8 flex gap-3 justify-end">
              <button
                onClick={handlePrev}
                disabled={currentQuestion === 0 && !reviewMode}
                className="px-4 py-2 bg-white/10 text-text-secondary rounded-lg hover:bg-bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('back')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-3 bg-accent-gold text-bg-primary rounded-xl font-bold hover:bg-accent-warm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? t('loading') : t('submit')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header
        title={t('surveyTitle')}
        backHref="/info"
        showBack={currentQuestion > 0}
      />

      {error && <div className="mx-auto max-w-2xl px-4 py-3 mb-4 bg-error/10 text-error rounded-xl text-sm">{error}</div>}

      <div className="bg-bg-surface rounded-2xl p-4 mb-6 border border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-text-secondary">{t('question')} {currentQuestion + 1} / {Math.max(questions.length, 1)}</span>
          <span className="text-xs font-medium text-text-secondary">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-border rounded-full overflow-hidden">
          <div 
            className="h-full bg-accent-gold rounded-full transition-all duration-300" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-bg-surface rounded-2xl p-6 border border-border">
          <h2 className="text-xl font-bold text-accent-warm mb-6">{currentQ?.question_text}</h2>

          {currentQ?.question_type === 'text' ? (
            <div>
              <textarea
                value={(answers[currentQ.id]?.value as string) || ''}
                onChange={(e) => handleTextChange(currentQ.id, e.target.value)}
                className="w-full px-4 py-3 bg-bg-surface border border-border rounded-xl focus:border-accent-gold focus:outline-none text-text-primary resize-none min-h-[80px] placeholder-text-muted"
                placeholder={t('textPlaceholder')}
                rows={4}
              />
              <div className="mt-3 text-xs text-text-secondary">
                {answers[currentQ.id]?.value ? `${(answers[currentQ.id].value as string).length} / 500` : '0 / 500'}
              </div>
            </div>
          ) : currentQ?.question_type === 'rating' ? (
            <div className="flex items-center gap-4 mb-6">
              <p className="text-text-secondary">How do you rate this product?</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(rating => (
                  <button
                    key={rating}
                    onClick={() => handleRating(currentQ.id, rating)}
                    aria-label={`${rating} out of 5`}
                    aria-pressed={answers[currentQ.id]?.value && Number(answers[currentQ.id].value) >= rating}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-bold transition-all ${
                      answers[currentQ.id]?.value && Number(answers[currentQ.id].value) >= rating
                        ? 'bg-accent-gold text-bg-primary'
                        : 'bg-bg-surface border-border hover:bg-accent-gold/20 hover:text-accent-gold'
                    }`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-text-secondary">
                Very dissatisfied · Very satisfied
              </p>
            </div>
          ) : currentQ?.question_type === 'yes_no' ? (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => handleSelect(currentQ.id, 'yes', 'yes_no')}
                className={`w-full rounded-2xl p-5 flex items-center justify-center gap-3 ${
                  answers[currentQ.id]?.value === 'yes'
                    ? 'bg-accent-gold/20 border-accent-gold text-accent-gold'
                    : 'bg-bg-surface border-border text-text-secondary hover:bg-accent-gold/20 hover:text-accent-gold'
                }`}>
                  <svg className="w-5 h-5 text-accent-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Yes</span>
                </button>
                <button
                  onClick={() => handleSelect(currentQ.id, 'no', 'yes_no')}
                  className={`w-full rounded-2xl p-5 flex items-center justify-center gap-3 ${
                    answers[currentQ.id]?.value === 'no'
                      ? 'bg-accent-gold/20 border-accent-gold text-accent-gold'
                      : 'bg-bg-surface border-border text-text-secondary hover:bg-accent-gold/20 hover:text-accent-gold'
                  }`}>
                    <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002-2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    /></svg>
                    <span>No</span>
                </button>
            </div>
          ) : currentQ?.question_type === 'multiple_choice' ? (
            <div className="space-y-2">
              {currentQ?.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSelect(currentQ.id, option.option_value, currentQ.question_type)}
                  className={`w-full px-4 py-3 bg-bg-surface border-border rounded-xl text-left transition-all hover:bg-accent-gold/20 hover:border-accent-gold/50 flex items-center gap-3 ${
                    answers[currentQ.id]?.value && (answers[currentQ.id].value as string[]).includes(option.option_value)
                      ? 'bg-accent-gold/30 border-accent-gold text-accent-gold'
                      : 'bg-bg-surface border-border hover:bg-accent-gold/20 hover:border-accent-gold/50'
                  }`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      answers[currentQ.id]?.value && (answers[currentQ.id].value as string[]).includes(option.option_value)
                        ? 'border-accent-gold bg-accent-gold'
                        : 'border-white/40'
                    }`}>
                      {(answers[currentQ.id]?.value && (answers[currentQ.id].value as string[]).includes(option.option_value)) && (
                        <svg className="w-3 h-3 text-accent-gold" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span className="flex-1 truncate">{option.option_text}</span>
                  </button>
                ))}
            </div>
          ) : currentQ?.question_type === 'single_choice' ? (
            <div className="space-y-2">
              {currentQ?.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSelect(currentQ.id, option.option_value, currentQ.question_type)}
                  className={`w-full px-4 py-3 bg-bg-surface border-border rounded-xl text-left transition-all hover:bg-accent-gold/20 hover:border-accent-gold/50 flex items-center gap-3 ${
                    answers[currentQ.id]?.value === option.option_value
                      ? 'bg-accent-gold/30 border-accent-gold text-accent-gold'
                      : 'bg-bg-surface border-border hover:bg-accent-gold/20 hover:border-accent-gold/50'
                  }`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      answers[currentQ.id]?.value === option.option_value
                        ? 'border-accent-gold bg-accent-gold'
                        : 'border-white/40'
                    }`}>
                      {(answers[currentQ.id]?.value === option.option_value) && (
                        <svg className="w-3 h-3 text-accent-gold" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span className="flex-1 truncate">{option.option_text}</span>
                  </button>
                ))}
            </div>
          ) : (
            <p className="text-text-secondary">{t('notAnswered')}</p>
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <div className="flex gap-3">
          <button
            onClick={handlePrev}
            disabled={!canGoBack}
            className="flex-1 py-3 bg-bg-surface/50 text-text-secondary rounded-lg hover:bg-bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('back')}
          </button>
          <button
            onClick={handleNext}
            className="flex-1 py-3 bg-accent-gold text-bg-primary rounded-xl font-bold hover:bg-accent-warm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentQuestion === questions.length - 1 ? t('review') : t('next')}
          </button>
        </div>
      </div>
    </div>
  )
}
