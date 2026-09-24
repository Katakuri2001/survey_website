'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'

import { API_BASE, adminHeaders, apiErrorMessage, readApiPayload } from '../lib/api'

type HorizontalBarItem = Record<string, string | number | undefined>
interface PopularityItem { name: string; response_count: number; percentage?: number }
interface RatingItem { name: string; avg_rating: number }
interface AgeGroupItem { age_group: string; avg_rating: number; response_count: number }
interface ComparisonItem { name: string; total_responses: number; avg_rating: number; taste_rating: number; packaging_rating: number; value_rating: number; recommendation_rate: number }
interface TrendItem { date: string; count: number }
interface ProductItem { id: string; name: string }

function isAbortError(error: unknown): boolean {
  return (error instanceof DOMException && error.name === 'AbortError') || (error instanceof Error && error.name === 'AbortError')
}

function LoadingSkeleton() {
  return <div className="space-y-6 animate-pulse"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="card p-5"><div className="h-10 w-10 rounded-xl bg-slate-200" /><div className="mt-4 h-3 w-24 rounded bg-slate-200" /><div className="mt-2 h-7 w-16 rounded bg-slate-200" /></div>)}</div><div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><div className="card h-64 p-6"><div className="mb-6 h-4 w-32 rounded bg-slate-200" /><div className="h-40 rounded bg-slate-100" /></div><div className="card h-64 p-6"><div className="mb-6 h-4 w-32 rounded bg-slate-200" /><div className="h-40 rounded bg-slate-100" /></div></div></div>
}

function ErrorState({ message }: { message: string }) {
  return <div className="card p-8 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50"><svg className="h-6 w-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg></div><p className="mb-1 text-sm font-medium text-ink">Failed to load data</p><p className="text-sm text-slate-500">{message}</p></div>
}

function InlineError({ message }: { message: string }) {
  return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{message}</div>
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div className="mb-4"><h2 className="font-display text-base font-semibold text-ink">{title}</h2>{subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}</div>
}

const EMPTY_TICK = { fill: '#94A3B8', fontSize: 11 }
const TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 10px 25px -5px rgb(15 23 42 / 0.1)', fontSize: 12 }

function HorizontalBarChart<T extends HorizontalBarItem>({ data, labelKey, valueKey }: { data: T[]; labelKey: keyof T; valueKey: keyof T }) {
  if (data.length === 0) return <p className="py-4 text-center text-sm text-slate-400">No data available</p>
  const rows = data.map((item) => ({ name: String(item[labelKey] ?? ''), value: Number(item[valueKey] || 0) }))
  return <div><div className="mb-3 flex items-center gap-4 text-[11px] font-medium text-slate-500"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gold-400" /> Popular</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-stout-500" /> Growing</span></div><div className="h-64"><ResponsiveContainer width="100%" height="100%"><ReBarChart data={rows} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}><defs><linearGradient id="goldBar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#E2C97F" /><stop offset="100%" stopColor="#C9AC5A" /></linearGradient><linearGradient id="emeraldBar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#E01B2C" /><stop offset="100%" stopColor="#B8121F" /></linearGradient></defs><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: 'rgba(226, 201, 127, 0.08)' }} contentStyle={TOOLTIP_STYLE} formatter={(value) => [String(value), 'Responses']} /><Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={14}>{rows.map((row, index) => <Cell key={index} fill={index % 2 === 0 ? 'url(#goldBar)' : 'url(#emeraldBar)'} />)}</Bar></ReBarChart></ResponsiveContainer></div></div>
}

function StatCard({ label, value, sublabel, icon }: { label: string; value: string | number; sublabel?: string; icon: string }) {
  return <div className="card animate-fade-up p-5 transition-shadow hover:shadow-card"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10"><svg className="h-5 w-5 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} /></svg></div><p className="mt-4 text-[13px] font-medium text-slate-500">{label}</p><p className="font-display mt-0.5 text-2xl font-bold text-ink">{value}</p>{sublabel && <p className="mt-1 text-xs text-slate-400">{sublabel}</p>}</div>
}

