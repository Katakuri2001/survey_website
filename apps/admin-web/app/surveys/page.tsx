'use client'

import { useState, useEffect, useCallback } from 'react'

import { API_BASE } from '../lib/api'

type Tab = 'questions' | 'versions'

interface SurveyQuestion {
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
}

interface SurveyVersion {
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

interface QuestionFormData {
  surveyVersionId: string
  questionText: string
  questionType: string
  isRequired: boolean
  displayOrder: number
  validationRules: string
  translations: Record<string, string>
  options: { text: string; value: string; translations: Record<string, string> }[]
  imageUrl: string
  productType: string
}

interface ProductOption {
  id: string
  name: string
  image_url?: string | null
}

interface VersionFormData {
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
  { value: 'text', label: 'Text Input' },
  { value: 'rating', label: 'Rating' },
  { value: 'yes_no', label: 'Yes / No' },
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
  imageUrl: '',
  productType: 'none',
}

const emptyVersionForm: VersionFormData = {
  productId: '',
  title: '',
  description: '',
  translations: { en: { title: '', description: '' }, my: { title: '', description: '' } },
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5].map(i => (
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
      <button onClick={onAdd} className="btn-gold shadow-gold">
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
      <button onClick={onRetry} className="btn-outline">
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
  onSave: (data: QuestionFormData) => Promise<void>
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
        translations: { en: question.question_text, my: '' },
        options: [],
        imageUrl: question.image_url || '',
        productType: question.product_type || 'none',
      }
    }
    const activeVersion = versions.find(v => v.is_active)
    return { ...emptyQuestionForm, surveyVersionId: activeVersion?.id || '' }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const isEditing = !!question

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed')
      return
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      setUploadError('File too large. Maximum size is 5MB')
      return
    }

    setUploading(true)
    setUploadError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'survey_question')
      if (isEditing) {
        formData.append('entityId', question.id)
      }

      const token = localStorage.getItem('admin_token')
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE}/admin/upload`, { method: 'POST', headers, body: formData })
      const data = await res.json()

      if (data.success) {
        updateImageUrl(data.url)
        setUploadError('')
      } else {
        setUploadError(data.message || 'Failed to upload image')
      }
    } catch {
      setUploadError('Could not connect to the server')
    } finally {
      setUploading(false)
    }
  }

  function updateField(field: keyof QuestionFormData, value: string | number | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function updateImageUrl(value: string) {
    setForm(prev => ({ ...prev, imageUrl: value }))
  }

  function updateProductType(value: string) {
    setForm(prev => ({ ...prev, productType: value }))
  }

  function updateTranslation(lang: string, value: string) {
    setForm(prev => ({ ...prev, translations: { ...prev.translations, [lang]: value } }))
  }

  function addOption() {
    setForm(prev => ({
      ...prev,
      options: [...prev.options, { text: '', value: '', translations: { en: '', my: '' } }],
    }))
  }

  function updateOption(index: number, field: 'text' | 'value', value: string) {
    setForm(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => (i === index ? { ...opt, [field]: value } : opt)),
    }))
  }

  function updateOptionTranslation(index: number, lang: string, value: string) {
    setForm(prev => ({
      ...prev,
      options: prev.options.map((opt, i) =>
        i === index ? { ...opt, translations: { ...opt.translations, [lang]: value } } : opt
      ),
    }))
  }

  function removeOption(index: number) {
    setForm(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.surveyVersionId) {
      setError('Please select a survey version')
      return
    }
    if (!form.questionText.trim()) {
      setError('Question text is required')
      return
    }
    if (!form.questionType) {
      setError('Question type is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save question')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">
            {isEditing ? 'Edit Question' : 'Add Question'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-4">
          {(error || uploadError) && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm text-rose-700">{error || uploadError}</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Survey Version *</label>
            <select
              value={form.surveyVersionId}
              onChange={e => updateField('surveyVersionId', e.target.value)}
              className="input"
              disabled={isEditing}
            >
              <option value="">Select a version</option>
              {versions.map(v => (
                <option key={v.id} value={v.id}>
                  {v.title} ({v.product_name}){v.is_active ? ' — ACTIVE' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Question Text (English) *</label>
            <textarea
              value={form.questionText}
              onChange={e => {
                updateField('questionText', e.target.value)
                updateTranslation('en', e.target.value)
              }}
              rows={2}
              className="input resize-none"
              placeholder="e.g. How satisfied are you with our product?"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Question Text (Myanmar)</label>
            <input
              type="text"
              value={form.translations.my || ''}
              onChange={e => updateTranslation('my', e.target.value)}
              className="input"
              placeholder="Question in Myanmar"
            />
          </div>

<div className="grid grid-cols-2 gap-4">
             <div>
               <label className="mb-1 block text-sm font-medium text-slate-700">Question Type *</label>
               <select
                 value={form.questionType}
                 onChange={e => updateField('questionType', e.target.value)}
                 className="input"
               >
                 {questionTypes.map(qt => (
                   <option key={qt.value} value={qt.value}>
                     {qt.label}
                   </option>
                 ))}
               </select>
             </div>
             <div>
               <label className="mb-1 block text-sm font-medium text-slate-700">Display Order</label>
               <input
                 type="number"
                 value={form.displayOrder}
                 onChange={e => updateField('displayOrder', parseInt(e.target.value) || 0)}
                 className="input"
                 min="0"
               />
             </div>
           </div>

<div className="grid grid-cols-2 gap-4">
              <div>
               <label className="mb-1 block text-sm font-medium text-slate-700">Product Type</label>
               <select
                 value={form.productType}
                 onChange={e => updateProductType(e.target.value)}
                 className="input"
               >
                 <option value="none">None</option>
                 {products.map(p => (
                   <option key={p.id} value={p.id}>
                     {p.name}
                   </option>
                 ))}
               </select>
             </div>
             <div>
               <label className="mb-1 block text-sm font-medium text-slate-700">Product Image</label>
               <div className="space-y-3">
                 {form.imageUrl && (
                   <div className="relative w-full max-w-xs">
                     <img
                       src={form.imageUrl}
                       alt="Product preview"
                       className="w-full h-48 object-cover rounded-lg border border-slate-200"
                     />
                   </div>
                 )}
                 <label className="cursor-pointer">
                   <input
                     type="file"
                     accept="image/jpeg,image/png,image/webp,image/gif"
                     onChange={handleImageUpload}
                     className="sr-only"
                     disabled={uploading || saving}
                   />
                   <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                     form.imageUrl ? 'border-slate-300 bg-slate-50' : 'border-gold/50 bg-gold/5'
                   }`}>
                     <svg className="mx-auto h-10 w-10 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                     </svg>
                     <p className="mt-2 text-sm font-medium text-slate-700">
                       {form.imageUrl ? 'Click to change image' : 'Click to upload image'}
                     </p>
                     <p className="text-xs text-slate-500">JPEG, PNG, WebP, GIF up to 5MB</p>
                     {uploading && <p className="mt-2 text-sm text-gold-600">Uploading...</p>}
                   </div>
                 </label>
               </div>
             </div>
            </div>

           <div className="flex items-center gap-3">
             <Toggle checked={form.isRequired} onChange={() => updateField('isRequired', !form.isRequired)} />
             <span className="text-sm font-medium text-slate-700">Required</span>
           </div>

           {(form.questionType === 'multiple_choice' || form.questionType === 'single_choice') && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Options</label>
                <button
                  type="button"
                  onClick={addOption}
                  className="text-xs font-semibold text-gold-600 hover:text-gold-700"
                >
                  + Add Option
                </button>
              </div>
              <div className="space-y-3">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={opt.text}
                        onChange={e => updateOption(i, 'text', e.target.value)}
                        className="input"
                        placeholder="Option text (English)"
                      />
                      <input
                        type="text"
                        value={opt.translations.my || ''}
                        onChange={e => updateOptionTranslation(i, 'my', e.target.value)}
                        className="input"
                        placeholder="Option text (Myanmar)"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      className="mt-2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {form.options.length === 0 && (
                  <p className="py-2 text-center text-sm text-slate-400">No options added</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pb-1 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-gold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isEditing ? 'Save Changes' : 'Create Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function VersionModal({
  onSave,
  onClose,
}: {
  onSave: (data: VersionFormData) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<VersionFormData>({ ...emptyVersionForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateField(field: 'productId' | 'title' | 'description', value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (field === 'title') {
      setForm(prev => ({
        ...prev,
        title: value,
        translations: { ...prev.translations, en: { ...prev.translations.en, title: value } },
      }))
    }
    if (field === 'description') {
      setForm(prev => ({
        ...prev,
        description: value,
        translations: { ...prev.translations, en: { ...prev.translations.en, description: value } },
      }))
    }
  }

  function updateTranslation(lang: 'en' | 'my', field: 'title' | 'description', value: string) {
    setForm(prev => ({
      ...prev,
      translations: {
        ...prev.translations,
        [lang]: { ...prev.translations[lang], [field]: value },
      },
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.productId) {
      setError('Please select a product')
      return
    }
    if (!form.title.trim()) {
      setError('Title is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create version')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">Create Survey Version</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-4">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Product *</label>
            <input
              type="text"
              value={form.productId}
              onChange={e => updateField('productId', e.target.value)}
              className="input"
              placeholder="Product ID"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title (English) *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => updateField('title', e.target.value)}
              className="input"
              placeholder="e.g. Customer Satisfaction Survey v2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description (English)</label>
            <textarea
              value={form.description}
              onChange={e => updateField('description', e.target.value)}
              rows={2}
              className="input resize-none"
              placeholder="Brief description of this survey version"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Myanmar Translation</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
                <input
                  type="text"
                  value={form.translations.my.title}
                  onChange={e => updateTranslation('my', 'title', e.target.value)}
                  className="input bg-white"
                  placeholder="Title in Myanmar"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <input
                  type="text"
                  value={form.translations.my.description}
                  onChange={e => updateTranslation('my', 'description', e.target.value)}
                  className="input bg-white"
                  placeholder="Description in Myanmar"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pb-1 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-gold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              Create Version
            </button>
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
  const [errorQuestions, setErrorQuestions] = useState('')
  const [errorVersions, setErrorVersions] = useState('')
  const [showQuestionModal, setShowQuestionModal] = useState(false)
  const [showVersionModal, setShowVersionModal] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null)
  const [togglingQuestionId, setTogglingQuestionId] = useState<string | null>(null)

  const fetchQuestions = useCallback(async () => {
    setLoadingQuestions(true)
    setErrorQuestions('')
    try {
      const token = localStorage.getItem('admin_token')
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE}/admin/survey/questions`, { headers })
      const data = await res.json()
      if (data.success) {
        setQuestions(data.data || [])
      } else {
        setErrorQuestions(data.message || 'Failed to load questions')
      }
    } catch {
      setErrorQuestions('Could not connect to the server')
    } finally {
      setLoadingQuestions(false)
    }
  }, [])

  const fetchVersions = useCallback(async () => {
    setLoadingVersions(true)
    setErrorVersions('')
    try {
      const token = localStorage.getItem('admin_token')
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE}/admin/survey/versions`, { headers })
      const data = await res.json()
      if (data.success) {
        setVersions(data.data || [])
      } else {
        setErrorVersions(data.message || 'Failed to load versions')
      }
    } catch {
      setErrorVersions('Could not connect to the server')
    } finally {
      setLoadingVersions(false)
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/products`)
      const data = await res.json()
      if (data.success) {
        setProducts(data.data || [])
      }
    } catch {
      // product list is optional for the question form
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchQuestions()
    fetchVersions()
    fetchProducts()
  }, [fetchQuestions, fetchVersions, fetchProducts])

  async function handleToggleQuestionActive(question: SurveyQuestion) {
    setTogglingQuestionId(question.id)
    try {
      const token = localStorage.getItem('admin_token')
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }
      const res = await fetch(`${API_BASE}/admin/survey/questions/${question.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isActive: !question.is_active }),
      })
      const data = await res.json()
      if (data.success) {
        setQuestions(prev =>
          prev.map(q => (q.id === question.id ? { ...q, is_active: !q.is_active } : q))
        )
      }
    } catch {
      // silent
    } finally {
      setTogglingQuestionId(null)
    }
  }

  async function handleDeleteQuestion(id: string) {
    if (!confirm('Are you sure you want to delete this question?')) return
    try {
      const token = localStorage.getItem('admin_token')
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE}/admin/survey/questions/${id}`, {
        method: 'DELETE',
        headers,
      })
      const data = await res.json()
      if (data.success) {
        setQuestions(prev => prev.filter(q => q.id !== id))
      }
    } catch {
      // silent
    }
  }

  async function handleSaveQuestion(formData: QuestionFormData) {
    const token = localStorage.getItem('admin_token')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    if (editingQuestion) {
      const res = await fetch(`${API_BASE}/admin/survey/questions/${editingQuestion.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          questionText: formData.questionText,
          questionType: formData.questionType,
          isRequired: formData.isRequired,
          displayOrder: formData.displayOrder,
          translations: formData.translations,
          imageUrl: formData.imageUrl,
          productType: formData.productType,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update question')
    } else {
      const res = await fetch(`${API_BASE}/admin/survey/questions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to create question')
    }
    await fetchQuestions()
  }

  async function handleSaveVersion(formData: VersionFormData) {
    const token = localStorage.getItem('admin_token')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
    const res = await fetch(`${API_BASE}/admin/survey/versions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(formData),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message || 'Failed to create version')
    await fetchVersions()
  }

  function openAddQuestionModal() {
    setEditingQuestion(null)
    setShowQuestionModal(true)
  }

  function openEditQuestionModal(question: SurveyQuestion) {
    setEditingQuestion(question)
    setShowQuestionModal(true)
  }

  function closeQuestionModal() {
    setShowQuestionModal(false)
    setEditingQuestion(null)
  }

  function questionTypeLabel(type: string) {
    return questionTypes.find(qt => qt.value === type)?.label || type
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Surveys</h1>
        <p className="mt-1 text-sm text-slate-500">Manage survey questions and versions</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('questions')}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'questions'
                ? 'border-gold-500 text-gold-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Questions
            {!loadingQuestions && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{questions.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('versions')}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'versions'
                ? 'border-gold-500 text-gold-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Versions
            {!loadingVersions && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{versions.length}</span>
            )}
          </button>
        </nav>
      </div>

      {/* Questions Tab */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {loadingQuestions ? 'Loading...' : `${questions.length} questions`}
            </p>
            {!loadingQuestions && questions.length > 0 && (
              <button onClick={openAddQuestionModal} className="btn-gold shadow-gold">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Question
              </button>
            )}
          </div>

          {loadingQuestions && <LoadingSkeleton />}

          {!loadingQuestions && errorQuestions && (
            <ErrorState message={errorQuestions} onRetry={fetchQuestions} />
          )}

          {!loadingQuestions && !errorQuestions && questions.length === 0 && (
            <EmptyState message="No questions yet" onAdd={openAddQuestionModal} />
          )}

          {!loadingQuestions && !errorQuestions && questions.length > 0 && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70">
                      <th className="w-8 px-4 py-3 text-left font-medium text-slate-500">#</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">Question</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">Type</th>
                      <th className="px-4 py-3 text-center font-medium text-slate-500">Order</th>
                      <th className="px-4 py-3 text-center font-medium text-slate-500">Options</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">Version</th>
                      <th className="px-4 py-3 text-center font-medium text-slate-500">Active</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions
                      .sort((a, b) => a.display_order - b.display_order)
                      .map((q, index) => (
                      <tr
                        key={q.id}
                        className="border-b border-slate-100 transition-colors hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-3 font-medium text-slate-400">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="max-w-xs min-w-0">
                            <p className="truncate font-medium text-ink">{q.question_text}</p>
                            {q.product_name && (
                              <p className="truncate text-xs text-slate-400">{q.product_name}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-semibold text-gold-600 ring-1 ring-inset ring-gold-200">
                            {questionTypeLabel(q.question_type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">{q.display_order}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            {q.option_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{q.version_title || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <Toggle
                              checked={q.is_active}
                              onChange={() => handleToggleQuestionActive(q)}
                              disabled={togglingQuestionId === q.id}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditQuestionModal(q)}
                              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-gold/10 hover:text-gold-600"
                              title="Edit question"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              title="Delete question"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Versions Tab */}
      {activeTab === 'versions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {loadingVersions ? 'Loading...' : `${versions.length} versions`}
            </p>
            {!loadingVersions && (
              <button
                onClick={() => setShowVersionModal(true)}
                className="btn-gold shadow-gold"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Version
              </button>
            )}
          </div>

          {loadingVersions && <LoadingSkeleton />}

          {!loadingVersions && errorVersions && (
            <ErrorState message={errorVersions} onRetry={fetchVersions} />
          )}

          {!loadingVersions && !errorVersions && versions.length === 0 && (
            <EmptyState message="No survey versions yet" onAdd={() => setShowVersionModal(true)} />
          )}

          {!loadingVersions && !errorVersions && versions.length > 0 && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70">
                      <th className="w-8 px-4 py-3 text-left font-medium text-slate-500">#</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">Title</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">Product</th>
                      <th className="px-4 py-3 text-center font-medium text-slate-500">Version</th>
                      <th className="px-4 py-3 text-center font-medium text-slate-500">Questions</th>
                      <th className="px-4 py-3 text-center font-medium text-slate-500">Responses</th>
                      <th className="px-4 py-3 text-center font-medium text-slate-500">Active</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((v, index) => (
                      <tr
                        key={v.id}
                        className="border-b border-slate-100 transition-colors hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-3 font-medium text-slate-400">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{v.title}</p>
                            {v.description && (
                              <p className="max-w-[240px] truncate text-xs text-slate-400">{v.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{v.product_name || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-semibold text-gold-600 ring-1 ring-inset ring-gold-200">
                            v{v.version}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            {v.question_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                            {v.response_count.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <Toggle checked={v.is_active} onChange={() => {}} disabled />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {new Date(v.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showQuestionModal && (
        <QuestionModal
          versions={versions}
          products={products}
          question={editingQuestion}
          onSave={handleSaveQuestion}
          onClose={closeQuestionModal}
        />
      )}

      {showVersionModal && (
        <VersionModal
          onSave={handleSaveVersion}
          onClose={() => setShowVersionModal(false)}
        />
      )}
    </div>
  )
}