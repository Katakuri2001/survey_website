export const SURVEY_PROGRESS_KEY = 'survey_progress'

export type PersistedAnswerValue = string | number | string[]

export interface PersistedAnswer {
  questionId: string
  type: string
  value: PersistedAnswerValue
}

export interface SurveyProgress {
  answers: Record<string, PersistedAnswer>
  currentIdx: number
  currentQuestionId: string
  reviewMode: boolean
  savedAt: number
}

function sessionStore(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function isAnswer(value: unknown): value is PersistedAnswer {
  if (!value || typeof value !== 'object') return false
  const answer = value as Partial<PersistedAnswer>
  if (typeof answer.questionId !== 'string' || typeof answer.type !== 'string') return false
  if (answer.questionId.length > 100 || answer.type.length > 32) return false
  if (typeof answer.value === 'string') return answer.value.length <= 2000
  if (typeof answer.value === 'number') return Number.isFinite(answer.value)
  return Array.isArray(answer.value)
    && answer.value.length <= 50
    && answer.value.every(item => typeof item === 'string' && item.length <= 500)
}

/** Read a bounded, validated progress snapshot; corrupt storage is ignored. */
export function loadSurveyProgress(): SurveyProgress | null {
  const store = sessionStore()
  if (!store) return null
  try {
    const raw = store.getItem(SURVEY_PROGRESS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SurveyProgress>
    if (!parsed || typeof parsed !== 'object' || !parsed.answers || typeof parsed.answers !== 'object') {
      return null
    }

    const answers: Record<string, PersistedAnswer> = {}
    for (const [questionId, answer] of Object.entries(parsed.answers).slice(0, 100)) {
      if (isAnswer(answer) && answer.questionId === questionId) {
        answers[questionId] = answer
      }
    }

    const currentIdx = typeof parsed.currentIdx === 'number' && Number.isFinite(parsed.currentIdx)
      ? Math.max(0, Math.floor(parsed.currentIdx))
      : 0
    return {
      answers,
      currentIdx,
      currentQuestionId: typeof parsed.currentQuestionId === 'string' ? parsed.currentQuestionId : '',
      reviewMode: parsed.reviewMode === true,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
    }
  } catch {
    return null
  }
}

/** Save progress without allowing quota/private-mode errors to break the form. */
export function saveSurveyProgress(progress: Omit<SurveyProgress, 'savedAt'>): void {
  const store = sessionStore()
  if (!store) return
  try {
    store.setItem(SURVEY_PROGRESS_KEY, JSON.stringify({ ...progress, savedAt: Date.now() }))
  } catch {
    // Progress remains in React state when sessionStorage is unavailable.
  }
}

export function clearSurveyProgress(): void {
  try {
    sessionStore()?.removeItem(SURVEY_PROGRESS_KEY)
  } catch {
    // Ignore unavailable storage.
  }
}
