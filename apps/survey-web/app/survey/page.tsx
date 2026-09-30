'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useLanguage } from '../context/I18nProvider'
import Header from '../components/Header'
import {
  API_BASE,
  clearIdentitySession,
  getValidToken,
  markResumeTokenRecovery,
  surveyHeaders,
} from '../lib/api'
import { clearSurveyProgress, loadSurveyProgress, saveSurveyProgress } from '../lib/surveyProgress'
import { useHydrated } from '../lib/useHydrated'

interface Option {
  id: string
  option_value: string
  option_text: string
  display_order: number
}

interface QuestionCondition {
  question_id: string
  depends_on_question_id: string
  condition_type: string
  condition_value: string
}

interface Question {
  id: string
  question_type: string
  question_text: string
  is_required: boolean
  display_order: number
  validation_rules: string | null
  options?: Option[]
  conditions?: QuestionCondition[]
  image_url?: string | null
  product_type?: string | null
}

interface Answer {
  questionId: string
  type: string
  value: string | number | string[]
}

interface ValidationRules {
  required?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: string
}

function parseValidationRules(raw: Question['validation_rules']): ValidationRules {
  if (!raw) return {}
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!parsed || typeof parsed !== 'object') return {}
    const record = parsed as Record<string, unknown>
    return {
      required: typeof record.required === 'boolean' ? record.required : undefined,
      minLength: finiteRuleNumber(record.minLength ?? record.min_length),
      maxLength: finiteRuleNumber(record.maxLength ?? record.max_length),
      min: finiteRuleNumber(record.min),
      max: finiteRuleNumber(record.max),
      pattern: typeof record.pattern === 'string' ? record.pattern : undefined,
    }
  } catch {
    return {}
  }
}

function finiteRuleNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function getTextMaxLength(question: Question, rules: ValidationRules): number {
  const configured = finiteRuleNumber(rules.maxLength)
  if (configured !== undefined) return Math.max(0, Math.min(2000, Math.floor(configured)))
  const legacyMax = finiteRuleNumber(rules.max)
  if (legacyMax !== undefined) return Math.max(0, Math.min(2000, Math.floor(legacyMax)))
  return question.question_type === 'long_text' ? 2000 : 500
}

function getTextMinLength(rules: ValidationRules): number {
  const configured = finiteRuleNumber(rules.minLength)
  if (configured !== undefined) return Math.max(0, Math.floor(configured))
  const legacyMin = finiteRuleNumber(rules.min)
  if (legacyMin !== undefined) return Math.max(0, Math.floor(legacyMin))
  return 0
}

function getTextError(question: Question, value: string, rules: ValidationRules): string {
  const required = question.is_required || rules.required === true
  const trimmed = value.trim()
  if (required && trimmed.length === 0) return 'This answer is required'
  if (trimmed.length === 0) return ''

  const maxLength = getTextMaxLength(question, rules)
  const minLength = getTextMinLength(rules)
  if (value.length > maxLength) return `Please use no more than ${maxLength} characters`
  if (value.length < minLength) return `Please use at least ${minLength} characters`
  if (rules.pattern) {
    try {
      if (!new RegExp(rules.pattern).test(value)) return 'Please use the requested format'
    } catch {
      // Ignore malformed admin rules rather than making the survey unusable.
    }
  }
  return ''
}

function getRatingMax(question: Question, rules: ValidationRules): number {
  const configured = finiteRuleNumber(rules.max)
  return Math.max(1, Math.min(10, Math.floor(configured ?? 5)))
}

function getRatingMin(question: Question, rules: ValidationRules): number {
  const configured = finiteRuleNumber(rules.min)
  return Math.max(1, Math.min(getRatingMax(question, rules), Math.floor(configured ?? 1)))
}

function answerIsPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

/** Mirror of the API's condition evaluator so hidden questions are never sent. */
function conditionMatches(condition: QuestionCondition, answers: Record<string, Answer>): boolean {
  const value = answers[condition.depends_on_question_id]?.value
  const answered = answerIsPresent(value)
  if (condition.condition_type === 'answered') return answered
  if (condition.condition_type === 'not_answered') return !answered
  if (!answered) return false
  const actual = Array.isArray(value) ? value.map(String) : [String(value)]
  const expected = condition.condition_value
  switch (condition.condition_type) {
    case 'equals':
      return actual.includes(expected)
    case 'not_equals':
      return !actual.includes(expected)
    case 'contains':
      return actual.some(item => item.includes(expected))
    case 'greater_than':
      return Number(actual[0]) > Number(expected)
    case 'less_than':
      return Number(actual[0]) < Number(expected)
    default:
      return false
  }
}