function RatingStars({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return <div className="flex items-center gap-0.5">{[1, 2, 3, 4, 5].map((star) => <svg key={star} className={`h-4 w-4 ${star <= full ? 'text-gold-400' : star === full + 1 && half ? 'text-gold-300' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}<span className="ml-1 text-sm font-medium text-slate-700">{rating.toFixed(1)}</span></div>
}

function ComparisonTable({ data }: { data: ComparisonItem[] }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-slate-400">No comparison data available</p>
  return <div className="-mx-6 overflow-x-auto px-6"><table className="w-full text-sm"><thead><tr className="border-b border-slate-200"><th className="px-3 py-3 text-left font-medium text-slate-500">Product</th><th className="px-3 py-3 text-right font-medium text-slate-500">Responses</th><th className="px-3 py-3 text-center font-medium text-slate-500">Avg Rating</th><th className="px-3 py-3 text-center font-medium text-slate-500">Taste</th><th className="px-3 py-3 text-center font-medium text-slate-500">Packaging</th><th className="px-3 py-3 text-center font-medium text-slate-500">Value</th><th className="px-3 py-3 text-right font-medium text-slate-500">Recommend</th></tr></thead><tbody>{data.map((row, index) => <tr key={`${row.name}-${index}`} className="border-b border-slate-100 hover:bg-slate-50/70"><td className="px-3 py-3 font-medium text-ink">{row.name}</td><td className="px-3 py-3 text-right text-slate-600">{row.total_responses}</td><td className="px-3 py-3"><div className="flex justify-center"><RatingStars rating={row.avg_rating || 0} /></div></td><td className="px-3 py-3 text-center text-slate-600">{(row.taste_rating || 0).toFixed(1)}</td><td className="px-3 py-3 text-center text-slate-600">{(row.packaging_rating || 0).toFixed(1)}</td><td className="px-3 py-3 text-center text-slate-600">{(row.value_rating || 0).toFixed(1)}</td><td className="px-3 py-3 text-right"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${(row.recommendation_rate || 0) >= 70 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : (row.recommendation_rate || 0) >= 40 ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-rose-50 text-rose-700 ring-rose-200'}`}>{(row.recommendation_rate || 0).toFixed(0)}%</span></td></tr>)}</tbody></table></div>
}

function AgeGroupChart({ data, productName }: { data: AgeGroupItem[]; productName: string }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-slate-400">No age group data available</p>
  const maxValue = Math.max(...data.map((item) => item.avg_rating || 0), 5)
  return <div>{productName && <p className="mb-4 text-sm text-slate-500">Showing data for: <span className="font-medium text-ink">{productName}</span></p>}<div className="space-y-3">{data.map((item, index) => <div key={`${item.age_group}-${index}`} className="flex items-center gap-4"><span className="w-20 shrink-0 text-right text-sm text-slate-600">{item.age_group}</span><div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-inset ring-slate-200"><div className={`h-full rounded-lg ${index % 2 === 0 ? 'bg-gradient-to-r from-gold-400 to-gold-500' : 'bg-gradient-to-r from-stout-500 to-stout-600'}`} style={{ width: `${((item.avg_rating || 0) / maxValue) * 100}%` }} /><span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-ink">{item.avg_rating ? item.avg_rating.toFixed(2) : '0'} ({item.response_count} responses)</span></div></div>)}</div></div>
}

function ParticipationTrend({ data }: { data: TrendItem[] }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-slate-400">No trend data available</p>
  const totalResponses = data.reduce((sum, item) => sum + item.count, 0)
  const avgDaily = (totalResponses / data.length).toFixed(0)
  return <div><div className="mb-4 flex items-center gap-4"><div className="flex items-center gap-2"><span className="text-sm text-slate-500">Total:</span><span className="font-display text-sm font-semibold text-ink">{totalResponses.toLocaleString()}</span></div><div className="flex items-center gap-2"><span className="text-sm text-slate-500">Avg/day:</span><span className="font-display text-sm font-semibold text-ink">{avgDaily}</span></div><div className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-slate-500"><span className="h-2 w-2 rounded-full bg-gold-400" /> Gold<span className="ml-2 h-2 w-2 rounded-full bg-stout-500" /> Red</div></div><div className="h-44"><ResponsiveContainer width="100%" height="100%"><ReBarChart data={data} margin={{ top: 6, right: 0, left: -16, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} /><XAxis dataKey="date" tickFormatter={(date: string) => date.slice(5)} tick={EMPTY_TICK} tickLine={false} axisLine={false} minTickGap={20} /><YAxis tick={EMPTY_TICK} tickLine={false} axisLine={false} width={40} allowDecimals={false} /><Tooltip cursor={{ fill: 'rgba(226, 201, 127, 0.08)' }} contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value} responses`, 'Responses']} labelFormatter={(label) => `Date: ${label}`} /><Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={26}>{data.map((item, index) => <Cell key={`${item.date}-${index}`} fill={index % 2 === 0 ? '#E2C97F' : '#E01B2C'} />)}</Bar></ReBarChart></ResponsiveContainer></div></div>
}

export default function AnalyticsPage() {
  const [popularity, setPopularity] = useState<PopularityItem[]>([])
  const [ratings, setRatings] = useState<RatingItem[]>([])
  const [ageGroups, setAgeGroups] = useState<AgeGroupItem[]>([])
  const [comparison, setComparison] = useState<ComparisonItem[]>([])
  const [trend, setTrend] = useState<TrendItem[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [trendPeriod, setTrendPeriod] = useState(30)
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [popularityLoaded, setPopularityLoaded] = useState(false)
  const [ratingsLoaded, setRatingsLoaded] = useState(false)
  const [comparisonLoaded, setComparisonLoaded] = useState(false)
  const [trendLoaded, setTrendLoaded] = useState(false)
  const [ageGroupsLoaded, setAgeGroupsLoaded] = useState(false)

  const allRequestId = useRef(0)
  const trendRequestId = useRef(0)
  const ageRequestId = useRef(0)
  const allController = useRef<AbortController | null>(null)
  const trendController = useRef<AbortController | null>(null)
  const ageController = useRef<AbortController | null>(null)

  const fetchWithAuth = useCallback(async <T,>(url: string, signal?: AbortSignal): Promise<T> => {
    const response = await fetch(url, { headers: adminHeaders(), signal })
    const payload = await readApiPayload(response)
    if (!response.ok || !payload || payload.success !== true) throw new Error(apiErrorMessage(payload, 'Failed to load analytics data'))
    return (payload.data ?? payload) as T
  }, [])

  const fetchAllData = useCallback(async () => {
    const id = ++allRequestId.current
    allController.current?.abort()
    const controller = new AbortController()
    allController.current = controller
    setLoading(true)
    setErrors((previous) => ({ ...previous, general: '', popularity: '', ratings: '', comparison: '', products: '' }))

    const results = await Promise.allSettled([
      fetchWithAuth<PopularityItem[]>(`${API_BASE}/admin/analytics/popularity`, controller.signal),
      fetchWithAuth<RatingItem[]>(`${API_BASE}/admin/analytics/ratings`, controller.signal),
      fetchWithAuth<ComparisonItem[]>(`${API_BASE}/admin/analytics/comparison`, controller.signal),
      fetchWithAuth<ProductItem[] | { products?: ProductItem[] }>(`${API_BASE}/admin/products`, controller.signal),
    ])
    if (id !== allRequestId.current) return

    const nextErrors: Record<string, string> = {}
    const [popResult, ratingResult, comparisonResult, productResult] = results
    if (popResult.status === 'fulfilled') {
      setPopularity(popResult.value)
      setPopularityLoaded(true)
    } else if (!isAbortError(popResult.reason)) nextErrors.popularity = popResult.reason instanceof Error ? popResult.reason.message : 'Failed to load popularity data'
    if (ratingResult.status === 'fulfilled') {
      setRatings(ratingResult.value)
      setRatingsLoaded(true)
    } else if (!isAbortError(ratingResult.reason)) nextErrors.ratings = ratingResult.reason instanceof Error ? ratingResult.reason.message : 'Failed to load ratings data'
    if (comparisonResult.status === 'fulfilled') {
      setComparison(comparisonResult.value)
      setComparisonLoaded(true)
    } else if (!isAbortError(comparisonResult.reason)) nextErrors.comparison = comparisonResult.reason instanceof Error ? comparisonResult.reason.message : 'Failed to load comparison data'
    if (productResult.status === 'fulfilled') {
      const raw = Array.isArray(productResult.value) ? productResult.value : productResult.value.products || []
      setProducts(raw)
      setSelectedProductId((current) => raw.some((product) => product.id === current) ? current : '')
    } else if (!isAbortError(productResult.reason)) nextErrors.products = productResult.reason instanceof Error ? productResult.reason.message : 'Failed to load products for analytics'
    setErrors((previous) => ({ ...previous, ...nextErrors }))
    setLoading(false)
  }, [fetchWithAuth])

  const fetchAgeGroups = useCallback(async (productId: string) => {
    const id = ++ageRequestId.current
    ageController.current?.abort()
    if (!productId) {
      setAgeGroups([])
      setAgeGroupsLoaded(false)
      setErrors((previous) => ({ ...previous, ageGroups: '' }))
      return
    }
    const controller = new AbortController()
    ageController.current = controller
    setAgeGroupsLoaded(false)
    setErrors((previous) => ({ ...previous, ageGroups: '' }))
    try {
      const data = await fetchWithAuth<AgeGroupItem[]>(`${API_BASE}/admin/analytics/age-groups?productId=${encodeURIComponent(productId)}`, controller.signal)
      if (id === ageRequestId.current) {
        setAgeGroups(data)
        setAgeGroupsLoaded(true)
      }
    } catch (error) {
      if (!isAbortError(error) && id === ageRequestId.current) setErrors((previous) => ({ ...previous, ageGroups: error instanceof Error ? error.message : 'Failed to load age group data' }))
    }
  }, [fetchWithAuth])

  const fetchTrend = useCallback(async (period: number) => {
    const id = ++trendRequestId.current
    trendController.current?.abort()
    const controller = new AbortController()
    trendController.current = controller
    setTrendLoaded(false)
    setErrors((previous) => ({ ...previous, trend: '' }))
    try {
      const data = await fetchWithAuth<TrendItem[]>(`${API_BASE}/admin/analytics/trend?period=${period}`, controller.signal)
      if (id === trendRequestId.current) {
        setTrend(data)
        setTrendLoaded(true)
      }
    } catch (error) {
      if (!isAbortError(error) && id === trendRequestId.current) setErrors((previous) => ({ ...previous, trend: error instanceof Error ? error.message : 'Failed to load trend data' }))
    }
  }, [fetchWithAuth])

  useEffect(() => {
    // Initial aggregate load is intentionally run once; each request has its own abort controller.
    void fetchAllData()
    return () => allController.current?.abort()
  }, [fetchAllData])

  useEffect(() => {
    // Product and period changes cancel their previous requests before updating state.
    void fetchAgeGroups(selectedProductId)
    return () => ageController.current?.abort()
  }, [selectedProductId, fetchAgeGroups])

  useEffect(() => {
    void fetchTrend(trendPeriod)
    return () => trendController.current?.abort()
  }, [trendPeriod, fetchTrend])

  const selectedProductName = products.find((product) => product.id === selectedProductId)?.name || ''
  const totalResponses = popularity.reduce((sum, item) => sum + (item.response_count || 0), 0)
  const avgOverallRating = ratings.length > 0 ? (ratings.reduce((sum, item) => sum + (item.avg_rating || 0), 0) / ratings.length).toFixed(2) : ratingsLoaded ? '0.00' : '—'
  const topProduct = popularity.length > 0 ? popularity.reduce((a, b) => (a.response_count > b.response_count ? a : b)) : null

  if (loading) return <div className="space-y-6"><div><h1 className="font-display text-2xl font-bold text-ink">Analytics</h1><p className="mt-1 text-sm text-slate-500">Loading analytics data...</p></div><LoadingSkeleton /></div>

  return <div className="space-y-6">
    <div className="flex items-center justify-between"><div><h1 className="font-display text-2xl font-bold text-ink">Analytics</h1><p className="mt-1 text-sm text-slate-500">Survey performance and product insights</p></div><button type="button" onClick={() => { void fetchAllData(); void fetchTrend(trendPeriod) }} className="btn-outline"><svg className="h-4 w-4 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Refresh</button></div>

    {errors.general && <InlineError message={errors.general} />}
    {errors.products && <InlineError message={errors.products} />}

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatCard label="Total Responses" value={popularityLoaded ? totalResponses.toLocaleString() : '—'} sublabel="Across all products" icon="M8 10h.01M12 10h.01M16 10h.01M9 16H5a1 1 0 01-1-1V5a2 2 0 012-2h12a2 2 0 014 0v10a1 1 0 01-1 1h-4l-4 4v-4z" /><StatCard label="Active Products" value={popularityLoaded ? popularity.length : '—'} sublabel="In the system" icon="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /><StatCard label="Avg Rating" value={avgOverallRating} sublabel="Overall satisfaction" icon="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 10.101c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /><StatCard label="Top Product" value={topProduct?.name || (popularityLoaded ? 'N/A' : '—')} sublabel={topProduct ? `${topProduct.response_count} responses` : popularityLoaded ? 'No data yet' : 'Unavailable'} icon="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></div>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><div className="card p-6"><SectionHeader title="Product Popularity" subtitle="Responses by product" />{errors.popularity && !popularityLoaded ? <ErrorState message={errors.popularity} /> : <>{errors.popularity && <InlineError message={errors.popularity} />}<HorizontalBarChart data={popularity.map((item) => ({ name: item.name, value: item.response_count || 0 }))} labelKey="name" valueKey="value" /></>}</div><div className="card p-6"><SectionHeader title="Average Ratings" subtitle="Satisfaction score by product" />{errors.ratings && !ratingsLoaded ? <ErrorState message={errors.ratings} /> : <>{errors.ratings && <InlineError message={errors.ratings} />}<div className="space-y-4">{ratings.map((rating, index) => <div key={`${rating.name}-${index}`} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0"><span className="text-sm font-medium text-slate-700">{rating.name}</span><RatingStars rating={rating.avg_rating || 0} /></div>)}{ratings.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No ratings data</p>}</div></>}</div></div>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><div className="card p-6"><SectionHeader title="Rating by Age Group" subtitle="Breakdown of ratings across demographics" /><div className="mb-4"><label htmlFor="analytics-product" className="mb-1 block text-sm font-medium text-slate-700">Select Product</label><select id="analytics-product" value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} className="input"><option value="">Choose a product...</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></div>{selectedProductId ? (errors.ageGroups && !ageGroupsLoaded ? <ErrorState message={errors.ageGroups} /> : <>{errors.ageGroups && <InlineError message={errors.ageGroups} />}<AgeGroupChart data={ageGroups} productName={selectedProductName} /></>) : <div className="py-8 text-center"><p className="text-sm text-slate-400">Select a product to view age group breakdown</p></div>}</div><div className="card p-6"><SectionHeader title="Participation Trend" subtitle="Daily survey responses" /><div className="mb-4 flex items-center gap-2">{[7, 14, 30, 60].map((period) => <button key={period} type="button" onClick={() => setTrendPeriod(period)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${trendPeriod === period ? 'bg-gold text-forest' : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'}`}>{period}d</button>)}</div>{errors.trend && !trendLoaded ? <ErrorState message={errors.trend} /> : <>{errors.trend && <InlineError message={errors.trend} />}<ParticipationTrend data={trend} /></>}</div></div>

    <div className="card p-6"><SectionHeader title="Product Comparison" subtitle="Side-by-side comparison of all products" />{errors.comparison && !comparisonLoaded ? <ErrorState message={errors.comparison} /> : <>{errors.comparison && <InlineError message={errors.comparison} />}<ComparisonTable data={comparison} /></>}</div>
  </div>
}
