'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'

import { API_BASE, adminHeaders, apiErrorMessage, readApiPayload } from '../lib/api'

type RewardStatus = 'AVAILABLE' | 'LOW_STOCK' | 'EXHAUSTED' | 'PAUSED'

type Reward = {
  id: string
  name: string
  description: string
  image_url: string
  total_quantity: number
  remaining_quantity: number
  weight: number
  winning_ratio: number | null
  is_active: boolean | number
  status: string
  low_stock_threshold: number
  rewarded_count: number
  delivered_count: number
  campaign_id?: string | null
}

type InventoryReward = {
  id: string
  name: string
  total_quantity: number
  remaining_quantity: number
  status: string
  low_stock_threshold: number
  rewarded_count: number
  delivered_count: number
  pending_count: number
  utilization_rate: number
  winning_ratio: number | null
}

type InventorySummary = {
  total_stock: number
  total_rewarded: number
  total_remaining: number
  total_delivered: number
  total_pending: number
}

type HistoryEntry = {
  id: string
  delivery_status: string
  won_at: string
  delivered_at: string | null
  user_name: string
  user_email: string
  reward_name: string
  product_name: string
}

type RewardForm = {
  name: string
  nameMy: string
  description: string
  descriptionMy: string
  imageUrl: string
  totalQuantity: number
  weight: number
  lowStockThreshold: number
  campaignId: string
  winningRatio: number | null
  isActive: boolean
  status: RewardStatus
}

type Tab = 'rewards' | 'inventory' | 'history'

const defaultForm: RewardForm = {
  name: '',
  nameMy: '',
  description: '',
  descriptionMy: '',
  imageUrl: '',
  totalQuantity: 1,
  weight: 1,
  lowStockThreshold: 5,
  campaignId: '',
  winningRatio: null,
  isActive: true,
  status: 'AVAILABLE',
}

const historyLimit = 50

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asRewardStatus(value: string): RewardStatus {
  switch (value.toUpperCase()) {
    case 'PAUSED':
      return 'PAUSED'
    case 'LOW_STOCK':
      return 'LOW_STOCK'
    case 'EXHAUSTED':
      return 'EXHAUSTED'
    default:
      return 'AVAILABLE'
  }
}

function extractList<T>(value: unknown, key: string): T[] {
  if (Array.isArray(value)) return value as T[]
  if (isRecord(value) && Array.isArray(value[key])) return value[key] as T[]
  return []
}

