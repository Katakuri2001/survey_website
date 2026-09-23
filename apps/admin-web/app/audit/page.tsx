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
}

const PAGE_SIZE = 50

function actionTone(action: string): string {
  switch (action) {
    case 'CREATE':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    case 'UPDATE':
      return 'bg-amber-50 text-amber-700 ring-amber-200'
    case 'DELETE':
      return 'bg-red-50 text-red-700 ring-red-200'
    case 'LOGIN':
      return 'bg-sky-50 text-sky-700 ring-sky-200'
    case 'UPLOAD':
      return 'bg-violet-50 text-violet-700 ring-violet-200'
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200'
  }
}

function formatDate(value: string): string {
  if (!value) return '—'
  const iso = value.includes('T') ? value : value.replace(' ', 'T') + 'Z'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function formatMetadata(metadata: unknown): string {
  if (metadata === null || metadata === undefined || metadata === '') return '—'
  try {
    const value = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
    const text = JSON.stringify(value)
    return text.length > 120 ? `${text.slice(0, 120)}…` : text
  } catch {
    const text = String(metadata)
    return text.length > 120 ? `${text.slice(0, 120)}…` : text
  }
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [actionInput, setActionInput] = useState('')
  const [action, setAction] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
      if (action) params.set('action', action)
      const res = await fetch(`${API_BASE}/admin/audit-logs?${params}`, { headers: adminHeaders() })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || `Request failed (${res.status})`)
      }
      setLogs(data.data.logs || [])
      setTotal(data.data.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [offset, action])

  useEffect(() => {
    // Justification: reloads logs whenever offset/action changes; loading/results are intentionally reset with the effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs()
  }, [fetchLogs])

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canPrev = offset > 0
  const canNext = offset + PAGE_SIZE < total

  const applyFilter = (e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    setAction(actionInput.trim())
  }

  const clearFilter = () => {
    setActionInput('')
    setAction('')
    setOffset(0)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Audit Log</h1>
          <p className="mt-1 text-sm text-slate-500">Every admin action recorded on the platform</p>
        </div>
        <button onClick={fetchLogs} className="btn-outline" disabled={loading}>
          Refresh
        </button>
      </div>

      <form onSubmit={applyFilter} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[180px] flex-1">
          <label htmlFor="audit-action" className="mb-1.5 block text-xs font-medium text-slate-500">
            Action
          </label>
          <input
            id="audit-action"
            type="text"
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
            placeholder="e.g. CREATE, UPDATE, LOGIN"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold-400/30"
          />
        </div>
        <button type="submit" className="btn-gold">
          Filter
        </button>
        {(action || actionInput) && (
          <button type="button" onClick={clearFilter} className="btn-outline">
            Clear
          </button>
        )}
      </form>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className="px-4 py-3 text-left font-medium text-slate-500">Time</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Admin</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Action</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Resource</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    Loading audit logs…
                  </td>
                </tr>
              )}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    No audit entries found.
                  </td>
                </tr>
              )}
              {!loading &&
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{log.admin_name || 'System'}</p>
                      {log.admin_email && <p className="text-xs text-slate-400">{log.admin_email}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${actionTone(log.action)}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-ink">{log.resource_type || '—'}</p>
                      {log.resource_id && (
                        <p className="max-w-[200px] truncate text-xs text-slate-400" title={log.resource_id}>
                          {log.resource_id}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code
                        className="block max-w-[380px] truncate font-mono text-xs text-slate-500"
                        title={formatMetadata(log.metadata)}
                      >
                        {formatMetadata(log.metadata)}
                      </code>
                    </td>
                  </tr>
                ))}
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
    </div>
  )
}
