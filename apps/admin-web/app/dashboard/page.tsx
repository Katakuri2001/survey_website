'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

import { API_BASE } from '../lib/api'

interface AdminDashboard {
  totalParticipants: number
  completedSurveys: number
  completionRate: number
  totalRewardsAwarded: number
  pendingDeliveries: number
  deliveredRewards: number
  activeProducts: number
}

interface PopularityItem { name: string; percentage: number; response_count: number }

interface InventoryReward {
  id: string
  name: string
  status: string
  total_quantity: number
  remaining_quantity: number
  delivered_count: number
}

interface InventoryData {
  rewards: InventoryReward[]
  summary: {
    total_stock: number
    total_rewarded: number
    total_remaining: number
    total_delivered: number
  }
}

function StatCard({ label, value, icon, iconClass, trend }: { label: string; value: string | number; icon: string; iconClass: string; trend?: string }) {
  return (
    <div className="card animate-fade-up p-5 transition-shadow hover:shadow-card">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 ${iconClass}`}>
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
        <svg className="h-4 w-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      </div>
      <p className="mt-4 text-[13px] font-medium text-slate-500">{label}</p>
      <p className="font-display mt-0.5 text-2xl font-bold text-ink">{value}</p>
      {trend && <p className="mt-1 text-xs text-slate-400">{trend}</p>}
    </div>
  )
}

const BAR_GRADIENTS = [
  'from-gold-400 to-gold-600',
  'from-emerald-400 to-emerald-600',
]

function BarChart({ data, title }: { data: { name: string; value: number; color?: string }[]; title: string }) {
  const maxValue = Math.max(...data.map(d => d.value), 1)

  return (
    <div className="card p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-gold" /> Popularity
          </span>
        </div>
      </div>
      <div className="space-y-4">
        {data.map((item, i) => (
          <div key={i}>
            <div className="mb-1 flex items-center justify-between">
              <span className="truncate text-sm text-slate-600">{item.name}</span>
              <span className="font-display text-sm font-semibold text-ink">{item.value}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${BAR_GRADIENTS[i % BAR_GRADIENTS.length]} transition-all duration-700`}
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {data.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No popularity data</p>}
      </div>
    </div>
  )
}

function SimpleBarChart({ data, title }: { data: { name: string; value: number }[]; title: string }) {
  const maxValue = Math.max(...data.map(d => d.value), 1)

  return (
    <div className="card p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Responses
          </span>
        </div>
      </div>
      <div className="flex h-40 items-end gap-3">
        {data.map((item, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="font-display text-xs font-semibold text-slate-600">{item.value.toLocaleString()}</span>
            <div className="flex w-full items-end justify-center rounded-t-lg bg-emerald-50" style={{ height: `${(item.value / maxValue) * 100}%`, minHeight: '6px' }}>
              <div className="h-full w-full rounded-t-lg bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-700" />
            </div>
            <span className="text-center text-[11px] leading-tight text-slate-500">{item.name}</span>
          </div>
        ))}
        {data.length === 0 && <p className="py-4 text-center text-sm text-slate-400">No response data</p>}
      </div>
    </div>
  )
}

