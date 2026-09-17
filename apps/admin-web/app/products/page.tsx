'use client'

import { useState, useEffect, useCallback } from 'react'

import { API_BASE } from '../lib/api'

interface ProductTranslation {
  name: string
  description: string
}

interface Product {
  id: string
  name: string
  description: string
  brand: string
  image_url: string
  display_order: number
  is_active: boolean
  response_count: number
  translations?: Record<string, ProductTranslation>
}

interface ProductFormData {
  name: string
  description: string
  brand: string
  imageUrl: string
  displayOrder: number
  translations: Record<string, ProductTranslation>
}

const emptyForm: ProductFormData = {
  name: '',
  description: '',
  brand: '',
  imageUrl: '',
  displayOrder: 0,
  translations: {
    en: { name: '', description: '' },
    my: { name: '', description: '' },
  },
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="card flex items-center gap-4 p-4">
          <div className="h-12 w-12 rounded-lg bg-slate-200" />
          <div className="flex-1">
            <div className="h-4 rounded w-32 bg-slate-200 mb-2" />
            <div className="h-3 rounded w-48 bg-slate-100" />
          </div>
          <div className="h-6 w-16 rounded-full bg-slate-200" />
          <div className="h-8 w-20 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card animate-fade-up p-12 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/10">
        <svg className="h-8 w-8 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
      <h3 className="font-display mb-1 text-lg font-semibold text-ink">No products yet</h3>
      <p className="mb-6 text-sm text-slate-500">Get started by adding your first product to the survey platform.</p>
      <button onClick={onAdd} className="btn-gold shadow-gold">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Product
      </button>
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
      <p className="mb-1 text-sm font-medium text-ink">Failed to load products</p>
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

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-gold' : 'bg-slate-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function ProductModal({
  product,
  onSave,
  onClose,
}: {
  product: Product | null
  onSave: (data: ProductFormData) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<ProductFormData>(() => {
    if (product) {
      return {
        name: product.name,
        description: product.description || '',
        brand: product.brand || '',
        imageUrl: product.image_url || '',
        displayOrder: product.display_order,
        translations: {
          en: product.translations?.en || { name: product.name, description: product.description || '' },
          my: product.translations?.my || { name: '', description: '' },
        },
      }
    }
    return { ...emptyForm }
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const isEditing = !!product

  function updateField(field: keyof ProductFormData, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function updateTranslation(lang: string, field: keyof ProductTranslation, value: string) {
    setForm(prev => ({
      ...prev,
      translations: {
        ...prev.translations,
        [lang]: { ...prev.translations[lang], [field]: value },
      },
    }))
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed')
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      setError('File too large. Maximum size is 5MB')
      return
    }

    setUploading(true)
    setError('')

    try {
      // Create preview
      const preview = URL.createObjectURL(file)
      setPreviewUrl(preview)

      // Upload to server
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'product')
      if (isEditing) {
        formData.append('entityId', product.id)
      }

      const token = localStorage.getItem('admin_token')
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE}/admin/upload`, { method: 'POST', headers, body: formData })
      const data = await res.json()

      if (data.success) {
        updateField('imageUrl', data.url)
        setError('')
      } else {
        setError(data.message || 'Failed to upload image')
        setPreviewUrl(null)
      }
    } catch {
      setError('Could not connect to the server')
      setPreviewUrl(null)
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Product name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  const displayImage = previewUrl || form.imageUrl

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-ink">
            {isEditing ? 'Edit Product' : 'Add Product'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-4">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">English Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => {
                updateField('name', e.target.value)
                updateTranslation('en', 'name', e.target.value)
              }}
              className="input"
              placeholder="e.g. Myanmar Beer Original"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">English Description</label>
            <textarea
              value={form.translations.en?.description || ''}
              onChange={e => updateTranslation('en', 'description', e.target.value)}
              rows={2}
              className="input resize-none"
              placeholder="Brief description of the product"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Myanmar Translation</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                <input
                  type="text"
                  value={form.translations.my?.name || ''}
                  onChange={e => updateTranslation('my', 'name', e.target.value)}
                  className="input bg-white"
                  placeholder="Product name in Myanmar"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <input
                  type="text"
                  value={form.translations.my?.description || ''}
                  onChange={e => updateTranslation('my', 'description', e.target.value)}
                  className="input bg-white"
                  placeholder="Description in Myanmar"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Brand</label>
              <input
                type="text"
                value={form.brand}
                onChange={e => updateField('brand', e.target.value)}
                className="input"
                placeholder="e.g. Myanmar Beer"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Display Order</label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={e => updateField('displayOrder', parseInt(e.target.value) || 0)}
                className="input"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Product Image</label>
            <div className="space-y-3">
              {displayImage && (
                <div className="relative w-full max-w-xs">
                  <img
                    src={displayImage}
                    alt="Product preview"
                    className="w-full h-48 object-cover rounded-lg border border-slate-200"
                  />
                  {previewUrl && (
                    <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">Preview</span>
                  )}
                </div>
              )}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageUpload}
                  className="sr-only"
                  disabled={uploading || saving}
                />
                <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  displayImage ? 'border-slate-300 bg-slate-50' : 'border-gold/50 bg-gold/5'
                }`}>
                  <svg className="mx-auto h-10 w-10 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {displayImage ? 'Click to change image' : 'Click to upload image'}
                  </p>
                  <p className="text-xs text-slate-500">JPEG, PNG, WebP, GIF up to 5MB</p>
                  {uploading && <p className="mt-2 text-sm text-gold-600">Uploading...</p>}
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pb-1 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-gold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isEditing ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('admin_token')
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${API_BASE}/admin/products`, { headers })
      const data = await res.json()
      if (data.success) {
        setProducts(data.data || [])
      } else {
        setError(data.message || 'Failed to load products')
      }
    } catch {
      setError('Could not connect to the server')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProducts()
  }, [fetchProducts])

  async function handleToggleActive(product: Product) {
    setTogglingId(product.id)
    try {
      const token = localStorage.getItem('admin_token')
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }
      const res = await fetch(`${API_BASE}/admin/products/${product.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isActive: !product.is_active }),
      })
      const data = await res.json()
      if (data.success) {
        setProducts(prev =>
          prev.map(p => (p.id === product.id ? { ...p, is_active: !p.is_active } : p))
        )
      }
    } catch {
      // silent
    } finally {
      setTogglingId(null)
    }
  }

  async function handleSaveProduct(formData: ProductFormData) {
    const token = localStorage.getItem('admin_token')
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }

    if (editingProduct) {
      const res = await fetch(`${API_BASE}/admin/products/${editingProduct.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to update product')
    } else {
      const res = await fetch(`${API_BASE}/admin/products`, {
        method: 'POST',
        headers,
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Failed to create product')
    }
    await fetchProducts()
  }

  function openAddModal() {
    setEditingProduct(null)
    setShowModal(true)
  }

  function openEditModal(product: Product) {
    setEditingProduct(product)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingProduct(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Products</h1>
          <p className="mt-1 text-sm text-slate-500">Manage products available in the survey</p>
        </div>
        {!loading && products.length > 0 && (
          <button onClick={openAddModal} className="btn-gold shadow-gold">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </button>
        )}
      </div>

      {loading && <LoadingSkeleton />}

      {!loading && error && <ErrorState message={error} onRetry={fetchProducts} />}

      {!loading && !error && products.length === 0 && <EmptyState onAdd={openAddModal} />}

      {!loading && !error && products.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="w-8 px-4 py-3 text-left font-medium text-slate-500">#</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Product</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Brand</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">Responses</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">Active</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((product, index) => (
                  <tr
                    key={product.id}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3 font-medium text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.image_url ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-10 w-10 rounded-lg bg-slate-100 object-cover ring-1 ring-slate-200"
                            />
                          </>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold/10">
                            <svg className="h-5 w-5 text-gold-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{product.name}</p>
                          {product.description && (
                            <p className="max-w-[240px] truncate text-xs text-slate-400">{product.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{product.brand || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-semibold text-gold-600 ring-1 ring-inset ring-gold-200">
                        {product.response_count.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <Toggle
                          checked={product.is_active}
                          onChange={() => handleToggleActive(product)}
                          disabled={togglingId === product.id}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(product)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-gold/10 hover:text-gold-600"
                          title="Edit product"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <ProductModal
          product={editingProduct}
          onSave={handleSaveProduct}
          onClose={closeModal}
        />
      )}
    </div>
  )
}