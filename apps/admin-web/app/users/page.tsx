'use client'

import { useState, useEffect, useCallback } from 'react'

import { API_BASE } from '../lib/api'
import { exportToExcel, type ExcelColumn } from '../lib/excel'

interface UserList {
  id: string
  full_name: string
  email: string
  phone: string
  age: number
  age_group: string
  gender: string
  city: string
  township: string
  occupation: string
  created_at: string
  is_active: boolean
  survey_count: number
  reward_count: number
}

interface UserDetail {
  id: string
  full_name: string
  email: string
  phone: string
  age: number
  age_group: string
  gender: string
  city: string
  township: string
  nrc_state: string
  nrc_type: string
  nrc_number: string
  occupation: string
  created_at: string
  is_active: boolean
}

interface SurveyHistory {
  id: string
  status: string
  created_at: string
  product_name: string
  version_title: string
  avg_rating: number
}

interface RewardHistory {
  id: string
  delivery_status: string
  won_at: string
  delivered_at: string
  reward_name: string
}

const ITEMS_PER_PAGE = 50

interface SurveyExportRow {
  id: string
  full_name: string
  email: string
  phone: string
  reward_name: string
  won_at: string
  delivery_status: string
  delivered_at: string | null
  language: string
  completed_at: string | null
  question_text: string | null
  answer_text: string | null
  answer_choice: string | null
  answer_number: number | null
  answer_rating: number | null
}

const surveyExportColumns: ExcelColumn<SurveyExportRow>[] = [
  { header: 'Reward ID', value: r => r.id },
  { header: 'Full Name', value: r => r.full_name },
  { header: 'Email', value: r => r.email },
  { header: 'Phone', value: r => r.phone },
  { header: 'Reward', value: r => r.reward_name },
  { header: 'Won At', value: r => r.won_at },
  { header: 'Delivery Status', value: r => r.delivery_status },
  { header: 'Delivered At', value: r => r.delivered_at },
  { header: 'Language', value: r => r.language },
  { header: 'Completed At', value: r => r.completed_at },
  { header: 'Question', value: r => r.question_text },
  { header: 'Answer Text', value: r => r.answer_text },
  { header: 'Answer Choice', value: r => r.answer_choice },
  { header: 'Answer Number', value: r => r.answer_number },
  { header: 'Answer Rating', value: r => r.answer_rating },
]

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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="card animate-fade-up p-12 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/10">
        <svg className="h-8 w-8 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </div>
      <h3 className="font-display mb-1 text-lg font-semibold text-ink">{message}</h3>
      <p className="text-sm text-slate-500">No users match your search criteria.</p>
    </div>
  )
}

