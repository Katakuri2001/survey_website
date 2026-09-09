'use client'

import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import Header from '../components/Header'

const myanmarStates = [
  'ကချင်ပြည်နယ်', 'ကယားပြည်နယ်', 'ကရင်ပြည်နယ်', 'ချင်းပြည်နယ်',
  'မကွေးတိုင်းဒေသကြီး', 'မန္တလေးတိုင်းဒေသကြီး', 'မွန်ပြည်နယ်', 'ရခိုင်ပြည်နယ်',
  'ရှမ်းပြည်နယ်', 'ဧရိဝတီတိုင်းဒေသကြီး', 'ရန်ကုန်တိုင်းဒေသကြီး',
  'နေပြည်တော် ပြည်ထောင်စုနယ်မြေ'
]

const nrcTypes = ['နိုင်ငံသား', 'နိုင်ငံသား', 'ဧရိယာ']

export default function InfoPage() {
  const { t } = useLanguage()
  const [formData, setFormData] = useState({
    dobDay: '',
    dobMonth: '',
    dobYear: '',
    gender: '',
    nrcState: '',
    nrcType: '',
    nrcNumber: '',
    occupation: '',
    city: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    window.location.href = '/survey'
  }

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1))
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1))
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 60 }, (_, i) => String(currentYear - 18 - i))

  const selectClass = "w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-yellow-400 focus:outline-none text-white appearance-none cursor-pointer"
  const optionClass = "bg-gray-800 text-white"

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-800 text-white">
      <Header title={t('infoTitle')} backHref="/login" />
      
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <p className="text-blue-200">{t('infoDesc')}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          
          {/* DOB */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-blue-200 mb-2">{t('dob')}</label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-blue-300 mb-1">{t('day')}</label>
                <select
                  value={formData.dobDay}
                  onChange={(e) => setFormData({...formData, dobDay: e.target.value})}
                  className={selectClass}
                >
                  <option value="" className={optionClass}>{t('day')}</option>
                  {days.map(d => (
                    <option key={d} value={d} className={optionClass}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-blue-300 mb-1">{t('month')}</label>
                <select
                  value={formData.dobMonth}
                  onChange={(e) => setFormData({...formData, dobMonth: e.target.value})}
                  className={selectClass}
                >
                  <option value="" className={optionClass}>{t('month')}</option>
                  {months.map(m => (
                    <option key={m} value={m} className={optionClass}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-blue-300 mb-1">{t('year')}</label>
                <select
                  value={formData.dobYear}
                  onChange={(e) => setFormData({...formData, dobYear: e.target.value})}
                  className={selectClass}
                >
                  <option value="" className={optionClass}>{t('year')}</option>
                  {years.map(y => (
                    <option key={y} value={y} className={optionClass}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Gender */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-blue-200 mb-2">{t('gender')}</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'male', label: t('male') },
                { value: 'female', label: t('female') },
                { value: 'other', label: t('other') }
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({...formData, gender: option.value})}
                  className={`py-3 rounded-xl font-medium transition-all ${
                    formData.gender === option.value
                      ? 'bg-yellow-500 text-blue-900'
                      : 'bg-white/10 border border-white/20 hover:bg-white/20'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* NRC */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-blue-200 mb-2">{t('nrc')}</label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <select
                value={formData.nrcState}
                onChange={(e) => setFormData({...formData, nrcState: e.target.value})}
                className={selectClass}
              >
                <option value="" className={optionClass}>{t('stateRegion')}</option>
                {myanmarStates.map(s => (
                  <option key={s} value={s} className={optionClass}>{s}</option>
                ))}
              </select>
              <select
                value={formData.nrcType}
                onChange={(e) => setFormData({...formData, nrcType: e.target.value})}
                className={selectClass}
              >
                <option value="" className={optionClass}>{t('nrcType')}</option>
                {nrcTypes.map((n, i) => (
                  <option key={i} value={n} className={optionClass}>{n}</option>
                ))}
              </select>
              <input
                type="text"
                value={formData.nrcNumber}
                onChange={(e) => setFormData({...formData, nrcNumber: e.target.value})}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-yellow-400 focus:outline-none text-white placeholder-blue-300"
                placeholder={t('nrcPlaceholder')}
                maxLength={6}
              />
            </div>
            <p className="text-xs text-blue-300">{t('nrcExample')}</p>
          </div>

          {/* Occupation */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-blue-200 mb-2">{t('occupation')}</label>
            <input
              type="text"
              value={formData.occupation}
              onChange={(e) => setFormData({...formData, occupation: e.target.value})}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-yellow-400 focus:outline-none text-white placeholder-blue-300"
              placeholder={t('occupationPlaceholder')}
            />
          </div>

          {/* City */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-blue-200 mb-2">{t('city')}</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({...formData, city: e.target.value})}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:border-yellow-400 focus:outline-none text-white placeholder-blue-300"
              placeholder={t('cityPlaceholder')}
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-yellow-500 text-blue-900 rounded-xl font-bold hover:bg-yellow-400 transition-all"
          >
            {t('next')}
          </button>
        </form>
      </div>
    </div>
  )
}