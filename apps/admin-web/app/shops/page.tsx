'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import { API_BASE, adminHeaders, apiErrorMessage, readApiPayload } from '../lib/api'

type Shop = {
  id: string
  campaignId: string
  name: string
  slug: string
  description?: string | null
  logoUrl?: string | null
  address?: string | null
  contactInformation?: string | null
  status: string
  displayOrder: number
  rewardCount: number
  activeRewardCount: number
  totalStock: number
  remainingStock: number
  winProbability: number | null
}

type ShopReward = {
  id: string
  rewardName: string
  rewardDescription?: string | null
  rewardImageUrl?: string | null
  stockTotal: number
  stockRemaining: number
  probabilityWeight: number
  active: boolean
  status: string
  winningRatio: number | null
  isDefaultRemainder: boolean
  effectiveRatio: number
  assignedCount: number
  deliveredCount: number
}

type Tab = 'shops' | 'inventory' | 'config'

export default function ShopsPage() {
  const [tab, setTab] = useState<Tab>('shops')
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [mutationError, setMutationError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)

  // Shop form
  const [showShopModal, setShowShopModal] = useState(false)
  const [editingShop, setEditingShop] = useState<Shop | null>(null)
  const [shopForm, setShopForm] = useState({
    name: '',
    slug: '',
    description: '',
    logoUrl: '',
    address: '',
    contactInformation: '',
    status: 'ACTIVE',
    displayOrder: 0,
  })
  const [savingShop, setSavingShop] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Shop reward form
  const [showRewardModal, setShowRewardModal] = useState(false)
  const [editingReward, setEditingReward] = useState<ShopReward | null>(null)
  const [rewardForm, setRewardForm] = useState({
    rewardName: '',
    rewardDescription: '',
    rewardImageUrl: '',
    stockTotal: 1,
    probabilityWeight: 10,
    winningRatio: null as number | null,
    isDefaultRemainder: false,
    active: true,
  })
  const [savingReward, setSavingReward] = useState(false)
  const [rewardImageFile, setRewardImageFile] = useState<File | null>(null)
  const [rewardPreviewUrl, setRewardPreviewUrl] = useState<string | null>(null)

  // Shop rewards
  const [shopRewards, setShopRewards] = useState<ShopReward[]>([])
  const [loadingRewards, setLoadingRewards] = useState(false)

  // Winning config
  const [winConfig, setWinConfig] = useState({
    winProbability: 0,
    probabilityMode: 'percentage',
    noRewardEnabled: true,
  })
  const [savingConfig, setSavingConfig] = useState(false)

  const requestId = useRef(0)
  const controller = useRef<AbortController | null>(null)

  const fetchShops = useCallback(async (signal?: AbortSignal) => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    params.set('limit', '50')
    params.set('offset', '0')
    const response = await fetch(`${API_BASE}/admin/shops?${params.toString()}`, {
      headers: adminHeaders(),
      signal,
    })
    const payload = await readApiPayload(response)
    if (!response.ok || !payload || payload.success !== true) {
      throw new Error(apiErrorMessage(payload, 'Failed to load shops'))
    }
    const data = payload.data as { shops?: Shop[] } | null
    return (data?.shops || []) as Shop[]
  }, [search])

  const loadData = useCallback(async () => {
    const id = ++requestId.current
    controller.current?.abort()
    const nextController = new AbortController()
    controller.current = nextController
    setLoading(true)
    setLoadError('')
    try {
      const data = await fetchShops(nextController.signal)
      if (id === requestId.current) setShops(data)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      if (id === requestId.current) setLoadError(error instanceof Error ? error.message : 'Failed to load shops')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [fetchShops])

  useEffect(() => {
    void loadData()
    return () => controller.current?.abort()
  }, [loadData])

  const openAddShop = () => {
    setEditingShop(null)
    setShopForm({ name: '', slug: '', description: '', logoUrl: '', address: '', contactInformation: '', status: 'ACTIVE', displayOrder: 0 })
    setImageFile(null)
    setPreviewUrl(null)
    setMutationError('')
    setShowShopModal(true)
  }

  const openEditShop = (shop: Shop) => {
    setEditingShop(shop)
    setShopForm({
      name: shop.name || '',
      slug: shop.slug || '',
      description: shop.description || '',
      logoUrl: shop.logoUrl || '',
      address: shop.address || '',
      contactInformation: shop.contactInformation || '',
      status: shop.status || 'ACTIVE',
      displayOrder: shop.displayOrder || 0,
    })
    setImageFile(null)
    setPreviewUrl(null)
    setMutationError('')
    setShowShopModal(true)
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setMutationError('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMutationError('File too large. Maximum size is 5MB')
      return
    }
    setMutationError('')
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  const uploadPendingImage = async (): Promise<string> => {
    if (!imageFile) return shopForm.logoUrl
    const uploadData = new FormData()
    uploadData.append('file', imageFile)
    uploadData.append('type', 'shop')
    const response = await fetch(`${API_BASE}/admin/upload`, { method: 'POST', headers: adminHeaders(), body: uploadData })
    const payload = await readApiPayload(response)
    const data = payload?.data as { url?: string } | undefined
    const url = data?.url || payload?.url
    if (!response.ok || !payload || payload.success !== true || !url) throw new Error(apiErrorMessage(payload, 'Failed to upload shop logo'))
    return url
  }

  const saveShop = async () => {
    if (!shopForm.name.trim() || !shopForm.slug.trim()) {
      setMutationError('Name and slug are required')
      return
    }
    setSavingShop(true)
    setMutationError('')
    try {
      const logoUrl = await uploadPendingImage()
      const method = editingShop ? 'PATCH' : 'POST'
      const url = editingShop ? `${API_BASE}/admin/shops/${editingShop.id}` : `${API_BASE}/admin/shops`
      const body: Record<string, unknown> = {
        name: shopForm.name.trim(),
        slug: shopForm.slug.trim(),
        description: shopForm.description,
        logoUrl,
        address: shopForm.address,
        contactInformation: shopForm.contactInformation,
        status: shopForm.status,
        displayOrder: shopForm.displayOrder,
      }
      const response = await fetch(url, {
        method,
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      })
      const payload = await readApiPayload(response)
      if (!response.ok || !payload || payload.success !== true) {
        throw new Error(apiErrorMessage(payload, 'Failed to save shop'))
      }
      setShowShopModal(false)
      setImageFile(null)
      setPreviewUrl(null)
      void loadData()
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to save shop')
    } finally {
      setSavingShop(false)
    }
  }

  // Shop reward CRUD
  const openAddReward = (shop: Shop) => {
    setSelectedShop(shop)
    setEditingReward(null)
    setRewardForm({ rewardName: '', rewardDescription: '', rewardImageUrl: '', stockTotal: 1, probabilityWeight: 10, winningRatio: null, isDefaultRemainder: false, active: true })
    setRewardImageFile(null)
    setRewardPreviewUrl(null)
    setMutationError('')
    setShowRewardModal(true)
    void loadShopRewards(shop)
  }

  const openEditReward = (shop: Shop, reward: ShopReward) => {
    setSelectedShop(shop)
    setEditingReward(reward)
    setRewardForm({
      rewardName: reward.rewardName || '',
      rewardDescription: reward.rewardDescription || '',
      rewardImageUrl: reward.rewardImageUrl || '',
      stockTotal: reward.stockTotal,
      probabilityWeight: reward.probabilityWeight,
      winningRatio: reward.winningRatio,
      isDefaultRemainder: reward.isDefaultRemainder,
      active: reward.active,
    })
    setRewardImageFile(null)
    setRewardPreviewUrl(null)
    setMutationError('')
    setShowRewardModal(true)
  }

  const handleRewardImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setMutationError('Invalid file type')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setMutationError('File too large')
      return
    }
    setMutationError('')
    setRewardImageFile(file)
    setRewardPreviewUrl(URL.createObjectURL(file))
  }

  const uploadRewardImage = async (): Promise<string> => {
    if (!rewardImageFile) return rewardForm.rewardImageUrl
    const uploadData = new FormData()
    uploadData.append('file', rewardImageFile)
    uploadData.append('type', 'reward')
    const response = await fetch(`${API_BASE}/admin/upload`, { method: 'POST', headers: adminHeaders(), body: uploadData })
    const payload = await readApiPayload(response)
    const data = payload?.data as { url?: string } | undefined
    const url = data?.url || payload?.url
    if (!response.ok || !payload || payload.success !== true || !url) throw new Error(apiErrorMessage(payload, 'Failed to upload reward image'))
    return url
  }

  const saveReward = async () => {
    if (!selectedShop || !rewardForm.rewardName.trim()) {
      setMutationError('Reward name is required')
      return
    }
    setSavingReward(true)
    setMutationError('')
    try {
      const imageUrl = await uploadRewardImage()
      const method = editingReward ? 'PATCH' : 'POST'
      const url = editingReward
        ? `${API_BASE}/admin/shops/${selectedShop.id}/rewards/${editingReward.id}`
        : `${API_BASE}/admin/shops/${selectedShop.id}/rewards`
      const body: Record<string, unknown> = {
        rewardName: rewardForm.rewardName.trim(),
        rewardDescription: rewardForm.rewardDescription,
        rewardImageUrl: imageUrl,
        stockTotal: rewardForm.stockTotal,
        probabilityWeight: rewardForm.probabilityWeight,
        winningRatio: rewardForm.winningRatio,
        isDefaultRemainder: rewardForm.isDefaultRemainder ? 1 : 0,
        active: rewardForm.active ? 1 : 0,
      }
      const response = await fetch(url, {
        method,
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      })
      const payload = await readApiPayload(response)
      if (!response.ok || !payload || payload.success !== true) {
        throw new Error(apiErrorMessage(payload, 'Failed to save reward'))
      }
      setShowRewardModal(false)
      setRewardImageFile(null)
      setRewardPreviewUrl(null)
      void loadShopRewards(selectedShop)
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to save reward')
    } finally {
      setSavingReward(false)
    }
  }

  const toggleShopStatus = async (shop: Shop) => {
    const newStatus = shop.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      const response = await fetch(`${API_BASE}/admin/shops/${shop.id}/status`, {
        method: 'PATCH',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: newStatus }),
      })
      const payload = await readApiPayload(response)
      if (!response.ok || !payload || payload.success !== true) {
        throw new Error(apiErrorMessage(payload, 'Failed to update status'))
      }
      void loadData()
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  const loadShopRewards = async (shop: Shop) => {
    setSelectedShop(shop)
    setLoadingRewards(true)
    try {
      const response = await fetch(`${API_BASE}/admin/shops/${shop.id}/rewards`, { headers: adminHeaders() })
      const payload = await readApiPayload(response)
      if (response.ok && payload && payload.success === true) {
        const data = payload.data as { rewards?: ShopReward[] } | null
        setShopRewards((data?.rewards || []) as ShopReward[])
      }
    } catch { /* ignore */ }
    setLoadingRewards(false)
  }

  const loadWinningConfig = async (shop: Shop) => {
    setSelectedShop(shop)
    try {
      const response = await fetch(`${API_BASE}/admin/shops/${shop.id}/winning-config`, { headers: adminHeaders() })
      // winning-config is PATCH only, so we just show the shop's win probability
      setWinConfig({
        winProbability: shop.winProbability || 0,
        probabilityMode: 'percentage',
        noRewardEnabled: true,
      })
    } catch { /* ignore */ }
  }

  const saveWinningConfig = async () => {
    if (!selectedShop) return
    setSavingConfig(true)
    setMutationError('')
    try {
      const response = await fetch(`${API_BASE}/admin/shops/${selectedShop.id}/winning-config`, {
        method: 'PATCH',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          winProbability: winConfig.winProbability,
          probabilityMode: winConfig.probabilityMode,
          noRewardEnabled: winConfig.noRewardEnabled,
        }),
      })
      const payload = await readApiPayload(response)
      if (!response.ok || !payload || payload.success !== true) {
        throw new Error(apiErrorMessage(payload, 'Failed to save config'))
      }
      void loadData()
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : 'Failed to save config')
    } finally {
      setSavingConfig(false)
    }
  }

  const filteredShops = shops.filter((shop) => {
    if (statusFilter && shop.status !== statusFilter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return shop.name.toLowerCase().includes(q) || shop.slug.toLowerCase().includes(q) || (shop.address || '').toLowerCase().includes(q)
  })

  return (
    <div>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Shop Management</h1>
            <p className="mt-1 text-sm text-slate-500">Manage participating shops and their reward inventory</p>
          </div>
          <button type="button" onClick={openAddShop} className="btn-gold shadow-gold">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Shop
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex gap-6">
            {(['shops', 'inventory', 'config'] as Tab[]).map((item) => (
              <button key={item} type="button" onClick={() => setTab(item)} className={`border-b-2 pb-3 text-sm font-medium transition-colors ${tab === item ? 'border-gold-500 text-gold-600' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}>
                {item === 'shops' ? 'Shops' : item === 'inventory' ? 'Inventory' : 'Winning Config'}
              </button>
            ))}
          </nav>
        </div>

        {/* Search & filter */}
        {tab === 'shops' && (
          <div className="flex gap-3">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shops..." className="input flex-1" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-40">
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        )}

        {loadError && (
          <div role="alert" className="flex flex-col gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between">
            <span>{loadError}</span>
            <button type="button" onClick={() => void loadData()} className="font-semibold underline">Retry</button>
          </div>
        )}
        {mutationError && (
          <div role="alert" className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            <span>{mutationError}</span>
            <button type="button" onClick={() => setMutationError('')} className="ml-4 font-semibold underline">Dismiss</button>
          </div>
        )}

        {loading && shops.length === 0 && (
          <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-gold" /></div>
        )}

        {/* Shops table */}
        {tab === 'shops' && filteredShops.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Shop</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Rewards</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Win Prob</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredShops.map((shop) => (
                    <tr key={shop.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {shop.logoUrl && <Image src={shop.logoUrl} alt={shop.name} width={40} height={40} className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200" />}
                          <div>
                            <div className="text-sm font-medium text-ink">{shop.name}</div>
                            <div className="text-xs text-slate-500">{shop.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${shop.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                          {shop.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">{shop.activeRewardCount} / {shop.rewardCount}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{shop.remainingStock} / {shop.totalStock}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{shop.winProbability != null ? `${shop.winProbability}%` : '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-3">
                          <button type="button" onClick={() => openEditShop(shop)} className="text-sm font-semibold text-gold-600 hover:text-gold-700">Edit</button>
                          <button type="button" onClick={() => toggleShopStatus(shop)} className="text-sm font-semibold text-amber-600 hover:text-amber-700">
                            {shop.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button type="button" onClick={() => { setTab('inventory'); loadShopRewards(shop) }} className="text-sm font-semibold text-blue-600 hover:text-blue-700">Inventory</button>
                          <button type="button" onClick={() => { setTab('config'); loadWinningConfig(shop) }} className="text-sm font-semibold text-green-600 hover:text-green-700">Config</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Inventory tab */}
        {tab === 'inventory' && selectedShop && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">Rewards for {selectedShop.name}</h2>
              <div className="flex gap-2">
                <button type="button" onClick={() => openAddReward(selectedShop)} className="btn-gold shadow-gold text-sm">+ Add Reward</button>
                <button type="button" onClick={() => setSelectedShop(null)} className="text-sm text-slate-500 hover:text-slate-700">← Back</button>
              </div>
            </div>
            {loadingRewards ? (
              <div className="flex items-center justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-b-2 border-t-2 border-gold" /></div>
            ) : shopRewards.length === 0 ? (
              <div className="card p-8 text-center text-slate-500">No rewards configured for this shop.</div>
            ) : (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Reward</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Stock</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Config Ratio</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Effective Ratio</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Stats</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shopRewards.map((reward) => (
                        <tr key={reward.id} className="transition-colors hover:bg-slate-50/70">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {reward.rewardImageUrl && <Image src={reward.rewardImageUrl} alt={reward.rewardName} width={40} height={40} className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200" />}
                              <div className="text-sm font-medium text-ink">{reward.rewardName}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-700">{reward.stockRemaining} / {reward.stockTotal}</td>
                          <td className="px-6 py-4 text-sm text-slate-700">
                            {reward.isDefaultRemainder ? 'Remainder' : reward.winningRatio != null ? `${reward.winningRatio}%` : '—'}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gold-600">
                            {reward.effectiveRatio > 0 ? `${reward.effectiveRatio.toFixed(1)}%` : '0%'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${reward.status === 'EXHAUSTED' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}`}>
                              {reward.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-500">Assigned: {reward.assignedCount} | Delivered: {reward.deliveredCount}</td>
                          <td className="px-6 py-4">
                            <button type="button" onClick={() => openEditReward(selectedShop!, reward)} className="text-sm font-semibold text-gold-600 hover:text-gold-700">Edit</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Config tab */}
        {tab === 'config' && selectedShop && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">Winning Config for {selectedShop.name}</h2>
              <button type="button" onClick={() => setSelectedShop(null)} className="text-sm text-slate-500 hover:text-slate-700">← Back to shops</button>
            </div>
            <div className="card p-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Win Probability (%)</label>
                <input type="number" min={0} max={100} step={0.1} value={winConfig.winProbability} onChange={(e) => setWinConfig({ ...winConfig, winProbability: Number(e.target.value) })} className="input w-40" />
                <p className="mt-1 text-xs text-slate-400">Probability that a user selecting this shop receives a reward.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Probability Mode</label>
                <select value={winConfig.probabilityMode} onChange={(e) => setWinConfig({ ...winConfig, probabilityMode: e.target.value })} className="input w-40">
                  <option value="percentage">Percentage</option>
                  <option value="ratio">Ratio</option>
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={winConfig.noRewardEnabled} onChange={(e) => setWinConfig({ ...winConfig, noRewardEnabled: e.target.checked })} className="h-4 w-4 rounded border-slate-300 accent-gold" />
                  No-reward outcome enabled
                </label>
              </div>
              <button type="button" onClick={saveWinningConfig} disabled={savingConfig} className="btn-gold disabled:opacity-50">
                {savingConfig ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        )}

        {!selectedShop && tab !== 'shops' && (
          <div className="card p-8 text-center text-slate-500">
            Select a shop from the Shops tab to manage its {tab === 'inventory' ? 'inventory' : 'winning configuration'}.
          </div>
        )}

        {/* Shop modal */}
        {showShopModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="font-display text-lg font-semibold text-ink">{editingShop ? 'Edit Shop' : 'Add Shop'}</h2>
              </div>
              <div className="space-y-4 px-6 py-4">
                {mutationError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{mutationError}</div>}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Name *</label>
                  <input type="text" value={shopForm.name} onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Slug *</label>
                  <input type="text" value={shopForm.slug} onChange={(e) => setShopForm({ ...shopForm, slug: e.target.value })} className="input" placeholder="shop-a" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                  <textarea value={shopForm.description} onChange={(e) => setShopForm({ ...shopForm, description: e.target.value })} rows={3} className="input resize-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Logo URL</label>
                  <input type="text" value={shopForm.logoUrl} onChange={(e) => setShopForm({ ...shopForm, logoUrl: e.target.value })} className="input" />
                  {(previewUrl || shopForm.logoUrl) && (
                    <div className="mt-2">
                      <Image src={previewUrl || shopForm.logoUrl} alt="Logo preview" width={80} height={80} className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200" />
                    </div>
                  )}
                  <label className="mt-2 cursor-pointer inline-block">
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageUpload} className="sr-only" disabled={savingShop} />
                    <span className="text-sm text-gold-600 hover:text-gold-700 font-semibold">
                      {imageFile ? 'Image selected — save to apply' : 'Upload logo'}
                    </span>
                  </label>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
                  <input type="text" value={shopForm.address} onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Contact Information</label>
                  <input type="text" value={shopForm.contactInformation} onChange={(e) => setShopForm({ ...shopForm, contactInformation: e.target.value })} className="input" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                    <select value={shopForm.status} onChange={(e) => setShopForm({ ...shopForm, status: e.target.value })} className="input">
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Display Order</label>
                    <input type="number" min={0} value={shopForm.displayOrder} onChange={(e) => setShopForm({ ...shopForm, displayOrder: Number(e.target.value) })} className="input" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                <button type="button" onClick={() => { setShowShopModal(false) }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={() => void saveShop()} disabled={savingShop || !shopForm.name || !shopForm.slug} className="btn-gold disabled:opacity-50">
                  {savingShop ? 'Saving...' : editingShop ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reward modal */}
        {showRewardModal && selectedShop && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="font-display text-lg font-semibold text-ink">{editingReward ? 'Edit Reward' : 'Add Reward'} — {selectedShop.name}</h2>
              </div>
              <div className="space-y-4 px-6 py-4">
                {mutationError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{mutationError}</div>}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Reward Name *</label>
                  <input type="text" value={rewardForm.rewardName} onChange={(e) => setRewardForm({ ...rewardForm, rewardName: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                  <textarea value={rewardForm.rewardDescription} onChange={(e) => setRewardForm({ ...rewardForm, rewardDescription: e.target.value })} rows={2} className="input resize-none" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Reward Image</label>
                  {(rewardPreviewUrl || rewardForm.rewardImageUrl) && (
                    <div className="mb-2">
                      <Image src={rewardPreviewUrl || rewardForm.rewardImageUrl} alt="Preview" width={80} height={80} className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200" />
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleRewardImageUpload} className="sr-only" disabled={savingReward} />
                    <span className="text-sm text-gold-600 hover:text-gold-700 font-semibold">
                      {rewardImageFile ? 'Image selected — save to apply' : rewardForm.rewardImageUrl ? 'Change image' : 'Upload image'}
                    </span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Stock Total *</label>
                    <input type="number" min={0} value={rewardForm.stockTotal} onChange={(e) => setRewardForm({ ...rewardForm, stockTotal: Number(e.target.value) })} className="input" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Weight</label>
                    <input type="number" min={0} value={rewardForm.probabilityWeight} onChange={(e) => setRewardForm({ ...rewardForm, probabilityWeight: Number(e.target.value) })} className="input" />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Win Probability % (leave empty for Thank You/remainder)</label>
                  <input type="number" min={0} max={100} step="0.1" value={rewardForm.winningRatio ?? ''} onChange={(e) => setRewardForm({ ...rewardForm, winningRatio: e.target.value === '' ? null : Number(e.target.value) })} className="input" placeholder="e.g. 15" />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={rewardForm.isDefaultRemainder} onChange={(e) => setRewardForm({ ...rewardForm, isDefaultRemainder: e.target.checked })} className="h-4 w-4 rounded border-slate-300 accent-gold" />
                    Default remainder reward (Thank You)
                  </label>
                  <p className="mt-1 text-xs text-slate-400">Check this for the "Thank You" reward that receives leftover probability.</p>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={rewardForm.active} onChange={(e) => setRewardForm({ ...rewardForm, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 accent-gold" />
                    Active
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                <button type="button" onClick={() => { setShowRewardModal(false); setRewardImageFile(null); setRewardPreviewUrl(null) }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={() => void saveReward()} disabled={savingReward || !rewardForm.rewardName} className="btn-gold disabled:opacity-50">
                  {savingReward ? 'Saving...' : editingReward ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}