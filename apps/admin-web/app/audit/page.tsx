'use client'

import { useCallback, useEffect, useState } from 'react'

import { API_BASE, adminHeaders } from '../lib/api'

interface AuditLog {
  id: string
  action: string
  resource_type: string | null
  resource_id: string | null
  metadata: unknown
  created_at: string
  admin_name: string | null
  admin_email: string | null
  actor_type: string | null
  actor_name_snapshot: string | null
  actor_role_snapshot: string | null
  category: string | null
  resource_name_snapshot: string | null
  description: string | null
  previous_values: unknown
  new_values: unknown
  result_status: string | null
  failure_reason: string | null
  request_id: string | null
}

const PAGE_SIZE = 25

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Signed in',
  LOGOUT: 'Signed out',
  CREATE: 'Created a new item',
  UPDATE: 'Updated information',
  DELETE: 'Deleted an item',
  ACTIVATE: 'Activated an item',
  DEACTIVATE: 'Deactivated an item',
  STOCK_ADJUSTED: 'Adjusted reward stock',
  REWARD_ASSIGNMENT: 'Reward assigned',
  REWARD_DELIVERED: 'Reward delivered',
  SHOP_CREATED: 'Created a shop',
  SHOP_UPDATED: 'Updated shop information',
  REWARD_CREATED: 'Created a reward',
  REWARD_UPDATED: 'Updated reward information',
  USER_UPDATED: 'Updated user information',
  SURVEY_UPDATED: 'Updated survey information',
  CONFIG_UPDATED: 'Updated configuration',
  UPLOAD: 'Uploaded a file',
  PASSWORD_CHANGED: 'Changed password',
  DELIVERY_STATUS_CHANGED: 'Updated delivery status',
  STATUS_CHANGED: 'Changed status',
  WINNING_CONFIG_UPDATED: 'Updated winning configuration',
  RESET_RESUME_TOKEN: 'Reset resume token',
}

const RESOURCE_LABELS: Record<string, string> = {
  auth: 'Admin Account',
  shop: 'Shop',
  reward: 'Reward',
  user: 'User',
  survey: 'Survey',
  campaign: 'Campaign',
  delivery: 'Reward Delivery',
  settings: 'Platform Settings',
  question: 'Survey Question',
  product: 'Product',
  shop_reward: 'Shop Reward',
  user_reward: 'User Reward',
}

const CATEGORY_LABELS: Record<string, string> = {
  account: 'Account',
  shops: 'Shop Management',
  rewards: 'Reward Management',
  inventory: 'Stock Changes',
  surveys: 'Survey Management',
  users: 'User Management',
  deliveries: 'Delivery Management',
  settings: 'Settings',
  campaigns: 'Campaigns',
  other: 'Other',
}

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || 'Other administrative activity'
}

function getResourceLabel(type: string | null): string {
  if (!type) return 'Unknown'
  return RESOURCE_LABELS[type] || type
}

function getCategoryLabel(cat: string | null): string {
  if (!cat) return 'Other'
  return CATEGORY_LABELS[cat] || cat
}

