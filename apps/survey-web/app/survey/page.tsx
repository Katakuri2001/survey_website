'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'
import { API_BASE } from '../lib/api'
import { useHydrated } from '../lib/useHydrated'
import Image from 'next/image'

interface Option {
  id: string
  option_value: string
  option_text: string
  display_order: number
}

interface Question {
  id: string
  question_type: string
  question_text: string
  is_required: boolean
  display_order: number
  validation_rules: string | null
  options?: Option[]
  image_url?: string | null
  product_type?: string | null
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
  const [questions, setQuestions] = useState<Question[]>([])
  const [products, setProducts] = useState<Record<string, { name: string; image_url?: string | null }>>({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [loading, setLoading] = useState(true)
  const guarded = useHydrated()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState(false)
  const questionsRef = useRef<Question[]>([])

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
    }
  }, [router])

  useEffect(() => {
    if (!guarded) return
    if (!productId) {
      fetch(`${API_BASE}/products?lang=${language}`, { cache: 'no-store' })
        .then(r => r.json())
        .then(data => {
          if (data.success && data.data && data.data.length > 0) {
            setProductId(data.data[0].id)
          } else {
            setProductId('beer')
          }
        })
        .catch(() => setProductId('beer'))
    }
  }, [language, productId, guarded])

  useEffect(() => {
    if (!guarded || !productId) return
    let cancelled = false
    let initialDone = false

    const loadQuestions = (silent: boolean, forceRefresh = false) => {
      fetch(`${API_BASE}/survey/questions/${productId}?lang=${language}`, { cache: 'no-store' })
        .then(r => r.json())
        .then(data => {
          if (cancelled) return
          const qs: Question[] = data.success && data.data.questions ? data.data.questions : []
          const ordered = [...qs].sort((a, b) => a.display_order - b.display_order)
          if (silent && forceRefresh) {
            // Real-time sync: tell the user when admin changed the survey
            const prev = questionsRef.current
            const changed =
              ordered.length !== prev.length ||
              ordered.some((q, i) => prev[i]?.id !== q.id) ||
              ordered.some((q, i) => q.question_text !== prev[i]?.question_text)
            if (changed) {
              setNotice(true)
              setTimeout(() => setNotice(false), 4000)
            }
          }
          questionsRef.current = ordered
          setQuestions(ordered)
          // Drop answers for questions the admin removed/deactivated, keep the rest
          setAnswers(prev => {
            const keep: Record<string, Answer> = {}
            for (const q of ordered) {
              if (prev[q.id]) keep[q.id] = prev[q.id]
            }
            return keep
          })
        })
        .catch(() => {
          if (cancelled) return
          if (!silent) {
            setError(t('failedToLoad'))
            setQuestions([])
          }
        })
        .finally(() => {
          if (cancelled) return
          if (!initialDone) {
            initialDone = true
            setLoading(false)
            setTimeout(() => setReady(true), 50)
          }
        })
    }

    loadQuestions(false)

    const onVisible = () => {
      if (document.visibilityState === 'visible' && initialDone) loadQuestions(true, true)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    // Live polling so admin add/remove reflects in real time while the form is open
    const pollId = window.setInterval(() => {
      if (!submitting) loadQuestions(true, true)
    }, 12000)

    return () => {
      cancelled = true
      window.clearInterval(pollId)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, productId, guarded])

  useEffect(() => {
    if (!guarded) return
    fetch(`${API_BASE}/products?lang=${language}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          const map: Record<string, { name: string; image_url?: string | null }> = {}
          for (const p of data.data) map[p.id] = { name: p.name, image_url: p.image_url }
          setProducts(map)
        }
      })
      .catch(() => {})
  }, [language, guarded])

  const handleChoice = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { questionId, type: 'single_choice', value } }))
  }

  const handleMultiChoice = (questionId: string, value: string) => {
    setAnswers(prev => {
      const current = (prev[questionId]?.value as string[]) || []
      const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
      return { ...prev, [questionId]: { questionId, type: 'multiple_choice', value: next } }
    })
  }

  const handleRating = (questionId: string, rating: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: { questionId, type: 'rating', value: rating } }))
  }

  const handleTextChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { questionId, type: 'text', value } }))
  }

  const handleYesNo = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { questionId, type: 'yes_no', value } }))
  }

  const idx = questions.length > 0 ? Math.min(currentIdx, questions.length - 1) : 0

  const isQuestionComplete = (q: Question): boolean => {
    if (!q.is_required) return true
    const a = answers[q.id]
    if (!a) return false
    switch (q.question_type) {
      case 'rating':
        return typeof a.value === 'number' && a.value >= 1
      case 'text':
      case 'long_text':
        return typeof a.value === 'string' && a.value.trim().length > 0
      case 'single_choice':
        return typeof a.value === 'string' && a.value.length > 0
      case 'multiple_choice':
        return Array.isArray(a.value) && a.value.length > 0
      case 'yes_no':
        return typeof a.value === 'string' && (a.value === 'yes' || a.value === 'no')
      default:
        return false
    }
  }

  const canProceed = questions.length > 0 && questions.every(q => q.is_required ? isQuestionComplete(q) : true)

  const handleNext = () => {
    if (idx < questions.length - 1) {
      setCurrentIdx(prev => prev + 1)
    } else {
      setReviewMode(true)
    }
  }

  const handlePrev = () => {
    if (reviewMode) {
      setReviewMode(false)
    } else if (idx > 0) {
      setCurrentIdx(prev => prev - 1)
    }
  }

  const handleSubmit = async () => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('survey_submitting')) return;
    if (typeof window !== 'undefined') sessionStorage.setItem('survey_submitting', '1');
    setSubmitting(true);
    try {
      let campaignId: string | null = null
      try {
        const campRes = await fetch(`${API_BASE}/campaigns?lang=${language}`)
        const campData = await campRes.json()
        if (campData.success && campData.data && campData.data.length > 0) {
          campaignId = campData.data[0].id
        }
      } catch { /* campaign optional */ }

      let userId: string | null = null
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('survey_token') : null
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]))
          if (payload.sub) userId = payload.sub
        }
      } catch { /* not logged in */ }

      const answerArray: Answer[] = Object.values(answers)
      const res = await fetch(`${API_BASE}/survey/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, campaignId, userId, language, answers: answerArray })
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
      sessionStorage.removeItem('survey_submitting');
      setSubmitting(false);
    }
  }

  const total = Math.max(questions.length, 1)
  const progress = reviewMode ? 100 : ((idx + 1) / total) * 100
  const current = questions[Math.min(idx, Math.max(questions.length - 1, 0))]
  const complete = current ? isQuestionComplete(current) : false
  const answeredCount = questions.filter(q => isQuestionComplete(q)).length

  if (loading || !guarded) {
    return (
      <div className="min-h-screen bg-navy flex flex-col items-center justify-center p-4">
        <div className="relative mb-6 animate-pop">
          <div className="absolute -inset-3 rounded-full border border-gold/30 animate-spin-slow" />
          <div className="w-16 h-16 rounded-full gold-border bg-brand-emerald overflow-hidden p-0.5">
            <Image src="/myanmarbeer.png" alt="MB" width={64} height={64} className="w-full h-full object-cover rounded-full" />
          </div>
        </div>
        <div className="h-2 w-40 rounded-full shimmer-bg" />
        <p className="text-sm text-fg-muted mt-4">{t('loading')}</p>
      </div>
    )
  }

  if (questions.length === 0 && !loading) {
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
      <div className="min-h-screen bg-navy text-fg-bright overflow-hidden">
        <Header title={t('surveyTitle')} backHref="/survey" showBack={idx > 0} />

        {notice && (
          <div className="absolute top-20 inset-x-0 z-40 flex justify-center px-4">
            <div className="flex items-center gap-2 rounded-full border border-gold/40 bg-surface/95 backdrop-blur px-4 py-2 shadow-card animate-fade-up">
              <svg className="w-4 h-4 text-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className={`text-xs text-fg-bright ${language === 'my' ? 'font-myanmar' : ''}`}>{t('surveyUpdated')}</span>
            </div>
          </div>
        )}

        <div className="relative mx-auto max-w-xl px-4 py-8">
          <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[420px] h-[260px] rounded-full bg-gold/[0.07] blur-[110px]" />

          <div className="relative text-center mb-8">
            <span className="inline-block px-3 py-1 rounded-full border border-gold/30 bg-gold/10 text-[10px] tracking-[0.3em] uppercase text-gold mb-3">03 · Review</span>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white">{t('reviewAnswers')}</h2>
            <div className="mx-auto my-4 h-px w-20 bg-gradient-to-r from-transparent via-gold to-transparent" />
            <p className="text-sm text-fg-muted">{answeredCount} / {questions.length} {t('answered')}</p>
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
              const a = answers[q.id]
              const isAnswered = isQuestionComplete(q)
              const valueText = (() => {
                if (!a) return ''
                if (q.question_type === 'rating') return '★'.repeat(Number(a.value)) + '☆'.repeat(5 - Number(a.value))
                if (q.question_type === 'multiple_choice') return Array.isArray(a.value) ? a.value.join(', ') : String(a.value)
                return String(a.value)
              })()

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
                    <p className={`font-medium mb-1 text-fg-bright ${language === 'my' ? 'font-myanmar' : ''}`}>{q.question_text}</p>
                    <p className={`text-sm ${valueText ? 'text-fg-secondary' : 'text-fg-muted italic'}`}>
                      {valueText || t('notAnswered')}
                    </p>
                    {q.question_type === 'multiple_choice' && Array.isArray(a?.value) && (a!.value as string[]).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(a!.value as string[]).map(v => (
                          <span key={v} className="text-[10px] px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20">{v}</span>
                        ))}
                      </div>
                    )}
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
              disabled={submitting || !canProceed}
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
    <div className={`min-h-screen bg-navy text-fg-bright transition-opacity duration-300 overflow-hidden ${ready ? 'opacity-100' : 'opacity-0'}`}>
      <Header title={t('surveyTitle')} backHref="/info" showBack={idx > 0} />

      {notice && (
        <div className="absolute top-20 inset-x-0 z-40 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full border border-gold/40 bg-surface/95 backdrop-blur px-4 py-2 shadow-card animate-fade-up">
            <svg className="w-4 h-4 text-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className={`text-xs text-fg-bright ${language === 'my' ? 'font-myanmar' : ''}`}>{t('surveyUpdated')}</span>
          </div>
        </div>
      )}

      <div className="relative mx-auto max-w-xl px-4 pb-10">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[420px] h-[260px] rounded-full bg-gold/[0.06] blur-[110px]" />

        <div className="relative">
          {/* ---------- progress ---------- */}
          <div className="rounded-2xl border border-white/[0.07] bg-surface/80 backdrop-blur p-4 mb-5 mt-5">
            <div className="flex items-center justify-between mb-3">
              <span className="flex items-center gap-3 text-sm text-fg-secondary">
                <span className="w-7 h-7 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center text-[10px] font-bold text-gold">02</span>
                {t('question')} {idx + 1} <span className="text-fg-muted">{t('of')} {total}</span>
              </span>
              <span className="text-xs font-bold text-gold px-2.5 py-1 rounded-full bg-gold/10 border border-gold/20">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gold-gradient rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.max(progress, ((idx + 1) / total) * 100)}%` }}
              />
            </div>
          </div>

          {/* ---------- question card ---------- */}
          {current && (
            <div className="rounded-[1.75rem] border border-white/[0.08] bg-surface/90 backdrop-blur p-6 md:p-8 shadow-card relative overflow-hidden animate-fade-up">
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />

              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] tracking-[0.3em] uppercase text-gold/80">
                  {current.question_type.replace('_', ' ')} · {String(idx + 1).padStart(2, '0')}
                </span>
                {current.is_required && (
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-warning px-2.5 py-1 rounded-full bg-warning/10 border border-warning/30">
                    {t('required')}
                  </span>
                )}
              </div>

              <h2 className={`font-display text-xl md:text-2xl font-bold text-white mb-2 leading-snug ${language === 'my' ? 'font-myanmar' : ''}`}>
                {current.question_text}
              </h2>

              {/* --- product photo card --- */}
              {current.product_type && current.product_type !== 'none' && (() => {
                const product = products[current.product_type]
                const image = current.image_url || product?.image_url || null
                const name = product?.name || t('product')
                return (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-gold/20 bg-surface/80 animate-fade-up">
                    {image && (
                      <Image
                        src={image}
                        alt={name}
                        width={384}
                        height={192}
                        className="h-48 w-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    )}
                    <div className="p-4">
                      <p className={`font-display font-bold text-white ${language === 'my' ? 'font-myanmar' : ''}`}>
                        {name}
                      </p>
                    </div>
                  </div>
                )
              })()}

              {/* --- rating --- */}
              {current.question_type === 'rating' && (
                <div className="mt-6 flex items-center justify-center gap-2 md:gap-3" key={String(answers[current.id]?.value ?? '')}>
                  {[1, 2, 3, 4, 5].map(rating => (
                    <Star
                      key={rating}
                      filled={!!answers[current.id]?.value && Number(answers[current.id].value) >= rating}
                      onChoose={() => handleRating(current.id, rating)}
                      label={`${rating}`}
                    />
                  ))}
                </div>
              )}

              {/* --- single_choice --- */}
              {current.question_type === 'single_choice' && (
                <div className="mt-5 space-y-2">
                  {(current.options || []).map(opt => {
                    const selected = answers[current.id]?.value === opt.option_value
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleChoice(current.id, opt.option_value)}
                        className={`w-full text-left rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                          selected
                            ? 'border-gold/40 bg-gold/10 text-white'
                            : 'border-white/[0.06] bg-white/[0.03] text-fg-secondary hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border mr-3 ${selected ? 'border-gold bg-gold' : 'border-slate-500'}`}>
                          {selected && <span className="h-2 w-2 rounded-full bg-brand-emerald" />}
                        </span>
                        <span className={language === 'my' ? 'font-myanmar' : ''}>{opt.option_text}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* --- multiple_choice --- */}
              {current.question_type === 'multiple_choice' && (
                <div className="mt-5 space-y-2">
                  {(current.options || []).map(opt => {
                    const selected = ((answers[current.id]?.value as string[]) || []).includes(opt.option_value)
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleMultiChoice(current.id, opt.option_value)}
                        className={`w-full text-left rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                          selected
                            ? 'border-gold/40 bg-gold/10 text-white'
                            : 'border-white/[0.06] bg-white/[0.03] text-fg-secondary hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-md border mr-3 ${selected ? 'border-gold bg-gold' : 'border-slate-500'}`}>
                          {selected && (
                            <svg className="h-3 w-3 text-brand-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <span className={language === 'my' ? 'font-myanmar' : ''}>{opt.option_text}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* --- text / long_text --- */}
              {(current.question_type === 'text' || current.question_type === 'long_text') && (
                <div className="mt-5">
                  <textarea
                    value={(answers[current.id]?.value as string) || ''}
                    onChange={(e) => handleTextChange(current.id, e.target.value)}
                    className={`survey-input resize-none min-h-[120px] leading-relaxed ${language === 'my' ? 'font-myanmar' : ''}`}
                    placeholder={t('textPlaceholder')}
                    rows={4}
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
                      {answers[current.id]?.value ? `${String(answers[current.id].value).length} / 500` : '0 / 500'}
                    </span>
                  </div>
                </div>
              )}

              {/* --- yes_no --- */}
              {current.question_type === 'yes_no' && (
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {(['yes', 'no'] as const).map(val => {
                    const selected = answers[current.id]?.value === val
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handleYesNo(current.id, val)}
                        className={`rounded-xl border py-4 text-sm font-semibold transition-all ${
                          selected
                            ? 'border-gold/40 bg-gold/10 text-white'
                            : 'border-white/[0.06] bg-white/[0.03] text-fg-secondary hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        {val === 'yes' ? 'Yes' : 'No'}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ---------- nav ---------- */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={handlePrev}
              disabled={idx === 0 && !reviewMode}
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
              {idx === questions.length - 1 ? t('review') : t('next')}
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