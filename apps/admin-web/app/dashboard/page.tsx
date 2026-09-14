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

function StatCard({ label, value, icon, color, trend }: { label: string; value: string | number; icon: string; color: string; trend?: string }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          {trend && <p className="text-xs text-gray-400 mt-1">{trend}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color.replace('text-', 'bg-').replace('600', '50')}`}>
          <svg className={`w-6 h-6 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
      </div>
    </div>
  )
}

function BarChart({ data, title }: { data: { name: string; value: number; color?: string }[]; title: string }) {
  const maxValue = Math.max(...data.map(d => d.value), 1)
  const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500']

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {data.map((item, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">{item.name}</span>
              <span className="text-sm font-medium text-gray-900">{item.value}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${item.color || colors[i % colors.length]}`}
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SimpleBarChart({ data, title }: { data: { name: string; value: number }[]; title: string }) {
  const maxValue = Math.max(...data.map(d => d.value), 1)

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="flex items-end gap-3 h-40">
        {data.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs font-medium text-gray-600">{item.value}</span>
            <div className="w-full bg-indigo-100 rounded-t" style={{ height: `${(item.value / maxValue) * 100}%`, minHeight: '4px' }}>
              <div className="w-full h-full bg-indigo-500 rounded-t" />
            </div>
            <span className="text-xs text-gray-500 text-center leading-tight">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RewardInventory({ rewards }: { rewards: InventoryReward[] }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Reward Inventory</h3>
      <div className="space-y-4">
        {rewards.map((r: InventoryReward) => {
          const utilized = r.total_quantity - r.remaining_quantity
          const percent = r.total_quantity > 0 ? (utilized / r.total_quantity) * 100 : 0
          const statusColor = r.status === 'EXHAUSTED' ? 'text-red-600 bg-red-50' :
            r.status === 'LOW_STOCK' ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50'

          return (
            <div key={r.id} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{r.name}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor}`}>{r.status}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs mb-3">
                <div>
                  <p className="text-gray-500">Total</p>
                  <p className="font-semibold text-gray-900">{r.total_quantity}</p>
                </div>
                <div>
                  <p className="text-gray-500">Awarded</p>
                  <p className="font-semibold text-indigo-600">{utilized}</p>
                </div>
                <div>
                  <p className="text-gray-500">Remaining</p>
                  <p className="font-semibold text-emerald-600">{r.remaining_quantity}</p>
                </div>
                <div>
                  <p className="text-gray-500">Delivered</p>
                  <p className="font-semibold text-blue-600">{r.delivered_count}</p>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percent}%` }} />
              </div>
            </div>
          )
        })}
        {rewards.length === 0 && (
          <p className="text-center text-gray-400 py-4">No rewards configured</p>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Admin Login Required</h2>
          <p className="text-gray-500 mb-6">Sign in with your admin account to access the dashboard.</p>
          <Link href="/login" className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors">
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your survey platform</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Participants"
          value={dashboard?.totalParticipants?.toLocaleString() || '0'}
          icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          color="text-indigo-600"
        />
        <StatCard
          label="Completed Surveys"
          value={dashboard?.completedSurveys?.toLocaleString() || '0'}
          icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          color="text-emerald-600"
          trend={`${dashboard?.completionRate || 0}% completion rate`}
        />
        <StatCard
          label="Rewards Awarded"
          value={dashboard?.totalRewardsAwarded?.toLocaleString() || '0'}
          icon="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
          color="text-amber-600"
        />
        <StatCard
          label="Pending Deliveries"
          value={dashboard?.pendingDeliveries?.toLocaleString() || '0'}
          icon="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
          color="text-rose-600"
          trend={`${dashboard?.deliveredRewards || 0} delivered`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Inventory Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Stock</span>
              <span className="font-medium">{inventory?.summary?.total_stock || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Rewarded</span>
              <span className="font-medium text-indigo-600">{inventory?.summary?.total_rewarded || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Remaining</span>
              <span className="font-medium text-emerald-600">{inventory?.summary?.total_remaining || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Delivered</span>
              <span className="font-medium text-blue-600">{inventory?.summary?.total_delivered || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <Link href="/products" className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Manage Products</Link>
            <Link href="/surveys" className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Manage Surveys</Link>
            <Link href="/rewards" className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Manage Rewards</Link>
            <Link href="/deliveries" className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">View Deliveries</Link>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Platform Status</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Active Products</span>
              <span className="font-medium">{dashboard?.activeProducts || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Delivered Rewards</span>
              <span className="font-medium text-emerald-600">{dashboard?.deliveredRewards || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Completion Rate</span>
              <span className="font-medium text-indigo-600">{dashboard?.completionRate || 0}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}