function isQuestionVisible(question: Question, answers: Record<string, Answer>): boolean {
  return (question.conditions || []).every(condition => conditionMatches(condition, answers))
}

function nearestVisibleIndex(questions: Question[], visibleIds: Set<string>, from: number): number {
  for (let i = Math.max(0, from); i < questions.length; i++) {
    if (visibleIds.has(questions[i].id)) return i
  }
  for (let i = Math.min(Math.max(0, from), questions.length - 1); i >= 0; i--) {
    if (visibleIds.has(questions[i].id)) return i
  }
  return -1
}

/** An answer that carries no data must not be sent: the API rejects it. */
function isEmptyAnswer(answer: Answer): boolean {
  if (typeof answer.value === 'string') return answer.value.trim().length === 0
  if (Array.isArray(answer.value)) return answer.value.length === 0
  return answer.value === undefined || answer.value === null
}

function isAnswerComplete(question: Question, answer: Answer | undefined): boolean {
  const rules = parseValidationRules(question.validation_rules)
  const required = question.is_required || rules.required === true
  if (!answer) return !required
  if (isEmptyAnswer(answer)) return !required

  switch (question.question_type) {
    case 'rating': {
      if (typeof answer.value !== 'number' || !Number.isFinite(answer.value)) return !required
      const min = getRatingMin(question, rules)
      const max = getRatingMax(question, rules)
      return answer.value >= min && answer.value <= max
    }
    case 'number': {
      const numeric = Number(answer.value)
      if (!Number.isFinite(numeric)) return !required
      const min = finiteRuleNumber(rules.min)
      const max = finiteRuleNumber(rules.max)
      return (min === undefined || numeric >= min) && (max === undefined || numeric <= max)
    }
    case 'text':
    case 'long_text': {
      if (typeof answer.value !== 'string') return !required
      return getTextError(question, answer.value, rules) === ''
    }
    case 'single_choice':
    case 'dropdown':
      return typeof answer.value === 'string' && answer.value.length > 0
    case 'multiple_choice': {
      if (!Array.isArray(answer.value)) return !required
      const min = finiteRuleNumber(rules.min) ?? (required ? 1 : 0)
      const max = finiteRuleNumber(rules.max)
      return answer.value.length >= min && (max === undefined || answer.value.length <= max)
    }
    case 'yes_no':
      return typeof answer.value === 'string' && (answer.value === 'yes' || answer.value === 'no')
    default:
      return false
  }
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

const SUBMITTING_KEY = 'survey_submitting'
const SUBMITTING_LEASE_MS = 2 * 60 * 1000

function readSubmittingLease(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = window.sessionStorage.getItem(SUBMITTING_KEY)
    if (!raw) return false
    const startedAt = Number(raw)
    const age = Date.now() - startedAt
    if (!Number.isFinite(startedAt) || age > SUBMITTING_LEASE_MS || age < -SUBMITTING_LEASE_MS) {
      window.sessionStorage.removeItem(SUBMITTING_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

function writeSubmittingLease(): void {
  try {
    window.sessionStorage.setItem(SUBMITTING_KEY, String(Date.now()))
  } catch {
    // The in-memory ref still prevents duplicate clicks in this tab.
  }
}

function clearSubmittingLease(): void {
  try {
    window.sessionStorage.removeItem(SUBMITTING_KEY)
  } catch {
    // Ignore unavailable storage.
  }
}

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function SurveyPage() {
  const { t, language } = useLanguage()
  const router = useRouter()
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [loading, setLoading] = useState(true)
  const guarded = useHydrated()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState(false)
  const [progressRestored, setProgressRestored] = useState(false)
  const questionsRef = useRef<Question[]>([])
  const currentQuestionIdRef = useRef('')
  const submittingRef = useRef(false)
  const progressRestoredRef = useRef(false)
  const submissionEpochRef = useRef(0)
  const activePollControllerRef = useRef<AbortController | null>(null)
  const versionIdRef = useRef('')
  const productIdRef = useRef('')
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auth is checked after hydration so storage access remains static-export safe.
  useEffect(() => {
    if (!guarded) return
    // A reload cannot still have the previous JavaScript request in flight.
    // Remove old/legacy leases before enabling the submit button.
    readSubmittingLease()
    let cancelled = false
    getValidToken().then(token => {
      if (!cancelled && !token) router.replace('/info')
    })
    return () => {
      cancelled = true
    }
  }, [guarded, router])

  // Restore the local snapshot before the first question response is applied.
  useEffect(() => {
    if (!guarded || progressRestoredRef.current) return
    const progress = loadSurveyProgress()
    if (progress) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnswers(progress.answers)
      setCurrentIdx(progress.currentIdx)
      currentQuestionIdRef.current = progress.currentQuestionId
      setReviewMode(progress.reviewMode)
    }
    progressRestoredRef.current = true
    setProgressRestored(true)
  }, [guarded])

  useEffect(() => {
    if (!guarded) return
    let cancelled = false
    let initialDone = false
    let requestSequence = 0

    const loadQuestions = (silent: boolean, forceRefresh = false) => {
      // A poll that starts during submission must never mutate the form. The
      // epoch check below also protects responses that were already in flight.
      if (submittingRef.current) return
      const sequence = ++requestSequence
      const startedEpoch = submissionEpochRef.current
      const controller = new AbortController()
      activePollControllerRef.current = controller

      fetch(`${API_BASE}/survey/questions?lang=${language}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
        .then(async response => {
          const data = await response.json()
          if (!response.ok || !data?.success || !Array.isArray(data.data?.questions)) {
            throw new Error('invalid-survey-response')
          }
          return data.data as { version?: { id?: string; product_id?: string }; questions: Question[] }
        })
        .then(payload => {
          const qs = payload.questions
          if (
            cancelled ||
            sequence !== requestSequence ||
            submittingRef.current ||
            startedEpoch !== submissionEpochRef.current
          ) return

          const ordered = [...qs].sort((a, b) => a.display_order - b.display_order)
          // An empty successful payload is not evidence that the user's survey
          // was removed. Keep the last good definition and show a recoverable
          // error instead of erasing progress.
          if (ordered.length === 0) {
            if (!silent) setError(t('validation.failedToLoad'))
            return
          }

          if (silent && forceRefresh) {
            const prev = questionsRef.current
            const changed =
              ordered.length !== prev.length ||
              ordered.some((q, i) => prev[i]?.id !== q.id) ||
              ordered.some((q, i) => q.question_text !== prev[i]?.question_text)
            if (changed) {
              setNotice(true)
              if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
              noticeTimerRef.current = setTimeout(() => setNotice(false), 4000)
            }
          }

          const previousQuestionId = currentQuestionIdRef.current
          const previousIndex = ordered.findIndex(q => q.id === previousQuestionId)
          if (previousIndex >= 0) {
            setCurrentIdx(previousIndex)
          } else {
            setCurrentIdx(prev => Math.min(prev, ordered.length - 1))
          }
          questionsRef.current = ordered
          versionIdRef.current = payload.version?.id || versionIdRef.current
          productIdRef.current = payload.version?.product_id || productIdRef.current
          setQuestions(ordered)
          // Deliberately retain answers for questions that a transient poll does
          // not return. This is local progress, not a destructive reconciliation.
          setError('')
        })
        .catch(() => {
          if (cancelled || controller.signal.aborted || sequence !== requestSequence) return
          // Never replace a good question list with an error/empty list.
          if (!silent || questionsRef.current.length === 0) {
            setError(t('validation.failedToLoad'))
          }
        })
        .finally(() => {
          if (activePollControllerRef.current === controller) {
            activePollControllerRef.current = null
          }
          if (cancelled || sequence !== requestSequence) return
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
    // Live polling so admin edits reflect in real time while the form is open.
    const pollId = window.setInterval(() => loadQuestions(true, true), 12000)

    return () => {
      cancelled = true
      requestSequence += 1
      activePollControllerRef.current?.abort()
      activePollControllerRef.current = null
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
      window.clearInterval(pollId)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
    // `submittingRef` is intentionally used instead of state: changing the
    // submitting state must not tear down and recreate the polling effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, guarded])

  const visibleQuestions = questions.filter(q => isQuestionVisible(q, answers))
  const visibleIds = new Set(visibleQuestions.map(q => q.id))
  // When every question's condition currently fails there is nothing to answer;
  // the review screen becomes the effective state rather than a dead card.
  const inReview = reviewMode || (questions.length > 0 && visibleQuestions.length === 0)

  useEffect(() => {
    if (!guarded || !progressRestored || questions.length === 0) return
    const visible = new Set(questions.filter(q => isQuestionVisible(q, answers)).map(q => q.id))
    const rawIdx = Math.min(currentIdx, questions.length - 1)
    const displayedIdx = visible.has(questions[rawIdx].id)
      ? rawIdx
      : nearestVisibleIndex(questions, visible, currentIdx)
    const storedIdx = displayedIdx >= 0 ? displayedIdx : rawIdx
    const currentQuestionId = questions[storedIdx]?.id || currentQuestionIdRef.current
    currentQuestionIdRef.current = currentQuestionId
    saveSurveyProgress({ answers, currentIdx: storedIdx, currentQuestionId, reviewMode })
  }, [answers, currentIdx, guarded, progressRestored, questions, reviewMode])

  // Removed products fetch - questions now contain product_type and image_url directly

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
    const question = questionsRef.current.find(q => q.id === questionId)
    const rules = question ? parseValidationRules(question.validation_rules) : {}
    const maxLength = question ? getTextMaxLength(question, rules) : 2000
    const type = question?.question_type === 'long_text' ? 'long_text' : 'text'
    setAnswers(prev => ({
      ...prev,
      [questionId]: { questionId, type, value: value.slice(0, maxLength) },
    }))
  }

  const handleYesNo = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { questionId, type: 'yes_no', value } }))
  }

  const handleNumberChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { questionId, type: 'number', value } }))
  }

  const handleDropdown = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: { questionId, type: 'dropdown', value } }))
  }

  // Conditional logic can hide the stored question index; anchor the display to
  // the nearest visible question while keeping `currentIdx` as an index into
  // the full definition list (progress save/restore depends on that).
  const rawIdx = questions.length > 0 ? Math.min(currentIdx, questions.length - 1) : 0
  const anchoredIdx = visibleQuestions.length > 0 ? nearestVisibleIndex(questions, visibleIds, rawIdx) : -1
  const idx = anchoredIdx >= 0 ? anchoredIdx : rawIdx
  const visiblePosition = visibleQuestions.findIndex(q => q.id === questions[idx]?.id)
  const isQuestionComplete = (q: Question): boolean => isAnswerComplete(q, answers[q.id])
  const canProceed = questions.length > 0 && visibleQuestions.every(isQuestionComplete)

  let prevVisibleIdx = idx - 1
  while (prevVisibleIdx >= 0 && !visibleIds.has(questions[prevVisibleIdx].id)) prevVisibleIdx -= 1
  const hasPrevVisible = prevVisibleIdx >= 0

  const handleNext = () => {
    if (idx < questions.length - 1) {
      const next = nearestVisibleIndex(questions, visibleIds, idx + 1)
      if (next > idx && next < questions.length) {
        setCurrentIdx(next)
        currentQuestionIdRef.current = questions[next].id
        return
      }
    }
    setReviewMode(true)
  }

  const handlePrev = () => {
    if (inReview) {
      setReviewMode(false)
      return
    }
    if (hasPrevVisible) {
      setCurrentIdx(prevVisibleIdx)
      currentQuestionIdRef.current = questions[prevVisibleIdx].id
    }
  }

  const handleSubmit = async () => {
    if (submittingRef.current || readSubmittingLease()) return
    submittingRef.current = true
    submissionEpochRef.current += 1
    activePollControllerRef.current?.abort()
    writeSubmittingLease()
    setSubmitting(true)

    const failAndRecover = () => {
      clearIdentitySession()
      setError(t('validation.sessionExpired'))
      router.replace('/info')
    }

    try {
      // Refresh an expired token before submitting so a session that lapsed
      // mid-survey does not lose answers.
      let token = await getValidToken()
      if (!token) {
        failAndRecover()
        return
      }

      let campaignId: string | null = null
      try {
        const campRes = await fetch(`${API_BASE}/campaigns?lang=${language}`)
        const campData = await campRes.json()
        if (campData.success && campData.data && campData.data.length > 0) {
          campaignId = campData.data[0].id
        }
      } catch { /* campaign optional */ }

      // Stable idempotency key for this attempt: retries after a network blip
      // return the original response instead of creating a duplicate.
      let submissionRequestId: string | null = null
      try {
        submissionRequestId = window.sessionStorage.getItem('survey_submission_request_id')
      } catch { /* storage unavailable */ }
      if (!submissionRequestId) {
        submissionRequestId = newRequestId()
        try {
          window.sessionStorage.setItem('survey_submission_request_id', submissionRequestId)
        } catch { /* storage unavailable */ }
      }

      // Only currently-visible questions may be submitted: the API rejects
      // answers to hidden questions and empty values outright.
      const activeQuestionIds = new Set(visibleQuestions.map(question => question.id))
      const answerArray: Answer[] = Object.values(answers).filter(
        answer => activeQuestionIds.has(answer.questionId) && !isEmptyAnswer(answer)
      )
      const body = JSON.stringify({
        campaignId,
        productId: productIdRef.current || undefined,
        surveyVersionId: versionIdRef.current || undefined,
        language,
        submissionRequestId,
        answers: answerArray,
      })
      const send = async (authToken: string) => {
        const res = await fetch(`${API_BASE}/survey/submit`, {
          method: 'POST',
          headers: surveyHeaders({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          }),
          body,
        })
        return {
          status: res.status,
          body: await res.json().catch(() => null) as {
            success?: boolean
            data?: { responseId?: unknown }
            error?: { code?: string; message?: string }
          } | null,
        }
      }

      let result = await send(token)
      const isUnauthorized = result.status === 401 || result.body?.error?.code === 'UNAUTHORIZED'

      // A locally valid JWT can still be rejected by the API. Force one refresh
      // and retry the same idempotent request exactly once.
      if (isUnauthorized) {
        token = await getValidToken(true) || ''
        if (!token) {
          failAndRecover()
          return
        }
        result = await send(token)
      }

      if (result.status === 401 || result.body?.error?.code === 'UNAUTHORIZED') {
        failAndRecover()
        return
      }
      if (result.body?.error?.code === 'RESUME_TOKEN_REQUIRED') {
        markResumeTokenRecovery()
        clearIdentitySession()
        setError(t('validation.resumeRecoveryRequired'))
        router.replace('/info')
        return
      }

      if (result.body?.success && typeof result.body.data?.responseId === 'string' && result.body.data.responseId) {
        try {
          window.sessionStorage.setItem('survey_response_id', result.body.data.responseId)
          if (campaignId) window.sessionStorage.setItem('survey_campaign_id', campaignId)
          window.sessionStorage.removeItem('survey_submission_request_id')
        } catch { /* storage unavailable */ }
        clearSurveyProgress()
        router.push('/spin')
      } else {
        setError(result.body?.error?.message || t('validation.failedToSubmit'))
      }
    } catch {
      setError(t('validation.connectionFailed'))
    } finally {
      clearSubmittingLease()
      submittingRef.current = false
      submissionEpochRef.current += 1
      setSubmitting(false)
    }
  }

  const total = Math.max(visibleQuestions.length, 1)
  const visibleStep = Math.max(0, visiblePosition) + 1
  const progress = inReview ? 100 : (visibleStep / total) * 100
  const current = questions[Math.min(idx, Math.max(questions.length - 1, 0))]
  const currentRules = current ? parseValidationRules(current.validation_rules) : {}
  const currentTextValue = current && typeof answers[current.id]?.value === 'string'
    ? answers[current.id].value as string
    : ''
  const currentTextMaxLength = current ? getTextMaxLength(current, currentRules) : 500
  const currentTextError = current ? getTextError(current, currentTextValue, currentRules) : ''
  const currentNumberValue = current && (typeof answers[current.id]?.value === 'string' || typeof answers[current.id]?.value === 'number')
    ? String(answers[current.id].value)
    : ''
  const currentNumberMin = finiteRuleNumber(currentRules.min)
  const currentNumberMax = finiteRuleNumber(currentRules.max)
  const currentNumberError = !currentNumberValue.trim()
    ? ''
    : !Number.isFinite(Number(currentNumberValue))
      ? 'Please enter a valid number'
      : currentNumberMin !== undefined && Number(currentNumberValue) < currentNumberMin
        ? `Please enter at least ${currentNumberMin}`
        : currentNumberMax !== undefined && Number(currentNumberValue) > currentNumberMax
          ? `Please enter at most ${currentNumberMax}`
          : ''
  const ratingMax = current ? getRatingMax(current, currentRules) : 5
  const ratingMin = current ? getRatingMin(current, currentRules) : 1
  const complete = current ? isQuestionComplete(current) : false
  const hasNextVisible = nearestVisibleIndex(questions, visibleIds, idx + 1) > idx
  const answeredCount = visibleQuestions.filter(q => answers[q.id] && isQuestionComplete(q)).length

  if (loading || !guarded) {
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

  if (questions.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-navy text-fg-bright flex flex-col items-center justify-center p-6 text-center">
        <h2 className="font-display text-xl font-bold text-white mb-2">{t('survey.surveyTitle')}</h2>
        <p className="text-fg-muted mb-6">{error || t('validation.failedToLoad')}</p>
        <button
          onClick={() => router.push('/info')}
          className="px-6 py-3 rounded-2xl bg-gold-gradient text-brand-emerald font-bold shadow-gold"
        >
          {t('common.back')}
        </button>
      </div>
    )
  }

  // ================================ REVIEW ================================
  if (inReview) {
    return (
      <div className="min-h-screen bg-navy text-fg-bright overflow-hidden">
        <Header title={t('survey.surveyTitle')} backHref="/survey" showBack={idx > 0} />

        {notice && (
          <div className="absolute top-20 inset-x-0 z-40 flex justify-center px-4">
            <div className="flex items-center gap-2 rounded-full border border-gold/40 bg-surface/95 backdrop-blur px-4 py-2 shadow-card animate-fade-up">
              <svg className="w-4 h-4 text-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className={`text-xs text-fg-bright ${language === 'my' ? 'font-myanmar' : ''}`}>{t('survey.surveyUpdated')}</span>
            </div>
          </div>
        )}

        <div className="relative mx-auto max-w-xl px-4 py-8">
          <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[420px] h-[260px] rounded-full bg-gold/[0.07] blur-[110px]" />

          <div className="relative text-center mb-8">
            <span className="inline-block px-3 py-1 rounded-full border border-gold/30 bg-gold/10 text-[10px] tracking-[0.3em] uppercase text-gold mb-3">03 · Review</span>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-white">{t('survey.reviewAnswers')}</h2>
            <div className="mx-auto my-4 h-px w-20 bg-gradient-to-r from-transparent via-gold to-transparent" />
            <p className="text-sm text-fg-muted">{answeredCount} / {visibleQuestions.length} {t('survey.answered')}</p>
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
            {visibleQuestions.map((q, i) => {
              const a = answers[q.id]
              const isAnswered = isQuestionComplete(q)
              const valueText = (() => {
                if (!a) return ''
                if (q.question_type === 'rating') {
                  const rules = parseValidationRules(q.validation_rules)
                  const max = getRatingMax(q, rules)
                  return '★'.repeat(Number(a.value)) + '☆'.repeat(Math.max(0, max - Number(a.value)))
                }
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
                      {valueText || t('survey.notAnswered')}
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
              {t('common.back')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !canProceed}
              className="flex-1 py-4 bg-gold-gradient text-brand-emerald rounded-2xl font-bold text-lg shadow-gold hover:shadow-gold-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t('common.loading') : t('common.submit')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ================================ QUESTION ================================
  return (
    <div className={`min-h-screen bg-navy text-fg-bright transition-opacity duration-300 overflow-hidden ${ready ? 'opacity-100' : 'opacity-0'}`}>
      <Header title={t('survey.surveyTitle')} backHref="/info" showBack={idx > 0} />

      {notice && (
        <div className="absolute top-20 inset-x-0 z-40 flex justify-center px-4">
          <div className="flex items-center gap-2 rounded-full border border-gold/40 bg-surface/95 backdrop-blur px-4 py-2 shadow-card animate-fade-up">
            <svg className="w-4 h-4 text-gold shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className={`text-xs text-fg-bright ${language === 'my' ? 'font-myanmar' : ''}`}>{t('survey.surveyUpdated')}</span>
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
                {t('survey.question')} {visibleStep} <span className="text-fg-muted">{t('survey.of')} {total}</span>
              </span>
              <span className="text-xs font-bold text-gold px-2.5 py-1 rounded-full bg-gold/10 border border-gold/20">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gold-gradient rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.max(progress, (visibleStep / total) * 100)}%` }}
              />
            </div>
          </div>

          {/* ---------- question card ---------- */}
          {current && (
            <div className="rounded-[1.75rem] border border-white/[0.08] bg-surface/90 backdrop-blur p-6 md:p-8 shadow-card relative overflow-hidden animate-fade-up">
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />

              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] tracking-[0.3em] uppercase text-gold/80">
                  {current.question_type.replace('_', ' ')} · {String(visibleStep).padStart(2, '0')}
                </span>
                {current.is_required && (
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-warning px-2.5 py-1 rounded-full bg-warning/10 border border-warning/30">
                    {t('survey.required')}
                  </span>
                )}
              </div>

              <h2 className={`font-display text-xl md:text-2xl font-bold text-white mb-2 leading-snug ${language === 'my' ? 'font-myanmar' : ''}`}>
                {current.question_text}
              </h2>

              {/* --- product photo card --- */}
              {current.product_type && current.product_type !== 'none' && current.image_url && (() => {
                const image = current.image_url
                const name = current.product_type
                return (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-gold/20 bg-surface/80 animate-fade-up">
                    <Image
                      src={image}
                      alt={name}
                      width={384}
                      height={192}
                      className="h-48 w-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
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
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 md:gap-3" key={String(answers[current.id]?.value ?? '')}>
                  {Array.from({ length: ratingMax - ratingMin + 1 }, (_, index) => ratingMin + index).map(rating => (
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
                    value={currentTextValue}
                    onChange={(e) => handleTextChange(current.id, e.target.value)}
                    maxLength={currentTextMaxLength}
                    className={`survey-input resize-none min-h-[120px] leading-relaxed ${language === 'my' ? 'font-myanmar' : ''}`}
                    placeholder={t('survey.textPlaceholder')}
                    rows={current.question_type === 'long_text' ? 7 : 4}
                    aria-invalid={Boolean(currentTextError)}
                  />
                  {currentTextError && currentTextValue.trim().length > 0 && (
                    <p className="mt-2 text-xs text-error" role="alert">{currentTextError}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className={`flex items-center gap-1.5 ${complete ? 'text-success' : 'text-fg-muted'}`}>
                      {complete && (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {complete ? t('survey.answered') : t('survey.notAnswered')}
                    </span>
                    <span className="text-fg-muted">
                      {currentTextValue.length} / {currentTextMaxLength}
                    </span>
                  </div>
                </div>
              )}

              {/* --- number --- */}
              {current.question_type === 'number' && (
                <div className="mt-5">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={currentNumberValue}
                    min={currentNumberMin}
                    max={currentNumberMax}
                    step={currentRules.min !== undefined || currentRules.max !== undefined ? 1 : 'any'}
                    onChange={(e) => handleNumberChange(current.id, e.target.value)}
                    className="survey-input"
                    placeholder={t('survey.textPlaceholder')}
                    aria-invalid={Boolean(currentNumberError)}
                  />
                  {currentNumberError && (
                    <p className="mt-2 text-xs text-error" role="alert">{currentNumberError}</p>
                  )}
                  <div className="mt-3 flex items-center gap-1.5 text-xs">
                    <span className={`flex items-center gap-1.5 ${complete ? 'text-success' : 'text-fg-muted'}`}>
                      {complete && (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {complete ? t('survey.answered') : t('survey.notAnswered')}
                    </span>
                  </div>
                </div>
              )}

              {/* --- dropdown --- */}
              {current.question_type === 'dropdown' && (
                <div className="mt-5">
                  <select
                    value={typeof answers[current.id]?.value === 'string' ? (answers[current.id].value as string) : ''}
                    onChange={(e) => handleDropdown(current.id, e.target.value)}
                    className="survey-input"
                    aria-label={current.question_text}
                  >
                    <option value="">{t('survey.selectOne')}</option>
                    {(current.options || []).map(opt => (
                      <option key={opt.id} value={opt.option_value}>
                        {opt.option_text}
                      </option>
                    ))}
                  </select>
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
              disabled={!inReview && !hasPrevVisible}
              aria-label={t('common.back')}
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
              {hasNextVisible ? t('common.next') : t('survey.review')}
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