function formatDate(value: string): string {
  if (!value) return '—'
  const iso = value.includes('T') ? value : value.replace(' ', 'T') + 'Z'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [category, setCategory] = useState('')
  const [resultStatus, setResultStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const [summary, setSummary] = useState({ total: 0, today: 0, changes: 0, account: 0 })

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
      if (search) params.set('search', search)
      if (category) params.set('category', category)
      if (resultStatus) params.set('resultStatus', resultStatus)
      const res = await fetch(`${API_BASE}/admin/audit-logs?${params}`, { headers: adminHeaders() })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || `Request failed (${res.status})`)
      }
      setLogs(data.data.logs || [])
      setTotal(data.data.total || 0)

      const today = new Date().toISOString().slice(0, 10)
      const todayCount = (data.data.logs || []).filter((l: AuditLog) => l.created_at?.startsWith(today)).length
      const changesCount = (data.data.logs || []).filter((l: AuditLog) => ['shops', 'rewards', 'inventory', 'surveys', 'users', 'settings', 'campaigns'].includes(l.category || '')).length
      const accountCount = (data.data.logs || []).filter((l: AuditLog) => l.category === 'account').length
      setSummary({ total: data.data.total || 0, today: todayCount, changes: changesCount, account: accountCount })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [offset, search, category, resultStatus])

  useEffect(() => {
    // Initial audit log load; the request callback owns the state updates.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs()
  }, [fetchLogs])

  const applySearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput.trim())
    setOffset(0)
  }

  const clearFilters = () => {
    setSearchInput('')
    setSearch('')
    setCategory('')
    setResultStatus('')
    setOffset(0)
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canPrev = offset > 0
  const canNext = offset + PAGE_SIZE < total
  const hasFilters = search || category || resultStatus

  const selected = selectedLog

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Activity & Audit History</h1>
          <p className="mt-1 text-sm text-slate-500">Track administrative activities and changes made across your campaign.</p>
        </div>
        <button onClick={fetchLogs} className="btn-outline" disabled={loading}>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <p className="text-[13px] font-medium text-slate-500">Total Activities</p>
          <p className="font-display mt-1 text-2xl font-bold text-ink">{summary.total.toLocaleString()}</p>
        </div>
        <div className="card p-5">
          <p className="text-[13px] font-medium text-slate-500">Today&apos;s Activities</p>
          <p className="font-display mt-1 text-2xl font-bold text-ink">{summary.today}</p>
        </div>
        <div className="card p-5">
          <p className="text-[13px] font-medium text-slate-500">Administrative Changes</p>
          <p className="font-display mt-1 text-2xl font-bold text-ink">{summary.changes}</p>
        </div>
        <div className="card p-5">
          <p className="text-[13px] font-medium text-slate-500">Account Activities</p>
          <p className="font-display mt-1 text-2xl font-bold text-ink">{summary.account}</p>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <form onSubmit={applySearch} className="flex gap-3">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by administrator, activity, shop, reward, or item..."
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold-400/30"
          />
          <button type="submit" className="btn-gold">Search</button>
        </form>
        <div className="flex flex-wrap gap-3">
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setOffset(0) }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="">All Categories</option>
            <option value="account">Account</option>
            <option value="shops">Shop Management</option>
            <option value="rewards">Reward Management</option>
            <option value="inventory">Stock Changes</option>
            <option value="surveys">Survey Management</option>
            <option value="users">User Management</option>
            <option value="settings">Settings</option>
          </select>
          <select
            value={resultStatus}
            onChange={(e) => { setResultStatus(e.target.value); setOffset(0) }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="">All Results</option>
            <option value="SUCCESS">Successful</option>
            <option value="FAILED">Failed</option>
          </select>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="btn-outline text-sm">
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className="px-4 py-3 text-left font-medium text-slate-500">Date & Time</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Administrator</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Activity</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Affected Item</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Result</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Loading activities…
                  </td>
                </tr>
              )}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    No activities found.
                    <p className="mt-1 text-xs text-slate-300">Try changing your filters or selecting a different date range.</p>
                  </td>
                </tr>
              )}
              {!loading &&
                logs.map((log) => {
                  const actorName = log.actor_name_snapshot || log.admin_name || 'System'
                  const activityLabel = (log.description as string) || getActionLabel(log.action)
                  const affectedItem = log.resource_name_snapshot || getResourceLabel(log.resource_type)
                  const resultTone = log.result_status === 'FAILED'
                    ? 'bg-red-50 text-red-700 ring-red-200'
                    : log.result_status === 'PENDING'
                    ? 'bg-amber-50 text-amber-700 ring-amber-200'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  const resultLabel = log.result_status === 'FAILED' ? 'Failed' : log.result_status === 'PENDING' ? 'Pending' : 'Successful'

                  return (
                    <tr key={log.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(log.created_at)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{actorName}</p>
                        {log.actor_role_snapshot && <p className="text-xs text-slate-400">{log.actor_role_snapshot}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-ink">{activityLabel}</p>
                        {log.category && (
                          <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                            {getCategoryLabel(log.category)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-ink">{affectedItem}</p>
                        {log.resource_type && (
                          <p className="text-xs text-slate-400">{getResourceLabel(log.resource_type)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${resultTone}`}>
                          {resultLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-sm font-semibold text-gold-600 hover:text-gold-700"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
          <p className="text-xs text-slate-500">
            {total === 0
              ? 'No entries'
              : `Showing ${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
              disabled={!canPrev || loading}
              className="btn-outline disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              Page {page} / {pageCount}
            </span>
            <button
              onClick={() => setOffset((value) => value + PAGE_SIZE)}
              disabled={!canNext || loading}
              className="btn-outline disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="font-display text-lg font-semibold text-ink">
                {(selected.description as string) || getActionLabel(selected.action)}
              </h2>
            </div>
            <div className="space-y-4 px-6 py-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-500 mb-2">Activity Overview</h3>
                <p className="text-sm text-ink">
                  {(selected.description as string) || getActionLabel(selected.action)}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-500 mb-2">Administrator</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium text-ink">Name:</span> {selected.actor_name_snapshot || selected.admin_name || 'System'}</p>
                  {selected.actor_role_snapshot && <p><span className="font-medium text-ink">Role:</span> {selected.actor_role_snapshot}</p>}
                  {selected.admin_email && <p><span className="font-medium text-ink">Email:</span> {selected.admin_email}</p>}
                  <p><span className="font-medium text-ink">Time:</span> {formatDate(selected.created_at)}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-500 mb-2">Affected Item</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium text-ink">Type:</span> {getResourceLabel(selected.resource_type)}</p>
                  <p><span className="font-medium text-ink">Name:</span> {selected.resource_name_snapshot || '—'}</p>
                  {selected.resource_id && (
                    <p><span className="font-medium text-ink">ID:</span> {selected.resource_id}</p>
                  )}
                </div>
              </div>

              {(Boolean(selected.previous_values) || Boolean(selected.new_values)) && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 mb-2">What Changed</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold text-slate-500 mb-2">Previous</p>
                      {selected.previous_values ? (
                        Object.entries(
                          (typeof selected.previous_values === 'string'
                            ? JSON.parse(selected.previous_values)
                            : selected.previous_values) as Record<string, unknown>
                        ).map(([key, val]) => (
                          <p key={key} className="text-sm">
                            <span className="font-medium text-ink">{key}:</span> {formatValue(val)}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">—</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-gold/30 bg-gold/5 p-3">
                      <p className="text-xs font-semibold text-gold-600 mb-2">New</p>
                      {selected.new_values ? (
                        Object.entries(
                          (typeof selected.new_values === 'string'
                            ? JSON.parse(selected.new_values)
                            : selected.new_values) as Record<string, unknown>
                        ).map(([key, val]) => (
                          <p key={key} className="text-sm">
                            <span className="font-medium text-ink">{key}:</span> {formatValue(val)}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm text-slate-400">—</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {Boolean(selected.metadata) && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-500 mb-2">Additional Information</h3>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <pre className="text-xs text-slate-600 whitespace-pre-wrap">
                      {typeof selected.metadata === 'string'
                        ? selected.metadata
                        : JSON.stringify(selected.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {Boolean(selected.failure_reason) && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-700">
                    <span className="font-medium">Failure reason:</span> {selected.failure_reason}
                  </p>
                </div>
              )}

              <details className="rounded-lg border border-slate-200">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-500">
                  Technical Information
                </summary>
                <div className="space-y-1 px-3 py-2 text-xs text-slate-400">
                  <p><span className="font-medium">Action code:</span> {selected.action}</p>
                  <p><span className="font-medium">Resource type:</span> {selected.resource_type || '—'}</p>
                  <p><span className="font-medium">Resource ID:</span> {selected.resource_id || '—'}</p>
                  <p><span className="font-medium">Event ID:</span> {selected.id}</p>
                  {selected.request_id && <p><span className="font-medium">Request ID:</span> {selected.request_id}</p>}
                  {selected.actor_type && <p><span className="font-medium">Actor type:</span> {selected.actor_type}</p>}
                </div>
              </details>
            </div>
            <div className="flex justify-end border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}