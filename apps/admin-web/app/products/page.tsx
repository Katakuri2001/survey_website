'use client'

import { useState, useEffect, useCallback } from 'react'

const API_BASE = 'http://localhost:8787'

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
        <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-200 rounded-lg" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-48" />
          </div>
          <div className="h-6 w-16 bg-gray-200 rounded-full" />
          <div className="h-8 w-20 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100 text-center">
      <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">No products yet</h3>
      <p className="text-sm text-gray-500 mb-6">Get started by adding your first product to the survey platform.</p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Product
      </button>
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
      <p className="text-sm font-medium text-gray-900 mb-1">Failed to load products</p>
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

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-indigo-600' : 'bg-gray-200'
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
  const [error, setError] = useState('')

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
    } catch (err: any) {
      setError(err.message || 'Failed to save product')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Product' : 'Add Product'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">English Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => {
                updateField('name', e.target.value)
                updateTranslation('en', 'name', e.target.value)
              }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="e.g. Myanmar Beer Original"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">English Description</label>
            <textarea
              value={form.translations.en?.description || ''}
              onChange={e => updateTranslation('en', 'description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="Brief description of the product"
            />
          </div>

          <div className="border border-gray-100 rounded-lg p-4 bg-gray-50/50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Myanmar Translation</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.translations.my?.name || ''}
                  onChange={e => updateTranslation('my', 'name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                  placeholder="Product name in Myanmar"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.translations.my?.description || ''}
                  onChange={e => updateTranslation('my', 'description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                  placeholder="Description in Myanmar"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <input
                type="text"
                value={form.brand}
                onChange={e => updateField('brand', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="e.g. Myanmar Beer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={e => updateField('displayOrder', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
            <input
              type="text"
              value={form.imageUrl}
              onChange={e => updateField('imageUrl', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {saving && (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
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
  const [saving, setSaving] = useState(false)

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
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-500 mt-1">Manage products available in the survey</p>
        </div>
        {!loading && products.length > 0 && (
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 w-8">#</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Product</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Brand</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">Responses</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">Active</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((product, index) => (
                  <tr
                    key={product.id}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="py-3 px-4 text-gray-400 font-medium">{index + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-10 h-10 rounded-lg object-cover bg-gray-100"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{product.name}</p>
                          {product.description && (
                            <p className="text-xs text-gray-400 truncate max-w-[240px]">{product.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{product.brand || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                        {product.response_count.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center">
                        <Toggle
                          checked={product.is_active}
                          onChange={() => handleToggleActive(product)}
                          disabled={togglingId === product.id}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Edit product"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
