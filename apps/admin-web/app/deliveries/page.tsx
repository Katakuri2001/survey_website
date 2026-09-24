'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { API_BASE, adminHeaders, apiErrorMessage, readApiPayload } from '../lib/api'

const PAGE_SIZE = 50

const STATUS_OPTIONS = [
  'DELIVERY_SUBMITTED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const

type DeliveryStatus = (typeof STATUS_OPTIONS)[number]

type Delivery = {
  id: string
  delivery_status: string
  won_at: string
  delivered_at: string | null
  user_name: string
  user_email: string
  user_phone: string
  reward_name: string
  requires_delivery: number | boolean
  delivery_name: string | null
  delivery_phone: string | null
  address: string | null
  city: string | null
  township: string | null
  postal_code: string | null
}

type DeliveryResponse = {
  deliveries: Delivery[]
  total: number
}

/** Only transitions the delivery API accepts are made visible in the editor. */
const NEXT_STATUSES: Record<DeliveryStatus, DeliveryStatus[]> = {
  DELIVERY_SUBMITTED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function statusClass(status: string): string {
  switch (status) {
    case 'DELIVERED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 ring-rose-200'
    case 'SHIPPED':
      return 'bg-sky-50 text-sky-700 ring-sky-200'
    case 'PROCESSING':
      return 'bg-amber-50 text-amber-700 ring-amber-200'
    case 'DELIVERY_SUBMITTED':
      return 'bg-violet-50 text-violet-700 ring-violet-200'
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200'
  }
}

function asStatus(value: string): DeliveryStatus | null {
  return STATUS_OPTIONS.includes(value as DeliveryStatus) ? (value as DeliveryStatus) : null
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
        <svg className="h-6 w-6 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <p className="mb-1 text-sm font-medium text-ink">Failed to load deliveries</p>
      <p className="mb-4 text-sm text-slate-500">{message}</p>
      <button type="button" onClick={onRetry} className="btn-outline">
        Retry
      </button>
    </div>
  )
}

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [mutationError, setMutationError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, DeliveryStatus | ''>>({})
  const requestId = useRef(0)
  const controller = useRef<AbortController | null>(null)

  const fetchDeliveries = useCallback(async () => {
    const id = ++requestId.current
    controller.current?.abort()
    const nextController = new AbortController()
    controller.current = nextController
    setLoading(true)
    setLoadError('')

    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    })
    if (statusFilter) params.set('status', statusFilter)

    try {
      const response = await fetch(`${API_BASE}/admin/deliveries?${params}`, {
        headers: adminHeaders(),
        signal: nextController.signal,
      })
      const payload = await readApiPayload(response)
      if (!response.ok || !payload || payload.success !== true) {
        throw new Error(apiErrorMessage(payload, 'Failed to load deliveries'))
      }
      const data = (payload.data || {}) as Partial<DeliveryResponse>
      if (id !== requestId.current) return
      setDeliveries(Array.isArray(data.deliveries) ? data.deliveries : [])
      setTotal(typeof data.total === 'number' ? data.total : 0)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (id !== requestId.current) return
      setLoadError(error instanceof Error ? error.message : 'Failed to load deliveries')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [offset, statusFilter])

  useEffect(() => {
    // Initial delivery list load; the request callback owns the state updates.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDeliveries()
    return () => controller.current?.abort()
  }, [fetchDeliveries])

  function updateFilter(value: string) {
    setStatusFilter(value)
    setOffset(0)
    setMutationError('')
  }

  async function updateStatus(delivery: Delivery, nextStatus: DeliveryStatus) {
    const currentStatus = asStatus(delivery.delivery_status)
    if (!currentStatus || currentStatus === nextStatus) return
    if (!NEXT_STATUSES[currentStatus].includes(nextStatus)) return

    if (nextStatus === 'CANCELLED') {
      const confirmed = window.confirm(
        'Cancel this delivery? The awarded reward will be returned to inventory according to the API workflow.',
      )
      if (!confirmed) {
        setPendingStatuses((previous) => {
          const next = { ...previous }
          delete next[delivery.id]
          return next
        })
        return
      }
    }

    setUpdatingId(delivery.id)
    setMutationError('')
    setPendingStatuses((previous) => ({ ...previous, [delivery.id]: nextStatus }))
    try {
      const response = await fetch(`${API_BASE}/admin/deliveries/${delivery.id}/status`, {
        method: 'PATCH',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: nextStatus }),
      })
      const payload = await readApiPayload(response)
      if (!response.ok || !payload || payload.success !== true) {
        throw new Error(apiErrorMessage(payload, 'Failed to update delivery status'))
      }
      if (delivery.id) {
        setDeliveries((previous) =>
          previous.map((item) =>
            item.id === delivery.id
              ? {
                  ...item,
                  delivery_status: nextStatus,
                  // The status endpoint returns an acknowledgement, not a row;
                  // leave the server timestamp untouched until the next fetch.
                  delivered_at: item.delivered_at,
                }
              : item,
          ),
        )
      }
      setPendingStatuses((previous) => {
        const next = { ...previous }
        delete next[delivery.id]
        return next
      })
      // Refresh the row so delivered_at and any server-side side effects come
      // from the API rather than being guessed in the browser.
      void fetchDeliveries()
    } catch (error) {
      setPendingStatuses((previous) => {
        const next = { ...previous }
        delete next[delivery.id]
        return next
      })
      setMutationError(error instanceof Error ? error.message : 'Failed to update delivery status')
    } finally {
      setUpdatingId(null)
    }
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Deliveries</h1>
          <p className="mt-1 text-sm text-slate-500">Review fulfillment status and delivery addresses</p>
        </div>
        <button type="button" onClick={() => void fetchDeliveries()} disabled={loading} className="btn-outline">
          <svg className="h-4 w-4 text-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <label htmlFor="delivery-status-filter" className="mb-1.5 block text-sm font-medium text-slate-700">
            Status
          </label>
          <select
            id="delivery-status-filter"
            value={statusFilter}
            onChange={(event) => updateFilter(event.target.value)}
            className="input"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-slate-500">
          {loading && deliveries.length === 0 ? 'Loading...' : `${total.toLocaleString()} deliveries`}
        </p>
      </div>

      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between">
          <span>{loadError}</span>
          <button type="button" onClick={() => void fetchDeliveries()} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {mutationError && (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span>{mutationError}</span>
          <button type="button" onClick={() => setMutationError('')} className="ml-4 font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      {loading && deliveries.length === 0 && !loadError && (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="card h-24" />
          ))}
        </div>
      )}

      {!loading && loadError && deliveries.length === 0 && <ErrorState message={loadError} onRetry={() => void fetchDeliveries()} />}

      {!loading && !loadError && deliveries.length === 0 && (
        <div className="card p-12 text-center">
          <h2 className="font-display text-lg font-semibold text-ink">No deliveries found</h2>
          <p className="mt-1 text-sm text-slate-500">There are no delivery records matching this filter.</p>
        </div>
      )}

      {deliveries.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Recipient</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Reward</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Address</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Dates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deliveries.map((delivery) => {
                  const currentStatus = asStatus(delivery.delivery_status)
                  const transitions = currentStatus ? NEXT_STATUSES[currentStatus] : []
                  const selectedStatus = pendingStatuses[delivery.id] ?? currentStatus ?? ''
                  return (
                    <tr key={delivery.id} className="align-top transition-colors hover:bg-slate-50/70">
                      <td className="min-w-[190px] px-4 py-4">
                        <p className="font-medium text-ink">{delivery.delivery_name || delivery.user_name || '—'}</p>
                        <p className="text-xs text-slate-500">{delivery.delivery_phone || delivery.user_phone || '—'}</p>
                        <p className="mt-1 text-xs text-slate-400">{delivery.user_email || '—'}</p>
                      </td>
                      <td className="min-w-[160px] px-4 py-4 text-sm text-slate-700">
                        <p>{delivery.reward_name || '—'}</p>
                        {delivery.requires_delivery === 0 || delivery.requires_delivery === false ? (
                          <span className="mt-1 inline-block text-xs text-slate-400">No address required</span>
                        ) : null}
                      </td>
                      <td className="min-w-[240px] px-4 py-4 text-sm text-slate-600">
                        {delivery.address ? (
                          <>
                            <p>{delivery.address}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {[delivery.city, delivery.township, delivery.postal_code].filter(Boolean).join(', ') || '—'}
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-400">No address submitted</span>
                        )}
                      </td>
                      <td className="min-w-[190px] px-4 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClass(delivery.delivery_status)}`}>
                          {statusLabel(delivery.delivery_status)}
                        </span>
                        {transitions.length > 0 ? (
                          <select
                            aria-label={`Update status for ${delivery.reward_name || delivery.id}`}
                            value={selectedStatus}
                            disabled={updatingId === delivery.id}
                            onChange={(event) => {
                              const next = asStatus(event.target.value)
                              if (next) void updateStatus(delivery, next)
                            }}
                            className="input mt-3 py-2 text-xs"
                          >
                            <option value={currentStatus ?? ''}>Choose next status...</option>
                            {transitions.map((status) => (
                              <option key={status} value={status}>
                                {statusLabel(status)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="mt-2 text-xs text-slate-400">No further transitions</p>
                        )}
                        {updatingId === delivery.id && <p className="mt-1 text-xs text-slate-500">Saving status...</p>}
                      </td>
                      <td className="min-w-[180px] px-4 py-4 text-xs text-slate-500">
                        <p>Won: {formatDate(delivery.won_at)}</p>
                        <p className="mt-1">Delivered: {formatDate(delivery.delivered_at)}</p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
            <p className="text-sm text-slate-500">
              {total === 0
                ? 'No deliveries'
                : `Showing ${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}`}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={offset === 0 || loading}
                onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
                className="btn-outline disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-slate-500">Page {page} / {pageCount}</span>
              <button
                type="button"
                disabled={offset + PAGE_SIZE >= total || loading}
                onClick={() => setOffset((value) => value + PAGE_SIZE)}
                className="btn-outline disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