function UserDetailPanel({
  userId,
  onClose,
}: {
  userId: string
  onClose: () => void
}) {
  const [user, setUser] = useState<UserDetail | null>(null)
  const [surveys, setSurveys] = useState<SurveyHistory[]>([])
  const [rewards, setRewards] = useState<RewardHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'surveys' | 'rewards'>('surveys')

  const fetchUser = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('admin_token')
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE}/admin/users/${userId}`, { headers })
      const data = await res.json()
      if (data.success) {
        setUser(data.data.user)
        setSurveys(data.data.surveys || [])
        setRewards(data.data.rewards || [])
      } else {
        setError(data.message || 'Failed to load user details')
      }
    } catch {
      setError('Could not connect to the server')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUser()
  }, [fetchUser])

  function statusColor(status: string) {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      case 'in_progress':
        return 'bg-amber-50 text-amber-700 ring-amber-200'
      case 'abandoned':
        return 'bg-rose-50 text-rose-700 ring-rose-200'
      default:
        return 'bg-slate-100 text-slate-600 ring-slate-200'
    }
  }

  function deliveryColor(status: string) {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      case 'pending':
        return 'bg-amber-50 text-amber-700 ring-amber-200'
      case 'returned':
        return 'bg-rose-50 text-rose-700 ring-rose-200'
      default:
        return 'bg-slate-100 text-slate-600 ring-slate-200'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl max-h-[90vh]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">User Details</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="p-12">
            <LoadingSkeleton />
          </div>
        )}

        {error && !loading && (
          <div className="p-6">
            <ErrorState message={error} onRetry={fetchUser} />
          </div>
        )}

        {!loading && !error && user && (
          <div className="space-y-6 p-6">
            {/* Profile Section */}
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gold/10 ring-2 ring-gold/60">
                <span className="font-display text-xl font-bold text-gold-600">
                  {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-display truncate text-xl font-bold text-ink">{user.full_name}</h3>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                      user.is_active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
                    }`}
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{user.email}</p>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <InfoItem label="Phone" value={user.phone || '—'} />
              <InfoItem label="Age" value={user.age ? `${user.age}` : '—'} />
              <InfoItem label="Age Group" value={user.age_group || '—'} />
              <InfoItem label="Gender" value={user.gender || '—'} />
              <InfoItem label="City" value={user.city || '—'} />
              <InfoItem label="Township" value={user.township || '—'} />
              <InfoItem label="Occupation" value={user.occupation || '—'} />
              <InfoItem
                label="NRC"
                value={
                  user.nrc_state || user.nrc_type || user.nrc_number
                    ? `${user.nrc_state || ''} ${user.nrc_type || ''} ${user.nrc_number || ''}`.trim()
                    : '—'
                }
              />
              <InfoItem
                label="Joined"
                value={user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
              />
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200">
              <nav className="flex gap-6">
                <button
                  onClick={() => setActiveTab('surveys')}
                  className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                    activeTab === 'surveys'
                      ? 'border-gold-500 text-gold-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Surveys
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{surveys.length}</span>
                </button>
                <button
                  onClick={() => setActiveTab('rewards')}
                  className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                    activeTab === 'rewards'
                      ? 'border-gold-500 text-gold-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Rewards
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs">{rewards.length}</span>
                </button>
              </nav>
            </div>

            {/* Survey History */}
            {activeTab === 'surveys' && (
              <div>
                {surveys.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">No survey history</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Product</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Version</th>
                          <th className="px-3 py-2 text-center font-medium text-slate-500">Status</th>
                          <th className="px-3 py-2 text-center font-medium text-slate-500">Rating</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {surveys.map(s => (
                          <tr key={s.id} className="border-b border-slate-100">
                            <td className="px-3 py-2.5 font-medium text-ink">{s.product_name || '—'}</td>
                            <td className="px-3 py-2.5 text-slate-600">{s.version_title || '—'}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusColor(s.status)}`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center text-slate-600">
                              {s.avg_rating != null ? `${s.avg_rating.toFixed(1)} ★` : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-500">
                              {new Date(s.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Reward History */}
            {activeTab === 'rewards' && (
              <div>
                {rewards.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">No reward history</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Reward</th>
                          <th className="px-3 py-2 text-center font-medium text-slate-500">Delivery</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Won At</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-500">Delivered At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rewards.map(r => (
                          <tr key={r.id} className="border-b border-slate-100">
                            <td className="px-3 py-2.5 font-medium text-ink">{r.reward_name || '—'}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${deliveryColor(r.delivery_status)}`}>
                                {r.delivery_status}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-500">
                              {r.won_at ? new Date(r.won_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-slate-500">
                              {r.delivered_at ? new Date(r.delivered_at).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
      <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="truncate text-sm font-medium text-ink">{value}</p>
    </div>
  )
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserList[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('admin_token')
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        offset: String(page * ITEMS_PER_PAGE),
      })
      if (debouncedSearch) {
        params.set('search', debouncedSearch)
      }
      const res = await fetch(`${API_BASE}/admin/users?${params}`, { headers })
      const data = await res.json()
      if (data.success) {
        setUsers(data.data.users || [])
        setTotal(data.data.total || 0)
      } else {
        setError(data.message || 'Failed to load users')
      }
    } catch {
      setError('Could not connect to the server')
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers()
  }, [fetchUsers])

  const exportSurveys = useCallback(async () => {
    setExporting(true)
    setError('')
    try {
      const token = localStorage.getItem('admin_token')
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE}/admin/surveys/export`, { headers })
      const data = await res.json()
      if (!data.success) {
        setError(data.message || 'Failed to export surveys')
        return
      }
      const rows: SurveyExportRow[] = data.data.data || []
      const stamp = new Date().toISOString().slice(0, 10)
      exportToExcel(`survey-details-${stamp}.xls`, 'Survey Details', surveyExportColumns, rows)
    } catch {
      setError('Could not connect to the server')
    } finally {
      setExporting(false)
    }
  }, [])

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Users</h1>
          <p className="mt-1 text-sm text-slate-500">Manage and view registered users</p>
        </div>
        <button
          onClick={exportSurveys}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {exporting ? 'Exporting...' : 'Export Excel'}
        </button>
      </div>

      {/* Search and Stats */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-80">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-slate-400 outline-none transition focus:border-gold focus:ring-2 focus:ring-gold-400/30"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-sm text-slate-500">
          {loading ? 'Loading...' : `${total.toLocaleString()} users found`}
        </p>
      </div>

      {/* Error */}
      {!loading && error && <ErrorState message={error} onRetry={fetchUsers} />}

      {/* Empty */}
      {!loading && !error && users.length === 0 && (
        <EmptyState message={debouncedSearch ? 'No users found' : 'No users yet'} />
      )}

      {/* Table */}
      {!loading && !error && users.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="w-8 px-4 py-3 text-left font-medium text-slate-500">#</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">City</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">Surveys</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">Rewards</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, index) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-gold/5"
                  >
                    <td className="px-4 py-3 font-medium text-slate-400">
                      {page * ITEMS_PER_PAGE + index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/40">
                          <span className="text-xs font-semibold text-gold-600">
                            {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <span className="truncate font-medium text-ink">{u.full_name}</span>
                      </div>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-600">{u.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{u.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{u.city || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-semibold text-gold-600 ring-1 ring-inset ring-gold-200">
                        {u.survey_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        {u.reward_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                          u.is_active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
                        }`}
                      >
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
              <p className="text-sm text-slate-500">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Panel */}
      {selectedUserId && (
        <UserDetailPanel
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  )
}