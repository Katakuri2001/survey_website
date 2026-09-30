'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'

import { API_BASE, adminHeaders, apiErrorMessage, readApiPayload } from '../lib/api'

type Tab = 'questions' | 'versions'
type TranslationMap = Record<string, string>

type ApiOption = {
  id?: string
  option_text?: string
  option_value?: string | null
  text?: string
  value?: string | null
  display_order?: number
  displayOrder?: number
  is_active?: boolean | number
  question_id?: string
  translation_language?: string | null
  translated_text?: string | null
  translations?: unknown
  option_translations?: unknown
}

type ApiQuestion = {
  id: string
  survey_version_id: string
  question_text: string
  question_type: string
  is_required: boolean | number
  display_order: number
  is_active: boolean | number
  validation_rules?: string | null
  version_title?: string
  product_name?: string
  option_count?: number
  image_url?: string | null
  product_type?: string | null
  options?: ApiOption[]
  translations?: unknown
  question_translations?: unknown
}

type ApiVersion = {
  id: string
  product_id: string
  version: number
  title: string
  description?: string | null
  is_active: boolean | number
  created_at: string
  product_name?: string
  question_count?: number
  response_count?: number
}

type ApiProduct = {
  id: string
  name: string
  image_url?: string | null
}

type QuestionFormOption = {
  id?: string
  text: string
  value: string
  displayOrder: number
  translations: TranslationMap
}

type SurveyQuestion = {
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
  image_url: string | null
  product_type: string | null
  options?: QuestionFormOption[]
  translations: TranslationMap
}

type SurveyVersion = {
  id: string
  product_id: string
  version: number
  title: string
  description: string
  is_active: boolean
  created_at: string
  product_name: string
  question_count: number
  response_count: number
}

type ProductOption = {
  id: string
  name: string
  image_url?: string | null
}

type QuestionFormData = {
  surveyVersionId: string
  questionText: string
  questionType: string
  isRequired: boolean
  displayOrder: number
  validationRules: string
  translations: TranslationMap
  options: QuestionFormOption[]
  optionsLoaded: boolean
  imageUrl: string
  productType: string
}

type VersionFormData = {
  productId: string
  title: string
  description: string
  translations: {
    en: { title: string; description: string }
    my: { title: string; description: string }
  }
}

const questionTypes = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'single_choice', label: 'Single Choice' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'text', label: 'Text Input' },
  { value: 'long_text', label: 'Long Text Input' },
  { value: 'number', label: 'Number Input' },
  { value: 'rating', label: 'Rating' },
]

const emptyQuestionForm: QuestionFormData = {
  surveyVersionId: '',
  questionText: '',
  questionType: 'multiple_choice',
  isRequired: true,
  displayOrder: 0,
  validationRules: '',
  translations: { en: '', my: '' },
  options: [],
  optionsLoaded: true,
  imageUrl: '',
  productType: 'none',
}

