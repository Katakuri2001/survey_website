'use client'

import { useState, useEffect } from 'react'

import { API_BASE } from '../lib/api'

const CHART_COLORS = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-violet-500',
]

type HorizontalBarItem = Record<string, string | number | undefined>
interface PopularityItem { name: string; response_count: number; percentage?: number }
interface RatingItem { name: string; avg_rating: number }
interface AgeGroupItem { age_group: string; avg_rating: number; response_count: number }
interface ComparisonItem {
  name: string
  total_responses: number
  avg_rating: number
  taste_rating: number
  packaging_rating: number
  value_rating: number
  recommendation_rate: number
}
interface TrendItem { date: string; count: number }
interface ProductItem { id: string; name: string }

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-64">
          <div className="h-4 bg-gray-200 rounded w-32 mb-6" />
          <div className="h-40 bg-gray-100 rounded" />
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-64">
          <div className="h-4 bg-gray-200 rounded w-32 mb-6" />
          <div className="h-40 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
      <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-900 mb-1">Failed to load data</p>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
  )
}

function HorizontalBarChart<T extends HorizontalBarItem>({ data, labelKey, valueKey, colorKey }: {
  data: T[]
  labelKey: keyof T
  valueKey: keyof T
  colorKey?: keyof T
}) {
  const maxValue = Math.max(...data.map(d => Number(d[valueKey] || 0)), 1)
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600 truncate max-w-[60%]">{item[labelKey]}</span>
            <span className="text-sm font-medium text-gray-900">{typeof item[valueKey] === 'number' && item[valueKey] % 1 !== 0 ? (item[valueKey] as number).toFixed(2) : item[valueKey]}</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${colorKey ? item[colorKey] : CHART_COLORS[i % CHART_COLORS.length]}`}
              style={{ width: `${(Number(item[valueKey] || 0) / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {data.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No data available</p>}
    </div>
  )
}

function StatCard({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-1">{sublabel}</p>}
    </div>
  )
}

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <svg key={star} className={`w-4 h-4 ${star <= full ? 'text-amber-400' : star === full + 1 && half ? 'text-amber-300' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-sm font-medium text-gray-700">{rating.toFixed(1)}</span>
    </div>
  )
}

function ComparisonTable({ data }: { data: ComparisonItem[] }) {
  if (data.length === 0) return <p className="text-sm text-gray-400 text-center py-8">No comparison data available</p>

  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 px-3 font-medium text-gray-500">Product</th>
            <th className="text-right py-3 px-3 font-medium text-gray-500">Responses</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">Avg Rating</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">Taste</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">Packaging</th>
            <th className="text-center py-3 px-3 font-medium text-gray-500">Value</th>
            <th className="text-right py-3 px-3 font-medium text-gray-500">Recommend</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
              <td className="py-3 px-3 font-medium text-gray-900">{row.name}</td>
              <td className="py-3 px-3 text-right text-gray-600">{row.total_responses}</td>
              <td className="py-3 px-3">
                <div className="flex justify-center">
                  <RatingStars rating={row.avg_rating || 0} />
                </div>
              </td>
              <td className="py-3 px-3 text-center text-gray-600">{(row.taste_rating || 0).toFixed(1)}</td>
              <td className="py-3 px-3 text-center text-gray-600">{(row.packaging_rating || 0).toFixed(1)}</td>
              <td className="py-3 px-3 text-center text-gray-600">{(row.value_rating || 0).toFixed(1)}</td>
              <td className="py-3 px-3 text-right">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  (row.recommendation_rate || 0) >= 70 ? 'bg-emerald-50 text-emerald-700' :
                  (row.recommendation_rate || 0) >= 40 ? 'bg-amber-50 text-amber-700' :
                  'bg-rose-50 text-rose-700'
                }`}>
                  {(row.recommendation_rate || 0).toFixed(0)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AgeGroupChart({ data, productName }: { data: AgeGroupItem[]; productName: string }) {
  if (data.length === 0) return <p className="text-sm text-gray-400 text-center py-8">No age group data available</p>

  const maxValue = Math.max(...data.map(d => d.avg_rating || 0), 5)

  return (
    <div>
      {productName && (
        <p className="text-sm text-gray-500 mb-4">Showing data for: <span className="font-medium text-gray-700">{productName}</span></p>
      )}
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-4">
            <span className="text-sm text-gray-600 w-20 shrink-0 text-right">{item.age_group}</span>
            <div className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden relative">
              <div
                className={`h-full rounded-lg transition-all duration-500 ${CHART_COLORS[i % CHART_COLORS.length]}`}
                style={{ width: `${((item.avg_rating || 0) / maxValue) * 100}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-gray-700">
                {item.avg_rating ? item.avg_rating.toFixed(2) : '0'} ({item.response_count} responses)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ParticipationTrend({ data }: { data: { date: string; count: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-gray-400 text-center py-8">No trend data available</p>

  const maxCount = Math.max(...data.map(d => d.count), 1)
  const totalResponses = data.reduce((sum, d) => sum + d.count, 0)
  const avgDaily = (totalResponses / data.length).toFixed(0)

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Total:</span>
          <span className="text-sm font-semibold text-gray-900">{totalResponses.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Avg/day:</span>
          <span className="text-sm font-semibold text-gray-900">{avgDaily}</span>
        </div>
      </div>
      <div className="flex items-end gap-[3px] h-40">
        {data.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0 group relative">
            <div className="w-full rounded-t transition-all duration-300 bg-indigo-500 hover:bg-indigo-600" style={{ height: `${(item.count / maxCount) * 100}%`, minHeight: '2px' }} />
            <span className="text-[10px] text-gray-400 -rotate-45 origin-top-left whitespace-nowrap">
              {item.date.slice(5)}
            </span>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
              {item.date}: {item.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [popularity, setPopularity] = useState<PopularityItem[]>([])
  const [ratings, setRatings] = useState<RatingItem[]>([])
  const [ageGroups, setAgeGroups] = useState<AgeGroupItem[]>([])
  const [comparison, setComparison] = useState<ComparisonItem[]>([])
  const [trend, setTrend] = useState<TrendItem[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [trendPeriod, setTrendPeriod] = useState<number>(30)

  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchAllData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedProductId) {
      fetchAgeGroups(selectedProductId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId])

  useEffect(() => {
    fetchTrend(trendPeriod)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendPeriod])

  async function fetchWithAuth(url: string) {
    const token = localStorage.getItem('admin_token')
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    const res = await fetch(url, { headers })
    return res.json()
  }

  async function fetchAllData() {
    setLoading(true)
    setErrors({})
    try {
      const [popRes, ratRes, compRes, trendRes, prodRes] = await Promise.allSettled([
        fetchWithAuth(`${API_BASE}/admin/analytics/popularity`),
        fetchWithAuth(`${API_BASE}/admin/analytics/ratings`),
        fetchWithAuth(`${API_BASE}/admin/analytics/comparison`),
        fetchWithAuth(`${API_BASE}/admin/analytics/trend?period=${trendPeriod}`),
        fetchWithAuth(`${API_BASE}/products`),
      ])

      const newErrors: Record<string, string> = {}

      if (popRes.status === 'fulfilled' && popRes.value.success) {
        setPopularity(popRes.value.data)
      } else {
        newErrors.popularity = 'Failed to load popularity data'
      }

      if (ratRes.status === 'fulfilled' && ratRes.value.success) {
        setRatings(ratRes.value.data)
      } else {
        newErrors.ratings = 'Failed to load ratings data'
      }

      if (compRes.status === 'fulfilled' && compRes.value.success) {
        setComparison(compRes.value.data)
      } else {
        newErrors.comparison = 'Failed to load comparison data'
      }

      if (trendRes.status === 'fulfilled' && trendRes.value.success) {
        setTrend(trendRes.value.data)
      } else {
        newErrors.trend = 'Failed to load trend data'
      }

      if (prodRes.status === 'fulfilled' && prodRes.value.success) {
        const prods = prodRes.value.data?.products || prodRes.value.data || []
        setProducts(Array.isArray(prods) ? prods : [])
      }

      setErrors(newErrors)
    } catch {
      setErrors({ general: 'Failed to connect to server' })
    } finally {
      setLoading(false)
    }
  }

  async function fetchAgeGroups(productId: string) {
    try {
      const res = await fetchWithAuth(`${API_BASE}/admin/analytics/age-groups?productId=${productId}`)
      if (res.success) {
        setAgeGroups(res.data)
      }
    } catch {
      setErrors(prev => ({ ...prev, ageGroups: 'Failed to load age group data' }))
    }
  }

  async function fetchTrend(period: number) {
    try {
      const res = await fetchWithAuth(`${API_BASE}/admin/analytics/trend?period=${period}`)
      if (res.success) {
        setTrend(res.data)
      }
    } catch {
      setErrors(prev => ({ ...prev, trend: 'Failed to load trend data' }))
    }
  }

  const selectedProductName = products.find(p => p.id === selectedProductId)?.name || ''

  const totalResponses = popularity.reduce((sum, p) => sum + (p.response_count || 0), 0)
  const avgOverallRating = ratings.length > 0
    ? (ratings.reduce((sum, r) => sum + (r.avg_rating || 0), 0) / ratings.length).toFixed(2)
    : '0.00'
  const totalProducts = popularity.length
  const topProduct = popularity.length > 0 ? popularity.reduce((a, b) => (a.response_count > b.response_count ? a : b)) : null

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Loading analytics data...</p>
        </div>
        <LoadingSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Survey performance and product insights</p>
        </div>
        <button
          onClick={fetchAllData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {errors.general && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
          <p className="text-sm text-rose-700">{errors.general}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Responses" value={totalResponses.toLocaleString()} sublabel="Across all products" />
        <StatCard label="Active Products" value={totalProducts} sublabel="In the system" />
        <StatCard label="Avg Rating" value={avgOverallRating} sublabel="Overall satisfaction" />
        <StatCard
          label="Top Product"
          value={topProduct?.name || 'N/A'}
          sublabel={topProduct ? `${topProduct.response_count} responses` : 'No data yet'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <SectionHeader title="Product Popularity" subtitle="Responses by product" />
          {errors.popularity ? (
            <ErrorState message={errors.popularity} />
          ) : (
            <HorizontalBarChart
              data={popularity.map(p => ({ name: p.name, value: p.response_count || 0 }))}
              labelKey="name"
              valueKey="value"
            />
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <SectionHeader title="Average Ratings" subtitle="Satisfaction score by product" />
          {errors.ratings ? (
            <ErrorState message={errors.ratings} />
          ) : (
            <div className="space-y-4">
              {ratings.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm font-medium text-gray-700">{r.name}</span>
                  <RatingStars rating={r.avg_rating || 0} />
                </div>
              ))}
              {ratings.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No ratings data</p>}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <SectionHeader title="Rating by Age Group" subtitle="Breakdown of ratings across demographics" />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Product</label>
            <select
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            >
              <option value="">Choose a product...</option>
              {products.map((p: ProductItem) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {selectedProductId ? (
            errors.ageGroups ? (
              <ErrorState message={errors.ageGroups} />
            ) : (
              <AgeGroupChart data={ageGroups} productName={selectedProductName} />
            )
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">Select a product to view age group breakdown</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <SectionHeader title="Participation Trend" subtitle="Daily survey responses" />
          <div className="flex items-center gap-2 mb-4">
            {[7, 14, 30, 60].map(period => (
              <button
                key={period}
                onClick={() => setTrendPeriod(period)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  trendPeriod === period
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {period}d
              </button>
            ))}
          </div>
          {errors.trend ? (
            <ErrorState message={errors.trend} />
          ) : (
            <ParticipationTrend data={trend} />
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <SectionHeader title="Product Comparison" subtitle="Side-by-side comparison of all products" />
        {errors.comparison ? (
          <ErrorState message={errors.comparison} />
        ) : (
          <ComparisonTable data={comparison} />
        )}
      </div>
    </div>
  )
}