export default function RewardsPage() {
  const [tab, setTab] = useState<Tab>('rewards')
  const [rewards, setRewards] = useState<Reward[]>([])
  const [inventory, setInventory] = useState<InventoryReward[]>([])
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyOffset, setHistoryOffset] = useState(0)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [mutationError, setMutationError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editingReward, setEditingReward] = useState<Reward | null>(null)
  const [form, setForm] = useState<RewardForm>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')

  const [adjustModal, setAdjustModal] = useState<{ open: boolean; reward: Reward | null }>({ open: false, reward: null })
  const [adjustment, setAdjustment] = useState(0)
  const [reason, setReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  const requestId = useRef(0)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const fetchRewards = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`${API_BASE}/admin/rewards`, { headers: adminHeaders(), signal })
    const payload = await readApiPayload(response)
    if (!response.ok || !payload || payload.success !== true) throw new Error(apiErrorMessage(payload, 'Failed to load rewards'))
    return extractList<Reward>(payload.data, 'rewards')
  }, [])

  const fetchInventory = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`${API_BASE}/admin/rewards/inventory`, { headers: adminHeaders(), signal })
    const payload = await readApiPayload(response)
    if (!response.ok || !payload || payload.success !== true) throw new Error(apiErrorMessage(payload, 'Failed to load inventory'))
    const data = isRecord(payload.data) ? payload.data : {}
    return {
      rewards: extractList<InventoryReward>(data, 'rewards'),
      summary: (data.summary || null) as InventorySummary | null,
    }
  }, [])

  const fetchHistory = useCallback(async (offset: number, signal?: AbortSignal) => {
    const response = await fetch(`${API_BASE}/admin/rewards/history?limit=${historyLimit}&offset=${offset}`, { headers: adminHeaders(), signal })
    const payload = await readApiPayload(response)
    if (!response.ok || !payload || payload.success !== true) throw new Error(apiErrorMessage(payload, 'Failed to load reward history'))
    const data = isRecord(payload.data) ? payload.data : {}
    return {
      history: extractList<HistoryEntry>(data, 'history'),
      total: typeof data.total === 'number' ? data.total : 0,
    }
  }, [])

  const loadData = useCallback(async () => {
    const id = ++requestId.current
    controller.current?.abort()
    const nextController = new AbortController()
    controller.current = nextController
    setLoading(true)
    setLoadError('')
    try {
      if (tab === 'rewards') {
        const data = await fetchRewards(nextController.signal)
        if (id === requestId.current) setRewards(data)
      } else if (tab === 'inventory') {
        const data = await fetchInventory(nextController.signal)
        if (id === requestId.current) {
          setInventory(data.rewards)
          setInventorySummary(data.summary)
        }
      } else {
        const data = await fetchHistory(historyOffset, nextController.signal)
        if (id === requestId.current) {
          setHistory(data.history)
          setHistoryTotal(data.total)
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (id === requestId.current) setLoadError(error instanceof Error ? error.message : 'Failed to load data. Please try again.')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [tab, historyOffset, fetchRewards, fetchInventory, fetchHistory])

  useEffect(() => {
    // Tab-scoped loader intentionally resets loading when its request key changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
    return () => controller.current?.abort()
  }, [loadData])

  const openAddModal = () => {
    setEditingReward(null)
    setForm({ ...defaultForm })
    setImageFile(null)
    setPreviewUrl(null)
    setUploadError('')
    setMutationError('')
    setShowModal(true)
  }

  const openEditModal = (reward: Reward) => {
    setEditingReward(reward)
    setForm({
      name: reward.name || '',
      nameMy: '',
      description: reward.description || '',
      descriptionMy: '',
      imageUrl: reward.image_url || '',
      totalQuantity: Number(reward.total_quantity) || 0,
      weight: Number(reward.weight) || 0,
      lowStockThreshold: Number(reward.low_stock_threshold) || 0,
      campaignId: reward.campaign_id || '',
      winningRatio: reward.winning_ratio == null ? null : Number(reward.winning_ratio),
      isActive: reward.is_active === true || reward.is_active === 1,
      status: asRewardStatus(reward.status),
    })
    setImageFile(null)
    setPreviewUrl(null)
    setUploadError('')
    setMutationError('')
    setShowModal(true)
  }

  function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File too large. Maximum size is 5MB')
      return
    }
    setUploadError('')
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function uploadPendingImage(): Promise<string> {
    if (!imageFile) return form.imageUrl
    const uploadData = new FormData()
    uploadData.append('file', imageFile)
    uploadData.append('type', 'reward')
    // Uploading a replacement must wait for Save.
    const response = await fetch(`${API_BASE}/admin/upload`, { method: 'POST', headers: adminHeaders(), body: uploadData })
    const payload = await readApiPayload(response)
    const data = payload?.data as { url?: string } | undefined
    const url = data?.url || payload?.url
    if (!response.ok || !payload || payload.success !== true || !url) throw new Error(apiErrorMessage(payload, 'Failed to upload reward image'))
    return url
  }

  const saveReward = async () => {
    if (!form.name.trim()) {
      setMutationError('Reward name is required')
      return
    }
    if (!Number.isInteger(form.totalQuantity) || form.totalQuantity < 0) {
      setMutationError('Total quantity must be a non-negative whole number')
      return
    }
    setSaving(true)
    setMutationError('')
    setUploadError('')
    try {
      const imageUrl = await uploadPendingImage()
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description,
        imageUrl,
        totalQuantity: form.totalQuantity,
        weight: form.weight,
        lowStockThreshold: form.lowStockThreshold,
        winningRatio: form.winningRatio,
        translations: {
          en: { name: form.name.trim(), description: form.description },
          my: { name: form.nameMy, description: form.descriptionMy },
        },
      }
      if (form.campaignId.trim()) body.campaignId = form.campaignId.trim()
      if (editingReward) {
        body.status = form.status
        body.isActive = form.isActive ? 1 : 0
      }

      const method = editingReward ? 'PATCH' : 'POST'
      const url = editingReward ? `${API_BASE}/admin/rewards/${editingReward.id}` : `${API_BASE}/admin/rewards`
      const response = await fetch(url, {
        method,
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      })
      const payload = await readApiPayload(response)
      if (!response.ok || !payload || payload.success !== true) throw new Error(apiErrorMessage(payload, 'Failed to save reward'))
      setShowModal(false)
      setImageFile(null)
      setPreviewUrl(null)
      void loadData()
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Failed to save reward. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const openAdjustModal = (reward: Reward) => {
    setAdjustModal({ open: true, reward })
    setAdjustment(0)
    setReason('')
    setMutationError('')
  }

  async function saveStockAdjustment() {
    if (!adjustModal.reward) return
    if (!Number.isInteger(adjustment)) {
      setMutationError('Adjustment must be a whole number')
      return
    }
    if (!reason.trim()) {
      setMutationError('A reason is required')
      return
    }
    setAdjusting(true)
    setMutationError('')
    try {
      const response = await fetch(`${API_BASE}/admin/rewards/${adjustModal.reward.id}/stock`, {
        method: 'PATCH',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ adjustment, reason: reason.trim() }),
      })
      const payload = await readApiPayload(response)
      if (!response.ok || !payload || payload.success !== true) throw new Error(apiErrorMessage(payload, 'Failed to adjust stock'))
      setAdjustModal({ open: false, reward: null })
      void loadData()
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Failed to adjust stock. Please try again.')
    } finally {
      setAdjusting(false)
    }
  }

  function statusBadge(status: string) {
    const normalized = status.toUpperCase()
    const colors: Record<string, string> = {
      AVAILABLE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      LOW_STOCK: 'bg-amber-50 text-amber-700 ring-amber-200',
      EXHAUSTED: 'bg-rose-50 text-rose-700 ring-rose-200',
      PAUSED: 'bg-slate-100 text-slate-600 ring-slate-200',
    }
    return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${colors[normalized] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>{normalized}</span>
  }

  function deliveryBadge(status: string) {
    const normalized = status.toUpperCase()
    const colors: Record<string, string> = {
      DELIVERED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
      DELIVERY_SUBMITTED: 'bg-amber-50 text-amber-700 ring-amber-200',
      PROCESSING: 'bg-violet-50 text-violet-700 ring-violet-200',
      SHIPPED: 'bg-sky-50 text-sky-700 ring-sky-200',
      CANCELLED: 'bg-rose-50 text-rose-700 ring-rose-200',
    }
    return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${colors[normalized] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>{normalized}</span>
  }

  function lowStockIndicator(reward: InventoryReward) {
    if (reward.remaining_quantity <= reward.low_stock_threshold) {
      return <span className="ml-2 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">Low Stock</span>
    }
    return null
  }

  const hasCurrentRows = tab === 'rewards' ? rewards.length > 0 : tab === 'inventory' ? inventory.length > 0 : history.length > 0

  return (
    <div>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Rewards Management</h1>
            <p className="mt-1 text-sm text-slate-500">Gifts, inventory and delivery history</p>
          </div>
          {tab === 'rewards' && <button type="button" onClick={openAddModal} className="btn-gold shadow-gold"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Add Reward</button>}
        </div>

        <div className="border-b border-slate-200">
          <nav className="flex gap-6">
            {(['rewards', 'inventory', 'history'] as Tab[]).map((item) => (
              <button key={item} type="button" onClick={() => { setTab(item); if (item === 'history') setHistoryOffset(0); setMutationError('') }} className={`border-b-2 pb-3 text-sm font-medium transition-colors ${tab === item ? 'border-gold-500 text-gold-600' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {loadError && <div role="alert" className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"><span>{loadError}</span><button type="button" onClick={() => void loadData()} className="font-semibold underline">Retry</button></div>}
        {mutationError && <div role="alert" className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><span>{mutationError}</span><button type="button" onClick={() => setMutationError('')} className="ml-4 font-semibold underline">Dismiss</button></div>}

        {loading && !hasCurrentRows && <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-gold" /></div>}
        {!loading && loadError && !hasCurrentRows && <div className="card p-8 text-center"><p className="text-sm font-medium text-ink">Failed to load {tab}</p><p className="mt-1 text-sm text-slate-500">{loadError}</p></div>}
        {!loading && !loadError && !hasCurrentRows && tab === 'rewards' && <div className="card p-12 text-center text-slate-500">No rewards found.</div>}
        {!loading && !loadError && !hasCurrentRows && tab === 'inventory' && <div className="card p-12 text-center text-slate-500">No inventory data found.</div>}
        {!loading && !loadError && !hasCurrentRows && tab === 'history' && <div className="card p-12 text-center text-slate-500">No history found.</div>}

        {hasCurrentRows && tab === 'rewards' && (
          <div className="card overflow-hidden">
            {loading && <p className="border-b border-slate-100 px-6 py-2 text-xs text-slate-400">Refreshing rewards…</p>}
            <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Reward</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Stock</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Weight / Ratio</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Stats</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">
              {rewards.map((reward) => <tr key={reward.id} className="transition-colors hover:bg-slate-50/70"><td className="px-6 py-4"><div className="flex items-center gap-3">{reward.image_url && <Image src={reward.image_url} alt={reward.name} width={40} height={40} className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200" />}<div><div className="text-sm font-medium text-ink">{reward.name}</div><div className="line-clamp-1 text-xs text-slate-500">{reward.description}</div></div></div></td><td className="px-6 py-4 text-sm text-slate-700">{reward.remaining_quantity} / {reward.total_quantity}</td><td className="px-6 py-4 text-sm text-slate-700">{reward.weight}<span className="block text-xs text-slate-400">{reward.winning_ratio == null ? 'Auto ratio' : `${reward.winning_ratio}% ratio`}</span></td><td className="px-6 py-4"><div className="flex items-center gap-2">{statusBadge(reward.status)}{!(reward.is_active === true || reward.is_active === 1) && <span className="text-xs text-slate-400">(disabled)</span>}</div></td><td className="px-6 py-4 text-sm text-slate-500">Rewarded: {reward.rewarded_count} | Delivered: {reward.delivered_count}</td><td className="px-6 py-4"><div className="flex gap-3"><button type="button" onClick={() => openEditModal(reward)} className="text-sm font-semibold text-gold-600 hover:text-gold-700">Edit</button><button type="button" onClick={() => openAdjustModal(reward)} className="text-sm font-semibold text-amber-600 hover:text-amber-700">Adjust</button></div></td></tr>)}
            </tbody></table></div>
          </div>
        )}

        {hasCurrentRows && tab === 'inventory' && (
          <>
            {inventorySummary && <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{[
              ['Total Stock', inventorySummary.total_stock], ['Total Rewarded', inventorySummary.total_rewarded], ['Total Remaining', inventorySummary.total_remaining], ['Total Delivered', inventorySummary.total_delivered], ['Total Pending', inventorySummary.total_pending],
            ].map(([label, value]) => <div key={String(label)} className="card p-4"><div className="text-sm text-slate-500">{label}</div><div className="font-display text-2xl font-bold text-ink">{String(value ?? 0)}</div></div>)}</div>}
            <div className="card overflow-hidden">{loading && <p className="border-b border-slate-100 px-6 py-2 text-xs text-slate-400">Refreshing inventory…</p>}<div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Reward</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Remaining</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Threshold</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Rewarded</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Delivered</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Pending</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Utilization</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{inventory.map((reward) => <tr key={reward.id} className="transition-colors hover:bg-slate-50/70"><td className="px-6 py-4 text-sm font-medium text-ink">{reward.name}</td><td className="px-6 py-4 text-sm text-slate-700">{reward.total_quantity}</td><td className="px-6 py-4 text-sm text-slate-700">{reward.remaining_quantity}</td><td className="px-6 py-4"><div className="flex items-center">{statusBadge(reward.status)}{lowStockIndicator(reward)}</div></td><td className="px-6 py-4 text-sm text-slate-700">{reward.low_stock_threshold}</td><td className="px-6 py-4 text-sm text-slate-700">{reward.rewarded_count}</td><td className="px-6 py-4 text-sm text-slate-700">{reward.delivered_count}</td><td className="px-6 py-4 text-sm text-slate-700">{reward.pending_count}</td><td className="px-6 py-4 text-sm font-semibold text-gold-600">{Number(reward.utilization_rate || 0).toFixed(1)}%</td><td className="px-6 py-4"><button type="button" onClick={() => { const source = rewards.find((item) => item.id === reward.id) || { id: reward.id, name: reward.name, description: '', image_url: '', total_quantity: reward.total_quantity, remaining_quantity: reward.remaining_quantity, weight: 0, winning_ratio: reward.winning_ratio, is_active: true, status: reward.status, low_stock_threshold: reward.low_stock_threshold, rewarded_count: reward.rewarded_count, delivered_count: reward.delivered_count }; openAdjustModal(source) }} className="text-sm font-semibold text-amber-600 hover:text-amber-700">Adjust</button></td></tr>)}</tbody></table></div></div>
          </>
        )}

        {hasCurrentRows && tab === 'history' && (
          <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200"><thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">User</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Reward</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Product</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Won At</th><th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Delivered At</th></tr></thead><tbody className="divide-y divide-slate-100">{history.map((entry) => <tr key={entry.id} className="transition-colors hover:bg-slate-50/70"><td className="px-6 py-4"><div className="text-sm font-medium text-ink">{entry.user_name}</div><div className="text-xs text-slate-500">{entry.user_email}</div></td><td className="px-6 py-4 text-sm text-slate-700">{entry.reward_name}</td><td className="px-6 py-4 text-sm text-slate-700">{entry.product_name || '-'}</td><td className="px-6 py-4">{deliveryBadge(entry.delivery_status)}</td><td className="px-6 py-4 text-sm text-slate-500">{entry.won_at ? new Date(entry.won_at).toLocaleString() : '-'}</td><td className="px-6 py-4 text-sm text-slate-500">{entry.delivered_at ? new Date(entry.delivered_at).toLocaleString() : '-'}</td></tr>)}</tbody></table></div>{historyTotal > historyLimit && <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3"><span className="text-sm text-slate-500">Showing {historyOffset + 1}–{Math.min(historyOffset + historyLimit, historyTotal)} of {historyTotal}</span><div className="flex gap-2"><button type="button" disabled={historyOffset === 0 || loading} onClick={() => setHistoryOffset((value) => Math.max(0, value - historyLimit))} className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-700 disabled:opacity-40">Previous</button><button type="button" disabled={historyOffset + historyLimit >= historyTotal || loading} onClick={() => setHistoryOffset((value) => value + historyLimit)} className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-700 disabled:opacity-40">Next</button></div></div>}</div>
        )}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
              <div className="border-b border-slate-200 px-6 py-4"><h2 className="font-display text-lg font-semibold text-ink">{editingReward ? 'Edit Reward' : 'Add Reward'}</h2></div>
              <div className="space-y-4 px-6 py-4">
                {(uploadError || mutationError) && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{uploadError || mutationError}</div>}
                <div><label htmlFor="reward-name" className="mb-1 block text-sm font-medium text-slate-700">Name (English) *</label><input id="reward-name" type="text" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="input" /></div>
                <div><label htmlFor="reward-name-my" className="mb-1 block text-sm font-medium text-slate-700">Name (Myanmar)</label><input id="reward-name-my" type="text" value={form.nameMy} onChange={(event) => setForm({ ...form, nameMy: event.target.value })} className="input" /></div>
                <div><label htmlFor="reward-description" className="mb-1 block text-sm font-medium text-slate-700">Description (English)</label><textarea id="reward-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="input resize-none" /></div>
                <div><label htmlFor="reward-description-my" className="mb-1 block text-sm font-medium text-slate-700">Description (Myanmar)</label><textarea id="reward-description-my" value={form.descriptionMy} onChange={(event) => setForm({ ...form, descriptionMy: event.target.value })} rows={3} className="input resize-none" /></div>
                <div><label htmlFor="reward-image" className="mb-1 block text-sm font-medium text-slate-700">Reward Image</label><div className="space-y-3">{(previewUrl || form.imageUrl) && <div className="relative w-full max-w-xs"><Image src={previewUrl || form.imageUrl} alt="Reward preview" width={480} height={288} className="h-48 w-full rounded-lg border border-slate-200 object-cover" />{previewUrl && <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-1 text-xs text-white">Pending save</span>}</div>}<label htmlFor="reward-image" className="cursor-pointer"><input id="reward-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageUpload} className="sr-only" disabled={saving} /><div className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${previewUrl || form.imageUrl ? 'border-slate-300 bg-slate-50' : 'border-gold/50 bg-gold/5'}`}><p className="text-sm font-medium text-slate-700">{imageFile ? 'Image selected — save to apply' : form.imageUrl ? 'Click to change image' : 'Click to choose image'}</p><p className="mt-1 text-xs text-slate-500">JPEG, PNG, WebP, GIF up to 5MB</p></div></label></div></div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><div><label htmlFor="reward-total" className="mb-1 block text-sm font-medium text-slate-700">Total Quantity *</label><input id="reward-total" type="number" min={0} step={1} value={form.totalQuantity} onChange={(event) => setForm({ ...form, totalQuantity: Number(event.target.value) })} className="input" /></div><div><label htmlFor="reward-weight" className="mb-1 block text-sm font-medium text-slate-700">Weight *</label><input id="reward-weight" type="number" min={0} step={1} value={form.weight} onChange={(event) => setForm({ ...form, weight: Number(event.target.value) })} className="input" /></div><div><label htmlFor="reward-threshold" className="mb-1 block text-sm font-medium text-slate-700">Low Stock Threshold</label><input id="reward-threshold" type="number" min={0} step={1} value={form.lowStockThreshold} onChange={(event) => setForm({ ...form, lowStockThreshold: Number(event.target.value) })} className="input" /></div></div>
                <div><label htmlFor="reward-campaign" className="mb-1 block text-sm font-medium text-slate-700">Campaign ID</label><input id="reward-campaign" type="text" value={form.campaignId} onChange={(event) => setForm({ ...form, campaignId: event.target.value })} className="input" /></div>
                <div><label htmlFor="reward-ratio" className="mb-1 block text-sm font-medium text-slate-700">Winning Ratio (%) <span className="font-normal text-slate-400">— optional</span></label><input id="reward-ratio" type="number" min={0} max={100} step="0.01" value={form.winningRatio ?? ''} placeholder="Auto (by stock)" onChange={(event) => setForm({ ...form, winningRatio: event.target.value === '' ? null : Number(event.target.value) })} className="input" /><p className="mt-1 text-xs text-slate-400">Leave empty to use automatic weighting. A null value is sent when cleared.</p></div>
                {editingReward && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label htmlFor="reward-status" className="mb-1 block text-sm font-medium text-slate-700">Status</label><select id="reward-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as RewardStatus })} className="input"><option value="AVAILABLE">AVAILABLE</option><option value="LOW_STOCK">LOW_STOCK</option><option value="EXHAUSTED">EXHAUSTED</option><option value="PAUSED">PAUSED</option></select><p className="mt-1 text-xs text-slate-400">Stock statuses are derived by the API; PAUSED is the manual override.</p></div><div className="flex items-end"><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} className="h-4 w-4 rounded border-slate-300 accent-gold" />Active</label></div></div>}
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4"><button type="button" onClick={() => { setShowModal(false); setImageFile(null); setPreviewUrl(null) }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button><button type="button" onClick={() => void saveReward()} disabled={saving || !form.name} className="btn-gold disabled:opacity-50">{saving ? 'Saving...' : editingReward ? 'Update' : 'Create'}</button></div>
            </div>
          </div>
        )}

        {adjustModal.open && adjustModal.reward && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><div className="w-full max-w-md rounded-3xl bg-white shadow-2xl"><div className="border-b border-slate-200 px-6 py-4"><h2 className="font-display text-lg font-semibold text-ink">Adjust Stock: {adjustModal.reward.name}</h2><p className="mt-1 text-sm text-slate-500">Current stock: {adjustModal.reward.remaining_quantity} / {adjustModal.reward.total_quantity}</p></div><div className="space-y-4 px-6 py-4"><div><label htmlFor="stock-adjustment" className="mb-1 block text-sm font-medium text-slate-700">Adjustment (positive to add, negative to subtract)</label><input id="stock-adjustment" type="number" step={1} value={adjustment} onChange={(event) => setAdjustment(Number(event.target.value))} className="input" /></div><div><label htmlFor="stock-reason" className="mb-1 block text-sm font-medium text-slate-700">Reason *</label><input id="stock-reason" type="text" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Restock, Damaged, etc." className="input" /></div></div><div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4"><button type="button" onClick={() => setAdjustModal({ open: false, reward: null })} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button><button type="button" onClick={() => void saveStockAdjustment()} disabled={adjusting || !reason} className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">{adjusting ? 'Saving...' : 'Apply'}</button></div></div></div>
        )}
      </div>
    </div>
  )
}