function RewardInventory({ rewards }: { rewards: InventoryReward[] }) {
  return (
    <div className="card p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-ink">Reward Inventory</h3>
        <span className="rounded-full bg-forest px-2.5 py-1 text-[11px] font-semibold text-white">
          {rewards.length} rewards
        </span>
      </div>
      <div className="space-y-4">
        {rewards.map((r: InventoryReward) => {
          const utilized = r.total_quantity - r.remaining_quantity
          const percent = r.total_quantity > 0 ? (utilized / r.total_quantity) * 100 : 0
          const statusPill =
            r.status === 'EXHAUSTED' ? 'bg-rose-50 text-rose-600 ring-rose-200' :
            r.status === 'LOW_STOCK' ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'

          return (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-surface-alt p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="font-medium text-ink">{r.name}</span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${statusPill}`}>{r.status}</span>
              </div>
              <div className="mb-3 grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <p className="text-slate-500">Total</p>
                  <p className="font-display font-semibold text-ink">{r.total_quantity}</p>
                </div>
                <div>
                  <p className="text-slate-500">Awarded</p>
                  <p className="font-display font-semibold text-gold-600">{utilized}</p>
                </div>
                <div>
                  <p className="text-slate-500">Remaining</p>
                  <p className="font-display font-semibold text-emerald-600">{r.remaining_quantity}</p>
                </div>
                <div>
                  <p className="text-slate-500">Delivered</p>
                  <p className="font-display font-semibold text-forest-500">{r.delivered_count}</p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-600 transition-all duration-700"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )
        })}
        {rewards.length === 0 && (
          <p className="py-4 text-center text-slate-400">No rewards configured</p>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null)
  const [popularity, setPopularity] = useState<PopularityItem[]>([])
  const [inventory, setInventory] = useState<InventoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('')

  async function fetchDashboard(token: string) {
    try {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` }

      const safeFetch = async (url: string) => {
        const res = await fetch(url, { headers })
        if (res.status === 401 || res.status === 403) {
          setAuthError(true)
          return null
        }
        if (!res.ok) return null
        try { return await res.json() } catch { return null }
      }

      const [dash, pop, inv] = await Promise.all([
        safeFetch(`${API_BASE}/admin/dashboard`),
        safeFetch(`${API_BASE}/admin/analytics/popularity`),
        safeFetch(`${API_BASE}/admin/rewards/inventory`),
      ])

      if (dash?.success) setDashboard(dash.data)
      if (pop?.success) setPopularity(pop.data)
      if (inv?.success) setInventory(inv.data)
      setLastUpdated(new Date().toLocaleString())
    } catch (err) {
      console.error('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const run = async () => {
      await Promise.resolve()
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
      if (!token) {
        setAuthError(true)
        setLoading(false)
        return
      }
      fetchDashboard(token)
    }
    run()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="card animate-pulse p-5">
              <div className="h-10 w-10 rounded-xl bg-slate-200" />
              <div className="mt-4 h-3 bg-slate-200 rounded w-24" />
              <div className="mt-2 h-7 bg-slate-200 rounded w-16" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card animate-pulse h-56" />
          <div className="card animate-pulse h-56" />
        </div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card animate-fade-up max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/10">
            <svg className="h-8 w-8 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="font-display text-xl font-bold text-ink mb-2">Admin Login Required</h2>
          <p className="text-slate-500 mb-6">Sign in with your admin account to access the dashboard.</p>
          <Link href="/login" className="btn-gold">
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  const totalResponses = popularity.reduce((sum, p) => sum + (p.response_count || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Overview</h1>
          <p className="mt-1 text-sm text-slate-500">Overview of your survey platform</p>
        </div>
        {lastUpdated && (
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-forest px-3.5 py-1.5 text-xs font-medium text-white shadow-forest">
            <span className="h-1.5 w-1.5 rounded-full bg-warm" />
            Last updated {lastUpdated}
          </span>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Participants"
          value={dashboard?.totalParticipants?.toLocaleString() || '0'}
          icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          iconClass="text-gold-600"
          trend="Across all campaigns"
        />
        <StatCard
          label="Completed Surveys"
          value={dashboard?.completedSurveys?.toLocaleString() || '0'}
          icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          iconClass="text-emerald-600"
          trend="Valid submissions"
        />
        <StatCard
          label="Completion Rate"
          value={`${dashboard?.completionRate || 0}%`}
          icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          iconClass="text-gold-600"
          trend="Started vs finished"
        />
        <StatCard
          label="Rewards Awarded"
          value={dashboard?.totalRewardsAwarded?.toLocaleString() || '0'}
          icon="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
          iconClass="text-gold-600"
          trend="Gifts won"
        />
        <StatCard
          label="Pending Deliveries"
          value={dashboard?.pendingDeliveries?.toLocaleString() || '0'}
          icon="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
          iconClass="text-rose-500"
          trend="Awaiting fulfillment"
        />
        <StatCard
          label="Deliveries Delivered"
          value={dashboard?.deliveredRewards?.toLocaleString() || '0'}
          icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          iconClass="text-emerald-600"
          trend="Successfully shipped"
        />
        <StatCard
          label="Active Products"
          value={dashboard?.activeProducts?.toLocaleString() || '0'}
          icon="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          iconClass="text-gold-600"
          trend="In the survey"
        />
        <StatCard
          label="Survey Responses"
          value={totalResponses.toLocaleString()}
          icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          iconClass="text-emerald-600"
          trend="Across all products"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BarChart
          title="Product Popularity"
          data={popularity.map((p) => ({
            name: p.name,
            value: p.percentage || 0,
          }))}
        />

        <SimpleBarChart
          title="Survey Responses by Product"
          data={popularity.map((p) => ({
            name: p.name,
            value: p.response_count || 0,
          }))}
        />
      </div>

      {/* Reward Inventory */}
      <RewardInventory rewards={inventory?.rewards || []} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-6">
          <h3 className="font-display mb-4 text-sm font-semibold text-ink">Inventory Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total Stock</span>
              <span className="font-display font-semibold text-ink">{inventory?.summary?.total_stock || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total Rewarded</span>
              <span className="font-display font-semibold text-gold-600">{inventory?.summary?.total_rewarded || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total Remaining</span>
              <span className="font-display font-semibold text-emerald-600">{inventory?.summary?.total_remaining || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total Delivered</span>
              <span className="font-display font-semibold text-forest-500">{inventory?.summary?.total_delivered || 0}</span>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-display mb-4 text-sm font-semibold text-ink">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-2">
            <Link href="/products" className="inline-flex items-center gap-2 rounded-xl bg-gold px-3 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-warm">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Manage Products
            </Link>
            <Link href="/surveys" className="inline-flex items-center gap-2 rounded-xl bg-forest px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forest-600">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Manage Surveys
            </Link>
            <Link href="/rewards" className="inline-flex items-center gap-2 rounded-xl bg-gold px-3 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-warm">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
              Manage Rewards
            </Link>
            <Link href="/deliveries" className="inline-flex items-center gap-2 rounded-xl bg-forest px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forest-600">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              View Deliveries
            </Link>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-display mb-4 text-sm font-semibold text-ink">Platform Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Active Products</span>
              <span className="font-display font-semibold text-ink">{dashboard?.activeProducts || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Delivered Rewards</span>
              <span className="font-display font-semibold text-emerald-600">{dashboard?.deliveredRewards || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Completion Rate</span>
              <span className="font-display font-semibold text-gold-600">{dashboard?.completionRate || 0}%</span>
            </div>
            <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 ring-1 ring-emerald-200">
              <span className="font-semibold">All systems operational</span> — data is live from the survey platform.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}