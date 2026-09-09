'use client'

import { useState, useEffect, useCallback } from 'react'

const API_BASE = 'http://localhost:8787'

interface AuditLog {
  id: string
  admin_id: string
  action: string
  resource_type: string
  resource_id: string
  metadata: Record<string, unknown> | null
  created_at: string
  admin_name: string
}

const ITEMS_PER_PAGE = 50

const ACTION_STYLES: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-amber-50 text-amber-700 border-amber-200',
  DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
  LOGIN: 'bg-blue-50 text-blue-700 border-blue-200',
  LOGOUT: 'bg-gray-100 text-gray-700 border-gray-200',
  VIEW: 'bg-indigo-50 text-indigo-700 border-indigo-200',
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
        <div key={i} className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-28" />
          </div>
          <div className="h-6 w-24 bg-gray-200 rounded-full" />
          <div className="h-3 w-32 bg-gray-100 rounded" />
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

function EmptyState() {
  return (
    <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">No audit logs found</h3>
      <p className="text-sm text-gray-500">Audit logs will appear here as admin actions are performed.</p>
    </div>
  )
}

function actionBadge(action: string) {
  const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border'
  return `${base} ${ACTION_STYLES[action] || 'bg-gray-50 text-gray-600 border-gray-200'}`
}

function formatTimestamp(ts: string) {
  const d = new Date(ts)
  const date = d.toLocaleDateString()
  const time = d.toLocaleTimeString()
  return { date, time }
}

function MetadataPreview({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata || Object.keys(metadata).length === 0) return null
  return (
    <div className="mt-2 max-w-md">
      <details className="group">
        <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 select-none">
          View metadata
        </summary>
        <pre className="mt-1 text-xs bg-gray-50 border border-gray-200 rounded-md p-2 overflow-x-auto text-gray-700 whitespace-pre-wrap break-all">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      </details>
    </div>
  )
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [actionFilter, setActionFilter] = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        limit: String(ITEMS_PER_PAGE),
        offset: String(page * ITEMS_PER_PAGE),
      })
      if (actionFilter) {
        params.set('action', actionFilter)
      }
      const res = await fetch(`${API_BASE}/admin/audit-logs?${params}`)
      if (!res.ok) throw new Error('Failed to fetch audit logs')
      const data = await res.json()
      setLogs(data.logs || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  const uniqueActions = Array.from(new Set(logs.map(l => l.action))).sort()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-500 mt-1">Track admin actions and system changes</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setActionFilter(''); setPage(0) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !actionFilter
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {uniqueActions.map(action => (
            <button
              key={action}
              onClick={() => { setActionFilter(action); setPage(0) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                actionFilter === action
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {action}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-500">
          {loading ? 'Loading...' : `${total.toLocaleString()} logs found`}
        </p>
      </div>

      {!loading && error && <ErrorState message={error} onRetry={fetchLogs} />}

      {!loading && !error && logs.length === 0 && <EmptyState />}

      {loading && <LoadingSkeleton />}

      {!loading && !error && logs.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Admin</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Action</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Resource</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Resource ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const { date, time } = formatTimestamp(log.created_at)
                  return (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-indigo-600 font-medium text-xs">
                              {log.admin_name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <span className="font-medium text-gray-900 truncate">{log.admin_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={actionBadge(log.action)}>
                          {log.action}
                        </span>
                        <MetadataPreview metadata={log.metadata} />
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                          {log.resource_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-mono text-xs">
                        {log.resource_id || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        <div>{date}</div>
                        <div className="text-xs text-gray-400">{time}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

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
    </div>
  )
}
