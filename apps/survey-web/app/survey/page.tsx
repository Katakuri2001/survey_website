'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'

const API_BASE = 'http://localhost:8787'

interface Question {
  id: string
  question_text: string
  question_type: string
  is_required: boolean
  display_order: number
  options: { id: string; option_text: string; option_value: string }[]
}

interface Answer {
  questionId: string
  type: string
  value: string | number | string[]
}

export default function SurveyPage() {
  const { t, language } = useLanguage()
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewMode, setReviewMode] = useState(false)

  // Get product ID from URL or default
  const productId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('product') || 'prod-1'
    : 'prod-1'

  useEffect(() => {
    fetchQuestions()
  }, [language])

  async function fetchQuestions() {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/survey/questions/${productId}?lang=${language}`)
      const data = await res.json()

      if (data.success && data.data.questions) {
        setQuestions(data.data.questions)
      } else {
        // Fallback to hardcoded questions if API fails
        setQuestions([
          { id: 'q1', question_text: t('q1'), question_type: 'single_choice', is_required: true, display_order: 1, options: [
            { id: 'q1_a', option_text: t('q1_a'), option_value: 'daily' },
            { id: 'q1_b', option_text: t('q1_b'), option_value: 'weekly' },
            { id: 'q1_c', option_text: t('q1_c'), option_value: 'monthly' },
            { id: 'q1_d', option_text: t('q1_d'), option_value: 'occasionally' },
            { id: 'q1_e', option_text: t('q1_e'), option_value: 'never' },
          ]},
          { id: 'q2', question_text: t('q2'), question_type: 'single_choice', is_required: true, display_order: 2, options: [
            { id: 'q2_a', option_text: t('q2_a'), option_value: 'premium' },
            { id: 'q2_b', option_text: t('q2_b'), option_value: 'light' },
            { id: 'q2_c', option_text: t('q2_c'), option_value: 'gold' },
            { id: 'q2_d', option_text: t('q2_d'), option_value: 'all' },
          ]},
          { id: 'q3', question_text: t('q3'), question_type: 'single_choice', is_required: true, display_order: 3, options: [
            { id: 'q3_a', option_text: t('q3_a'), option_value: 'quality' },
            { id: 'q3_b', option_text: t('q3_b'), option_value: 'price' },
            { id: 'q3_c', option_text: t('q3_c'), option_value: 'taste' },
            { id: 'q3_d', option_text: t('q3_d'), option_value: 'brand' },
            { id: 'q3_e', option_text: t('q3_e'), option_value: 'availability' },
          ]},
          { id: 'q4', question_text: t('q4'), question_type: 'single_choice', is_required: true, display_order: 4, options: [
            { id: 'q4_a', option_text: t('q4_a'), option_value: 'liquor_store' },
            { id: 'q4_b', option_text: t('q4_b'), option_value: 'supermarket' },
            { id: 'q4_c', option_text: t('q4_c'), option_value: 'restaurant' },
            { id: 'q4_d', option_text: t('q4_d'), option_value: 'online' },
            { id: 'q4_e', option_text: t('q4_e'), option_value: 'convenience' },
          ]},
          { id: 'q5', question_text: t('q5'), question_type: 'single_choice', is_required: true, display_order: 5, options: [
            { id: 'q5_a', option_text: t('q5_a'), option_value: 'very_satisfied' },
            { id: 'q5_b', option_text: t('q5_b'), option_value: 'satisfied' },
            { id: 'q5_c', option_text: t('q5_c'), option_value: 'neutral' },
            { id: 'q5_d', option_text: t('q5_d'), option_value: 'dissatisfied' },
            { id: 'q5_e', option_text: t('q5_e'), option_value: 'very_dissatisfied' },
          ]},
          { id: 'q6', question_text: t('q6'), question_type: 'single_choice', is_required: true, display_order: 6, options: [
            { id: 'q6_a', option_text: t('q6_a'), option_value: 'definitely_yes' },
            { id: 'q6_b', option_text: t('q6_b'), option_value: 'probably_yes' },
            { id: 'q6_c', option_text: t('q6_c'), option_value: 'not_sure' },
            { id: 'q6_d', option_text: t('q6_d'), option_value: 'probably_no' },
            { id: 'q6_e', option_text: t('q6_e'), option_value: 'definitely_no' },
          ]},
          { id: 'q7', question_text: t('q7'), question_type: 'rating', is_required: true, display_order: 7, options: [
            { id: 'q7_a', option_text: '1', option_value: '1' },
            { id: 'q7_b', option_text: '2', option_value: '2' },
            { id: 'q7_c', option_text: '3', option_value: '3' },
            { id: 'q7_d', option_text: '4', option_value: '4' },
            { id: 'q7_e', option_text: '5', option_value: '5' },
          ]},
          { id: 'q8', question_text: t('q8'), question_type: 'multiple_choice', is_required: false, display_order: 8, options: [
            { id: 'q8_a', option_text: t('q8_a'), option_value: 'fruit_flavored' },
            { id: 'q8_b', option_text: t('q8_b'), option_value: 'low_calorie' },
            { id: 'q8_c', option_text: t('q8_c'), option_value: 'non_alcoholic' },
            { id: 'q8_d', option_text: t('q8_d'), option_value: 'larger_bottle' },
            { id: 'q8_e', option_text: t('q8_e'), option_value: 'limited_edition' },
          ]},
          { id: 'q9', question_text: t('q9'), question_type: 'text', is_required: false, display_order: 9, options: [] },
        ])
      }
    } catch (err) {
      setError('Failed to load survey questions')
    } finally {
      setLoading(false)
    }
  }

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
      const answerArray = Object.values(answers)
      const res = await fetch(`${API_BASE}/survey/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          language,
          answers: answerArray,
        })
      })
      const data = await res.json()

      if (data.success) {
        // Store response ID for spin
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('survey_response_id', data.data.responseId)
        }
        window.location.href = '/spin'
      } else {
        setError(data.error?.message || 'Failed to submit')
      }
    } catch (err) {
      setError('Connection failed')
    } finally {
      setSubmitting(false)
    }
  }

  const progress = reviewMode ? 100 : ((currentQuestion + 1) / questions.length) * 100
  const currentQ = questions[currentQuestion]
  const selectedOptions = currentQ ? (answers[currentQ.id]?.value as string[]) || [] : []

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

  // Review mode
  if (reviewMode) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-800 text-white">
        <Header title={t('surveyTitle')} backHref="/survey" />
        
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-yellow-300">{language === 'my' ? 'အဖြေများ ပြန်ကြည့်ပါ' : 'Review Your Answers'}</h2>
          </div>

          <div className="space-y-3">
            {questions.map((q, i) => {
              const answer = answers[q.id]
              let displayAnswer = ''

              if (answer) {
                if (q.question_type === 'rating') {
                  displayAnswer = '★'.repeat(Number(answer.value)) + '☆'.repeat(5 - Number(answer.value))
                } else if (q.question_type === 'multiple_choice' && Array.isArray(answer.value)) {
                  displayAnswer = answer.value.join(', ')
                } else if (q.question_type === 'text') {
                  displayAnswer = String(answer.value) || '-'
                } else {
                  const option = q.options.find(o => o.option_value === answer.value)
                  displayAnswer = option?.option_text || String(answer.value)
                }
              }

              return (
                <div key={q.id} className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-blue-200">{q.question_text}</p>
                      <p className="text-white font-medium mt-1">{displayAnswer || <span className="text-blue-300">Not answered</span>}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={handlePrev} className="flex-1 py-3 bg-white/10 border border-white/20 rounded-xl font-medium hover:bg-white/20 transition-all">
              {t('back')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-400 transition-all disabled:opacity-50"
            >
              {submitting ? t('loading') : t('submit')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-800 text-white">
      <Header title={t('surveyTitle')} backHref="/info" />
      
      {/* Progress */}
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-blue-200">{t('question')} {currentQuestion + 1} / {questions.length}</span>
          <span className="text-sm text-yellow-400 font-medium">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-blue-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-yellow-400 rounded-full transition-all duration-300" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="max-w-lg mx-auto px-4">
          <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-sm text-red-200">
            {error}
          </div>
        </div>
      )}

      {/* Survey Content */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <h2 className="text-xl font-bold mb-6 text-yellow-300">
            {currentQ?.question_text}
          </h2>

          {currentQ?.question_type === 'text' ? (
            <textarea
              value={(answers[currentQ.id]?.value as string) || ''}
              onChange={(e) => handleTextChange(currentQ.id, e.target.value)}
              className="w-full h-32 px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-yellow-400 focus:outline-none text-white placeholder-blue-300 resize-none"
              placeholder={language === 'my' ? 'သင့်အဖြေကို ရေးပါ...' : 'Type your answer...'}
            />
          ) : currentQ?.question_type === 'rating' ? (
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  onClick={() => handleRating(currentQ.id, rating)}
                  className={`w-14 h-14 rounded-xl text-2xl font-bold transition-all ${
                    Number(answers[currentQ.id]?.value) >= rating
                      ? 'bg-yellow-400 text-blue-900'
                      : 'bg-white/10 border border-white/20 hover:bg-yellow-400/20'
                  }`}
                >
                  {rating}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {currentQ?.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleSelect(currentQ.id, option.option_value, currentQ.question_type)}
                  className={`w-full p-4 border rounded-xl text-left transition-all ${
                    currentQ.question_type === 'multiple_choice'
                      ? selectedOptions.includes(option.option_value)
                        ? 'bg-yellow-500/30 border-yellow-400 text-white'
                        : 'bg-white/10 border-white/20 hover:bg-yellow-500/20 hover:border-yellow-400/50'
                      : answers[currentQ.id]?.value === option.option_value
                        ? 'bg-yellow-500/30 border-yellow-400 text-white'
                        : 'bg-white/10 border-white/20 hover:bg-yellow-500/20 hover:border-yellow-400/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      currentQ.question_type === 'multiple_choice'
                        ? selectedOptions.includes(option.option_value) ? 'border-yellow-400 bg-yellow-400' : 'border-white/40'
                        : answers[currentQ.id]?.value === option.option_value ? 'border-yellow-400 bg-yellow-400' : 'border-white/40'
                    }`}>
                      {(currentQ.question_type === 'multiple_choice'
                        ? selectedOptions.includes(option.option_value)
                        : answers[currentQ.id]?.value === option.option_value
                      ) && (
                        <svg className="w-3 h-3 text-blue-900" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <span>{option.option_text}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex gap-3">
          <button 
            onClick={handlePrev}
            disabled={currentQuestion === 0 && !reviewMode}
            className="flex-1 py-3 bg-white/10 border border-white/20 rounded-xl font-medium hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('back')}
          </button>
          <button 
            onClick={handleNext}
            className="flex-1 py-3 bg-yellow-500 text-blue-900 rounded-xl font-bold hover:bg-yellow-400 transition-all"
          >
            {currentQuestion === questions.length - 1 ? (language === 'my' ? 'ပြန်ကြည့်ရန်' : 'Review') : t('next')}
          </button>
        </div>
      </div>
    </div>
  )
}