const emptyVersionForm: VersionFormData = {
  productId: '',
  title: '',
  description: '',
  translations: { en: { title: '', description: '' }, my: { title: '', description: '' } },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function translationMap(value: unknown): TranslationMap {
  if (Array.isArray(value)) {
    return value.reduce<TranslationMap>((result, item) => {
      if (!isRecord(item)) return result
      const language = typeof item.language === 'string' ? item.language : ''
      const text = typeof item.question_text === 'string'
        ? item.question_text
        : typeof item.option_text === 'string'
          ? item.option_text
          : typeof item.text === 'string'
            ? item.text
            : ''
      if (language && text) result[language] = text
      return result
    }, {})
  }
  if (!isRecord(value)) return {}
  return Object.entries(value).reduce<TranslationMap>((result, [language, text]) => {
    if (typeof text === 'string') result[language] = text
    return result
  }, {})
}

function nonEmptyTranslations(value: TranslationMap): TranslationMap {
  return Object.fromEntries(Object.entries(value).filter(([, text]) => text.trim().length > 0))
}

function serializeOptions(options: QuestionFormOption[] | undefined) {
  return (options || []).map((option, index) => {
    const translations = nonEmptyTranslations(option.translations)
    return {
      text: option.text.trim(),
      value: option.value.trim() || option.text.trim(),
      displayOrder: Number.isFinite(option.displayOrder) ? option.displayOrder : index,
      ...(Object.keys(translations).length > 0 ? { translations } : {}),
    }
  })
}

function normalizeOptions(options: ApiOption[]): QuestionFormOption[] {
  const byOption = new Map<string, QuestionFormOption>()
  options.forEach((option, index) => {
    const text = option.option_text ?? option.text ?? ''
    const value = option.option_value ?? option.value ?? text
    const displayOrder = Number(option.display_order ?? option.displayOrder ?? index) || 0
    const key = option.id || `${option.question_id || ''}:${text}:${value}:${displayOrder}`
    const existing = byOption.get(key)
    if (existing) {
      if (option.translation_language && option.translated_text) {
        existing.translations[option.translation_language] = option.translated_text
      }
      Object.assign(existing.translations, translationMap(option.translations ?? option.option_translations))
      return
    }
    const translations = translationMap(option.translations ?? option.option_translations)
    if (option.translation_language && option.translated_text) translations[option.translation_language] = option.translated_text
    byOption.set(key, {
      id: option.id,
      text,
      value: value == null ? '' : String(value),
      displayOrder,
      translations,
    })
  })
  return [...byOption.values()].sort((a, b) => a.displayOrder - b.displayOrder)
}

function normalizeQuestion(raw: ApiQuestion): SurveyQuestion {
  const options = Array.isArray(raw.options) ? normalizeOptions(raw.options) : undefined
  const translations = translationMap(raw.translations ?? raw.question_translations)
  return {
    id: raw.id,
    survey_version_id: raw.survey_version_id,
    question_text: raw.question_text || '',
    question_type: raw.question_type || 'single_choice',
    is_required: raw.is_required === true || raw.is_required === 1,
    display_order: Number(raw.display_order) || 0,
    is_active: raw.is_active === true || raw.is_active === 1,
    validation_rules: raw.validation_rules || null,
    version_title: raw.version_title || '',
    product_name: raw.product_name || '',
    option_count: Number(raw.option_count) || options?.length || 0,
    image_url: raw.image_url || null,
    product_type: raw.product_type || 'none',
    options,
    translations: {
      en: translations.en || raw.question_text || '',
      my: translations.my || '',
    },
  }
}

function normalizeVersion(raw: ApiVersion): SurveyVersion {
  return {
    id: raw.id,
    product_id: raw.product_id,
    version: Number(raw.version) || 0,
    title: raw.title || '',
    description: raw.description || '',
    is_active: raw.is_active === true || raw.is_active === 1,
    created_at: raw.created_at || '',
    product_name: raw.product_name || '',
    question_count: Number(raw.question_count) || 0,
    response_count: Number(raw.response_count) || 0,
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="card flex items-center gap-4 p-4">
          <div className="flex-1">
            <div className="mb-2 h-4 w-48 rounded bg-slate-200" />
            <div className="h-3 w-64 rounded bg-slate-100" />
          </div>
          <div className="h-6 w-20 rounded-full bg-slate-200" />
          <div className="h-8 w-20 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ message, onAdd }: { message: string; onAdd: () => void }) {
  return (
    <div className="card animate-fade-up p-12 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/10">
        <svg className="h-8 w-8 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <h3 className="font-display mb-1 text-lg font-semibold text-ink">{message}</h3>
      <p className="mb-6 text-sm text-slate-500">Get started by creating your first item.</p>
      <button type="button" onClick={onAdd} className="btn-gold shadow-gold">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add
      </button>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
        <svg className="h-6 w-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <p className="mb-1 text-sm font-medium text-ink">Failed to load data</p>
      <p className="mb-4 text-sm text-slate-500">{message}</p>
      <button type="button" onClick={onRetry} className="btn-outline">
        <svg className="h-4 w-4 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Retry
      </button>
    </div>
  )
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-pressed={checked}
      aria-label={checked ? 'Disable question' : 'Enable question'}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-gold' : 'bg-slate-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function QuestionModal({
  versions,
  products,
  question,
  onSave,
  onClose,
}: {
  versions: SurveyVersion[]
  products: ProductOption[]
  question: SurveyQuestion | null
  onSave: (data: QuestionFormData, imageFile: File | null) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<QuestionFormData>(() => {
    if (question) {
      return {
        surveyVersionId: question.survey_version_id,
        questionText: question.question_text,
        questionType: question.question_type,
        isRequired: question.is_required,
        displayOrder: question.display_order,
        validationRules: question.validation_rules || '',
        translations: { en: question.translations.en || question.question_text, my: question.translations.my || '' },
        options: question.options || [],
        optionsLoaded: question.options !== undefined,
        imageUrl: question.image_url || '',
        productType: question.product_type || 'none',
      }
    }
    const activeVersion = versions.find((version) => version.is_active)
    return { ...emptyQuestionForm, translations: { ...emptyQuestionForm.translations }, surveyVersionId: activeVersion?.id || '' }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const isEditing = !!question
  const isChoiceQuestion = form.questionType === 'multiple_choice' || form.questionType === 'single_choice' || form.questionType === 'dropdown'

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function updateField(field: keyof QuestionFormData, value: string | number | boolean) {
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  function updateTranslation(lang: string, value: string) {
    setForm((previous) => ({ ...previous, translations: { ...previous.translations, [lang]: value } }))
  }

  function updateProductType(value: string) {
    setForm((previous) => ({ ...previous, productType: value }))
  }

  function addOption() {
    setForm((previous) => ({
      ...previous,
      options: [
        ...previous.options,
        { text: '', value: '', displayOrder: previous.options.length, translations: { en: '', my: '' } },
      ],
    }))
  }

  function updateOption(index: number, field: 'text' | 'value', value: string) {
    setForm((previous) => ({
      ...previous,
      options: previous.options.map((option, optionIndex) => (optionIndex === index ? { ...option, [field]: value } : option)),
    }))
  }

  function updateOptionTranslation(index: number, lang: string, value: string) {
    setForm((previous) => ({
      ...previous,
      options: previous.options.map((option, optionIndex) =>
        optionIndex === index
          ? { ...option, translations: { ...option.translations, [lang]: value } }
          : option,
      ),
    }))
  }

  function removeOption(index: number) {
    setForm((previous) => ({
      ...previous,
      options: previous.options
        .filter((_, optionIndex) => optionIndex !== index)
        .map((option, optionIndex) => ({ ...option, displayOrder: optionIndex })),
    }))
  }

  function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB')
      return
    }
    setError('')
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.surveyVersionId) {
      setError('Please select a survey version')
      return
    }
    if (!form.questionText.trim()) {
      setError('Question text is required')
      return
    }
    if (isChoiceQuestion) {
      if (!form.optionsLoaded) {
        setError('Existing options could not be loaded; refresh before editing this choice question')
        return
      }
      if (form.options.length === 0) {
        setError('Choice questions must have at least one option')
        return
      }
      if (form.options.some((option) => !option.text.trim())) {
        setError('Every option must have text')
        return
      }
    }

    setSaving(true)
    setError('')
    try {
      await onSave(form, imageFile)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save question')
    } finally {
      setSaving(false)
    }
  }

  const displayImage = previewUrl || form.imageUrl

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">
            {isEditing ? 'Edit Question' : 'Add Question'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close question dialog" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-4">
          {error && (
            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="question-version" className="mb-1 block text-sm font-medium text-slate-700">Survey Version *</label>
            <select
              id="question-version"
              value={form.surveyVersionId}
              onChange={(event) => updateField('surveyVersionId', event.target.value)}
              className="input"
              disabled={isEditing}
              required
            >
              <option value="">Select a version</option>
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.title} ({version.product_name}){version.is_active ? ' — ACTIVE' : ''}
                </option>
              ))}
            </select>
            {versions.length === 0 && <p className="mt-1 text-xs text-rose-600">No survey versions are available.</p>}
          </div>

          <div>
            <label htmlFor="question-text" className="mb-1 block text-sm font-medium text-slate-700">Question Text (English) *</label>
            <textarea
              id="question-text"
              value={form.questionText}
              onChange={(event) => {
                updateField('questionText', event.target.value)
                updateTranslation('en', event.target.value)
              }}
              rows={2}
              className="input resize-none"
              placeholder="e.g. How satisfied are you with our product?"
              required
            />
          </div>

          <div>
            <label htmlFor="question-text-my" className="mb-1 block text-sm font-medium text-slate-700">Question Text (Myanmar)</label>
            <input
              id="question-text-my"
              type="text"
              value={form.translations.my || ''}
              onChange={(event) => updateTranslation('my', event.target.value)}
              className="input"
              placeholder="Question in Myanmar"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="question-type" className="mb-1 block text-sm font-medium text-slate-700">Question Type *</label>
              <select id="question-type" value={form.questionType} onChange={(event) => updateField('questionType', event.target.value)} className="input">
                {questionTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="question-order" className="mb-1 block text-sm font-medium text-slate-700">Display Order</label>
              <input id="question-order" type="number" value={form.displayOrder} onChange={(event) => updateField('displayOrder', Number.parseInt(event.target.value, 10) || 0)} className="input" min="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="question-product-type" className="mb-1 block text-sm font-medium text-slate-700">Product Type</label>
              <select id="question-product-type" value={form.productType} onChange={(event) => updateProductType(event.target.value)} className="input">
                <option value="none">None</option>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="question-image" className="mb-1 block text-sm font-medium text-slate-700">Question Image</label>
              <div className="space-y-3">
                {displayImage && (
                  <div className="relative w-full max-w-xs">
                    <Image src={displayImage} alt="Question preview" width={480} height={288} className="h-48 w-full rounded-lg border border-slate-200 object-cover" />
                    {previewUrl && <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-1 text-xs text-white">Pending save</span>}
                  </div>
                )}
                <label htmlFor="question-image" className="cursor-pointer">
                  <input id="question-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageUpload} className="sr-only" disabled={saving} />
                  <div className={`rounded-xl border-2 border-dashed p-4 text-center transition-colors ${displayImage ? 'border-slate-300 bg-slate-50' : 'border-gold/50 bg-gold/5'}`}>
                    <p className="text-sm font-medium text-slate-700">{imageFile ? 'Image selected — save to apply' : displayImage ? 'Click to change image' : 'Click to choose image'}</p>
                    <p className="mt-1 text-xs text-slate-500">JPEG, PNG, WebP, GIF up to 5MB</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Toggle checked={form.isRequired} onChange={() => updateField('isRequired', !form.isRequired)} />
            <span className="text-sm font-medium text-slate-700">Required</span>
          </div>

          {isChoiceQuestion && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Options *</label>
                <button type="button" onClick={addOption} className="text-xs font-semibold text-gold-600 hover:text-gold-700">+ Add Option</button>
              </div>
              {!form.optionsLoaded ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">Options were not returned by the API. Refresh before editing this question.</p>
              ) : (
                <div className="space-y-3">
                  {form.options.map((option, index) => (
                    <div key={option.id || `new-${index}`} className="rounded-xl border border-slate-200 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Option {index + 1}</span>
                        <button type="button" onClick={() => removeOption(index)} aria-label={`Remove option ${index + 1}`} className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input type="text" value={option.text} onChange={(event) => updateOption(index, 'text', event.target.value)} className="input" placeholder="Option text (English)" aria-label={`Option ${index + 1} text`} />
                        <input type="text" value={option.value} onChange={(event) => updateOption(index, 'value', event.target.value)} className="input" placeholder="Option value" aria-label={`Option ${index + 1} value`} />
                      </div>
                      <input type="text" value={option.translations.my || ''} onChange={(event) => updateOptionTranslation(index, 'my', event.target.value)} className="input mt-2" placeholder="Option text (Myanmar)" aria-label={`Option ${index + 1} Myanmar text`} />
                    </div>
                  ))}
                  {form.options.length === 0 && <p className="py-2 text-center text-sm text-slate-400">No options added</p>}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pb-1 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="btn-gold disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function VersionModal({
  products,
  productsLoading,
  productsError,
  onSave,
  onClose,
}: {
  products: ProductOption[]
  productsLoading: boolean
  productsError: string
  onSave: (data: VersionFormData) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<VersionFormData>({ ...emptyVersionForm, translations: { en: { ...emptyVersionForm.translations.en }, my: { ...emptyVersionForm.translations.my } } })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateField(field: 'productId' | 'title' | 'description', value: string) {
    setForm((previous) => ({ ...previous, [field]: value }))
    if (field === 'title') {
      setForm((previous) => ({ ...previous, translations: { ...previous.translations, en: { ...previous.translations.en, title: value } } }))
    }
    if (field === 'description') {
      setForm((previous) => ({ ...previous, translations: { ...previous.translations, en: { ...previous.translations.en, description: value } } }))
    }
  }

  function updateTranslation(field: 'title' | 'description', value: string) {
    setForm((previous) => ({ ...previous, translations: { ...previous.translations, my: { ...previous.translations.my, [field]: value } } }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.productId) {
      setError('Please select a product')
      return
    }
    if (!form.title.trim()) {
      setError('Title is required')
      return
    }
    if (productsLoading) {
      setError('Products are still loading. Try again in a moment.')
      return
    }
    if (productsError) {
      setError('Products could not be loaded; refresh before creating a version')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to create version')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">Create Survey Version</h2>
          <button type="button" onClick={onClose} aria-label="Close version dialog" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-4">
          {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
          <div>
            <label htmlFor="version-product" className="mb-1 block text-sm font-medium text-slate-700">Product *</label>
            <select id="version-product" value={form.productId} onChange={(event) => updateField('productId', event.target.value)} className="input" required disabled={productsLoading || products.length === 0}>
              <option value="">{productsLoading ? 'Loading products...' : productsError ? 'Products unavailable' : 'Select a product'}</option>
              {products.map((product) => <option key={product.id} value={product.id}>{product.name} ({product.id})</option>)}
            </select>
            {productsError && <p className="mt-1 text-xs text-rose-600">{productsError}</p>}
            {!productsLoading && !productsError && products.length === 0 && <p className="mt-1 text-xs text-slate-500">No products are available.</p>}
          </div>
          <div>
            <label htmlFor="version-title" className="mb-1 block text-sm font-medium text-slate-700">Title (English) *</label>
            <input id="version-title" type="text" value={form.title} onChange={(event) => updateField('title', event.target.value)} className="input" placeholder="e.g. Customer Satisfaction Survey v2" required />
          </div>
          <div>
            <label htmlFor="version-description" className="mb-1 block text-sm font-medium text-slate-700">Description (English)</label>
            <textarea id="version-description" value={form.description} onChange={(event) => updateField('description', event.target.value)} rows={2} className="input resize-none" placeholder="Brief description of this survey version" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Myanmar Translation</p>
            <div className="space-y-3">
              <div><label htmlFor="version-title-my" className="mb-1 block text-sm font-medium text-slate-700">Title</label><input id="version-title-my" type="text" value={form.translations.my.title} onChange={(event) => updateTranslation('title', event.target.value)} className="input bg-white" placeholder="Title in Myanmar" /></div>
              <div><label htmlFor="version-description-my" className="mb-1 block text-sm font-medium text-slate-700">Description</label><input id="version-description-my" type="text" value={form.translations.my.description} onChange={(event) => updateTranslation('description', event.target.value)} className="input bg-white" placeholder="Description in Myanmar" /></div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pb-1 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving || productsLoading || products.length === 0} className="btn-gold disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Creating...' : 'Create Version'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SurveysPage() {
  const [activeTab, setActiveTab] = useState<Tab>('questions')
  const [questions, setQuestions] = useState<SurveyQuestion[]>([])
  const [versions, setVersions] = useState<SurveyVersion[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(true)
  const [loadingVersions, setLoadingVersions] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [errorQuestions, setErrorQuestions] = useState('')
  const [errorVersions, setErrorVersions] = useState('')
  const [errorProducts, setErrorProducts] = useState('')
  const [mutationError, setMutationError] = useState('')
  const [showQuestionModal, setShowQuestionModal] = useState(false)
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null)
  const [togglingQuestionId, setTogglingQuestionId] = useState<string | null>(null)
  const [togglingVersionId, setTogglingVersionId] = useState<string | null>(null)

  const fetchQuestions = useCallback(async () => {
    setLoadingQuestions(true)
    setErrorQuestions('')
    try {
      const response = await fetch(`${API_BASE}/admin/survey/questions`, { headers: adminHeaders() })
      const payload = await readApiPayload(response)
      if (!response.ok || !payload || payload.success !== true) throw new Error(apiErrorMessage(payload, 'Failed to load questions'))
      const rows = Array.isArray(payload.data) ? payload.data as ApiQuestion[] : []
      setQuestions(rows.map(normalizeQuestion))
    } catch (error) {
      setErrorQuestions(error instanceof Error ? error.message : 'Could not connect to the server')
    } finally {
      setLoadingQuestions(false)
    }
  }, [])

  const fetchVersions = useCallback(async () => {
    setLoadingVersions(true)
    setErrorVersions('')
    try {
      const response = await fetch(`${API_BASE}/admin/survey/versions`, { headers: adminHeaders() })
      const payload = await readApiPayload(response)
      if (!response.ok || !payload || payload.success !== true) throw new Error(apiErrorMessage(payload, 'Failed to load versions'))
      const rows = Array.isArray(payload.data) ? payload.data as ApiVersion[] : []
      setVersions(rows.map(normalizeVersion))
    } catch (error) {
      setErrorVersions(error instanceof Error ? error.message : 'Could not connect to the server')
    } finally {
      setLoadingVersions(false)
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true)
    setErrorProducts('')
    try {
      const response = await fetch(`${API_BASE}/admin/products`, { headers: adminHeaders() })
      const payload = await readApiPayload(response)
      if (!response.ok || !payload || payload.success !== true) throw new Error(apiErrorMessage(payload, 'Failed to load products'))
      const raw = Array.isArray(payload.data)
        ? payload.data as ApiProduct[]
        : (payload.data as { products?: ApiProduct[] } | undefined)?.products || []
      setProducts(raw.map((product) => ({ id: product.id, name: product.name, image_url: product.image_url || null })))
    } catch (error) {
      setErrorProducts(error instanceof Error ? error.message : 'Could not connect to the server')
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  useEffect(() => {
    // Initial independent resource loads intentionally run once per resource.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchQuestions()
    void fetchVersions()
    void fetchProducts()
  }, [fetchQuestions, fetchVersions, fetchProducts])

  async function handleToggleQuestionActive(question: SurveyQuestion) {
    setTogglingQuestionId(question.id)
    setMutationError('')
    try {
      const toggleBody: Record<string, unknown> = { isActive: question.is_active ? 0 : 1 }
      if (question.question_type === 'multiple_choice' || question.question_type === 'single_choice' || question.question_type === 'dropdown') {
        toggleBody.options = serializeOptions(question.options)
      }
      const response = await fetch(`${API_BASE}/admin/survey/questions/${question.id}`, {
        method: 'PATCH',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(toggleBody),
      })
      const payload = await readApiPayload(response)
      if (!response.ok || !payload || payload.success !== true) throw new Error(apiErrorMessage(payload, 'Failed to update question status'))
      setQuestions((previous) => previous.map((item) => item.id === question.id ? { ...item, is_active: !item.is_active } : item))
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Failed to update question status')
    } finally {
      setTogglingQuestionId(null)
    }
  }

  async function handleDeleteQuestion(id: string) {
    if (!window.confirm('Are you sure you want to delete this question? Historical answers may be affected by the API.')) return
    setMutationError('')
    try {
      const response = await fetch(`${API_BASE}/admin/survey/questions/${id}`, { method: 'DELETE', headers: adminHeaders() })
      const payload = await readApiPayload(response)
      if (!response.ok || !payload || payload.success !== true) throw new Error(apiErrorMessage(payload, 'Failed to delete question'))
      setQuestions((previous) => previous.filter((question) => question.id !== id))
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Failed to delete question')
    }
  }

  async function handleSaveQuestion(formData: QuestionFormData, imageFile: File | null) {
    let imageUrl = formData.imageUrl
    if (imageFile) {
      const uploadData = new FormData()
      uploadData.append('file', imageFile)
      uploadData.append('type', 'survey_question')
      const uploadResponse = await fetch(`${API_BASE}/admin/upload`, { method: 'POST', headers: adminHeaders(), body: uploadData })
      const uploadPayload = await readApiPayload(uploadResponse)
      const uploaded = uploadPayload?.data as { url?: string } | undefined
      const uploadedUrl = uploaded?.url || uploadPayload?.url
      if (!uploadResponse.ok || !uploadPayload || uploadPayload.success !== true || !uploadedUrl) throw new Error(apiErrorMessage(uploadPayload, 'Failed to upload image'))
      imageUrl = uploadedUrl
    }

    const questionTranslations = nonEmptyTranslations(formData.translations)
    const body: Record<string, unknown> = {
      questionText: formData.questionText,
      questionType: formData.questionType,
      isRequired: formData.isRequired,
      displayOrder: formData.displayOrder,
      validationRules: formData.validationRules,
      imageUrl,
      productType: formData.productType,
    }
    if (Object.keys(questionTranslations).length > 0) body.translations = questionTranslations
    if (!editingQuestion) body.surveyVersionId = formData.surveyVersionId
    if (formData.optionsLoaded && (formData.questionType === 'multiple_choice' || formData.questionType === 'single_choice' || formData.questionType === 'dropdown')) {
      body.options = serializeOptions(formData.options)
    }

    const response = await fetch(
      editingQuestion ? `${API_BASE}/admin/survey/questions/${editingQuestion.id}` : `${API_BASE}/admin/survey/questions`,
      {
        method: editingQuestion ? 'PATCH' : 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(editingQuestion ? body : { ...body, surveyVersionId: formData.surveyVersionId }),
      },
    )
    const payload = await readApiPayload(response)
    if (!response.ok || !payload || payload.success !== true) throw new Error(apiErrorMessage(payload, editingQuestion ? 'Failed to update question' : 'Failed to create question'))
    await fetchQuestions()
  }

  async function handleSaveVersion(formData: VersionFormData) {
    const response = await fetch(`${API_BASE}/admin/survey/versions`, {
      method: 'POST',
      headers: adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...formData, activate: false }),
    })
    const payload = await readApiPayload(response)
    if (!response.ok || !payload || payload.success !== true) throw new Error(apiErrorMessage(payload, 'Failed to create version'))
    await fetchVersions()
  }

  async function handleToggleVersionActive(version: SurveyVersion) {
    const nextActive = !version.is_active
    if (nextActive && !window.confirm(`Activate "${version.title}"? The API will make this the live version for its product.`)) return
    setTogglingVersionId(version.id)
    setMutationError('')
    try {
      // Version status lifecycle contract: PATCH /admin/survey/versions/:id/status
      // with the authoritative isActive flag.
      const response = await fetch(`${API_BASE}/admin/survey/versions/${version.id}/status`, {
        method: 'PATCH',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ isActive: nextActive }),
      })
      const payload = await readApiPayload(response)
      if (!response.ok || !payload || payload.success !== true) throw new Error(apiErrorMessage(payload, 'Failed to update survey version status'))
      setVersions((previous) => previous.map((item) => item.id === version.id ? { ...item, is_active: nextActive } : item))
      // Activation is product/global-state authoritative; refresh all rows so
      // versions deactivated by the API are not left looking active locally.
      void fetchVersions()
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Failed to update survey version status')
    } finally {
      setTogglingVersionId(null)
    }
  }

  function openAddQuestionModal() {
    setMutationError('')
    setEditingQuestion(null)
    setShowQuestionModal(true)
  }

  function openEditQuestionModal(question: SurveyQuestion) {
    setMutationError('')
    setEditingQuestion(question)
    setShowQuestionModal(true)
  }

  function questionTypeLabel(type: string) {
    return questionTypes.find((questionType) => questionType.value === type)?.label || type
  }

  const sortedQuestions = [...questions].sort((a, b) => a.display_order - b.display_order)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Surveys</h1>
        <p className="mt-1 text-sm text-slate-500">Manage survey questions and versions</p>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          <button type="button" onClick={() => setActiveTab('questions')} className={`border-b-2 pb-3 text-sm font-medium transition-colors ${activeTab === 'questions' ? 'border-gold-500 text-gold-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            Questions
            {!loadingQuestions && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{questions.length}</span>}
          </button>
          <button type="button" onClick={() => setActiveTab('versions')} className={`border-b-2 pb-3 text-sm font-medium transition-colors ${activeTab === 'versions' ? 'border-gold-500 text-gold-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            Versions
            {!loadingVersions && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{versions.length}</span>}
          </button>
        </nav>
      </div>

      {mutationError && (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span>{mutationError}</span>
          <button type="button" onClick={() => setMutationError('')} className="ml-4 font-semibold underline">Dismiss</button>
        </div>
      )}

      {errorProducts && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span>Products could not be loaded: {errorProducts}</span>
          <button type="button" onClick={() => void fetchProducts()} className="font-semibold underline">Retry</button>
        </div>
      )}

      {activeTab === 'questions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{loadingQuestions && questions.length === 0 ? 'Loading...' : `${questions.length} questions`}</p>
            {!loadingQuestions && questions.length > 0 && <button type="button" onClick={openAddQuestionModal} className="btn-gold shadow-gold"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add Question</button>}
          </div>

          {errorQuestions && (
            <div role="alert" className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between">
              <span>{errorQuestions}</span>
              <button type="button" onClick={() => void fetchQuestions()} className="font-semibold underline">Retry</button>
            </div>
          )}
          {loadingQuestions && questions.length === 0 && !errorQuestions && <LoadingSkeleton />}
          {!loadingQuestions && errorQuestions && questions.length === 0 && <ErrorState message={errorQuestions} onRetry={() => void fetchQuestions()} />}
          {!loadingQuestions && !errorQuestions && questions.length === 0 && <EmptyState message="No questions yet" onAdd={openAddQuestionModal} />}

          {questions.length > 0 && (
            <div className="card overflow-hidden">
              {loadingQuestions && <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-400">Refreshing questions…</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200 bg-slate-50/70"><th className="w-8 px-4 py-3 text-left font-medium text-slate-500">#</th><th className="px-4 py-3 text-left font-medium text-slate-500">Question</th><th className="px-4 py-3 text-left font-medium text-slate-500">Type</th><th className="px-4 py-3 text-center font-medium text-slate-500">Order</th><th className="px-4 py-3 text-center font-medium text-slate-500">Options</th><th className="px-4 py-3 text-left font-medium text-slate-500">Version</th><th className="px-4 py-3 text-center font-medium text-slate-500">Active</th><th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th></tr></thead>
                  <tbody>
                    {sortedQuestions.map((question, index) => (
                      <tr key={question.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-medium text-slate-400">{index + 1}</td>
                        <td className="px-4 py-3"><div className="max-w-xs min-w-0"><p className="truncate font-medium text-ink">{question.question_text}</p>{question.product_name && <p className="truncate text-xs text-slate-400">{question.product_name}</p>}</div></td>
                        <td className="px-4 py-3"><span className="inline-flex items-center rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-semibold text-gold-600 ring-1 ring-inset ring-gold-200">{questionTypeLabel(question.question_type)}</span></td>
                        <td className="px-4 py-3 text-center text-slate-600">{question.display_order}</td>
                        <td className="px-4 py-3 text-center"><span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{question.option_count}</span></td>
                        <td className="px-4 py-3 text-xs text-slate-600">{question.version_title || '—'}</td>
                        <td className="px-4 py-3"><div className="flex justify-center"><Toggle checked={question.is_active} onChange={() => void handleToggleQuestionActive(question)} disabled={togglingQuestionId === question.id} /></div></td>
                        <td className="px-4 py-3"><div className="flex items-center justify-end gap-1"><button type="button" onClick={() => openEditQuestionModal(question)} className="rounded-lg p-2 text-slate-400 hover:bg-gold-10 hover:text-gold-600" title="Edit question" aria-label={`Edit ${question.question_text}`}><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button><button type="button" onClick={() => void handleDeleteQuestion(question.id)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete question" aria-label={`Delete ${question.question_text}`}><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A18.22 18.22 0 0114.21 21H7.79a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'versions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{loadingVersions && versions.length === 0 ? 'Loading...' : `${versions.length} versions`}</p>
            {!loadingVersions && <button type="button" onClick={() => { setMutationError(''); setShowVersionModal(true) }} className="btn-gold shadow-gold"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Create Version</button>}
          </div>
          {errorVersions && <div role="alert" className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"><span>{errorVersions}</span><button type="button" onClick={() => void fetchVersions()} className="font-semibold underline">Retry</button></div>}
          {loadingVersions && versions.length === 0 && !errorVersions && <LoadingSkeleton />}
          {!loadingVersions && errorVersions && versions.length === 0 && <ErrorState message={errorVersions} onRetry={() => void fetchVersions()} />}
          {!loadingVersions && !errorVersions && versions.length === 0 && <EmptyState message="No survey versions yet" onAdd={() => setShowVersionModal(true)} />}

          {versions.length > 0 && (
            <div className="card overflow-hidden">
              {loadingVersions && <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-400">Refreshing versions…</p>}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-200 bg-slate-50/70"><th className="w-8 px-4 py-3 text-left font-medium text-slate-500">#</th><th className="px-4 py-3 text-left font-medium text-slate-500">Title</th><th className="px-4 py-3 text-left font-medium text-slate-500">Product</th><th className="px-4 py-3 text-center font-medium text-slate-500">Version</th><th className="px-4 py-3 text-center font-medium text-slate-500">Questions</th><th className="px-4 py-3 text-center font-medium text-slate-500">Responses</th><th className="px-4 py-3 text-center font-medium text-slate-500">Active</th><th className="px-4 py-3 text-left font-medium text-slate-500">Created</th></tr></thead>
                  <tbody>
                    {versions.map((version, index) => (
                      <tr key={version.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-medium text-slate-400">{index + 1}</td>
                        <td className="px-4 py-3"><div className="min-w-0"><p className="truncate font-medium text-ink">{version.title}</p>{version.description && <p className="max-w-[240px] truncate text-xs text-slate-400">{version.description}</p>}</div></td>
                        <td className="px-4 py-3 text-slate-600">{version.product_name || '—'}</td>
                        <td className="px-4 py-3 text-center"><span className="inline-flex items-center rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-semibold text-gold-600 ring-1 ring-inset ring-gold-200">v{version.version}</span></td>
                        <td className="px-4 py-3 text-center"><span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{version.question_count}</span></td>
                        <td className="px-4 py-3 text-center"><span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">{version.response_count.toLocaleString()}</span></td>
                        <td className="px-4 py-3"><div className="flex justify-center"><Toggle checked={version.is_active} onChange={() => void handleToggleVersionActive(version)} disabled={togglingVersionId === version.id} /></div></td>
                        <td className="px-4 py-3 text-xs text-slate-500">{version.created_at ? new Date(version.created_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {showQuestionModal && <QuestionModal versions={versions} products={products} question={editingQuestion} onSave={handleSaveQuestion} onClose={() => { setShowQuestionModal(false); setEditingQuestion(null) }} />}
      {showVersionModal && <VersionModal products={products} productsLoading={loadingProducts} productsError={errorProducts} onSave={handleSaveVersion} onClose={() => setShowVersionModal(false)} />}
    </div>
  )
}
