'use client'

import { useState, useEffect, useCallback } from 'react'

const API_BASE = 'http://localhost:8787'

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

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-48 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-64" />
          </div>
          <div className="h-6 w-20 bg-gray-200 rounded-full" />
          <div className="h-8 w-20 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 text-center">
      <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-900 mb-1">Failed to load data</p>
      <p className="text-sm text-gray-500 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Retry
      </button>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
      <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{message}</h3>
      <p className="text-sm text-gray-500">No users match your search criteria.</p>
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
    fetchUser()
  }, [fetchUser])

  function statusColor(status: string) {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700'
      case 'in_progress':
        return 'bg-amber-50 text-amber-700'
      case 'abandoned':
        return 'bg-rose-50 text-rose-700'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  function deliveryColor(status: string) {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-50 text-emerald-700'
      case 'pending':
        return 'bg-amber-50 text-amber-700'
      case 'returned':
        return 'bg-rose-50 text-rose-700'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-900">User Details</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="p-6 space-y-6">
            {/* Profile Section */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                <span className="text-indigo-600 font-bold text-xl">
                  {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-gray-900 truncate">{user.full_name}</h3>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
            <div className="border-b border-gray-200">
              <nav className="flex gap-6">
                <button
                  onClick={() => setActiveTab('surveys')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'surveys'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Surveys
                  <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded-full text-xs">{surveys.length}</span>
                </button>
                <button
                  onClick={() => setActiveTab('rewards')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'rewards'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Rewards
                  <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded-full text-xs">{rewards.length}</span>
                </button>
              </nav>
            </div>

            {/* Survey History */}
            {activeTab === 'surveys' && (
              <div>
                {surveys.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">No survey history</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 px-3 font-medium text-gray-500">Product</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-500">Version</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-500">Status</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-500">Rating</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-500">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {surveys.map(s => (
                          <tr key={s.id} className="border-b border-gray-50">
                            <td className="py-2.5 px-3 font-medium text-gray-900">{s.product_name || '—'}</td>
                            <td className="py-2.5 px-3 text-gray-600">{s.version_title || '—'}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(s.status)}`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center text-gray-600">
                              {s.avg_rating != null ? `${s.avg_rating.toFixed(1)} ★` : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-gray-500 text-xs">
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
                  <p className="text-sm text-gray-500 text-center py-6">No reward history</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 px-3 font-medium text-gray-500">Reward</th>
                          <th className="text-center py-2 px-3 font-medium text-gray-500">Delivery</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-500">Won At</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-500">Delivered At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rewards.map(r => (
                          <tr key={r.id} className="border-b border-gray-50">
                            <td className="py-2.5 px-3 font-medium text-gray-900">{r.reward_name || '—'}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${deliveryColor(r.delivery_status)}`}>
                                {r.delivery_status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-gray-500 text-xs">
                              {r.won_at ? new Date(r.won_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-gray-500 text-xs">
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
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900 truncate">{value}</p>
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
    fetchUsers()
  }, [fetchUsers])

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-sm text-gray-500 mt-1">Manage and view registered users</p>
      </div>

      {/* Search and Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500">
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 w-8">#</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Phone</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">City</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">Surveys</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">Rewards</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Joined</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, index) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className="border-b border-gray-50 hover:bg-indigo-50/30 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 text-gray-400 font-medium">
                      {page * ITEMS_PER_PAGE + index + 1}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-indigo-600 font-medium text-xs">
                            {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900 truncate">{u.full_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 truncate max-w-[200px]">{u.email || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{u.phone || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{u.city || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                        {u.survey_count}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                        {u.reward_count}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
