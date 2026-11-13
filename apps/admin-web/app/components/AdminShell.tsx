'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { API_BASE, adminHeaders, apiErrorMessage, readApiPayload } from '../lib/api'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { href: '/products', label: 'Products', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { href: '/shops', label: 'Shops', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { href: '/surveys', label: 'Surveys', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { href: '/rewards', label: 'Rewards', icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7' },
  { href: '/deliveries', label: 'Deliveries', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
  { href: '/users', label: 'Users', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { href: '/settings', label: 'Account', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/audit', label: 'Audit Log', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
]

const navGroups = [
  { label: 'Main', items: navItems.slice(0, 6) },
  { label: 'Management', items: navItems.slice(6) },
]

function getPageTitle(pathname: string | null) {
  if (!pathname) return 'Myanmar Beer'
  const match = navItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  )
  return match ? match.label : 'Myanmar Beer'
}

type StockAlert = {
  id: string
  name: string
  remaining_quantity: number
  low_stock_threshold: number
}

type ActivityItem = {
  id: string
  action: string
  description: string | null
  created_at: string
}

const ACTIVITY_LABELS: Record<string, string> = {
  LOGIN: 'Signed in',
  LOGOUT: 'Signed out',
  CREATE: 'Created a new item',
  UPDATE: 'Updated information',
  DELETE: 'Deleted an item',
  STOCK_ADJUSTED: 'Adjusted reward stock',
  REWARD_CREATED: 'Created a reward',
  REWARD_UPDATED: 'Updated reward information',
  SHOP_CREATED: 'Created a shop',
  SHOP_UPDATED: 'Updated shop information',
  DELIVERY_STATUS_CHANGED: 'Updated delivery status',
  PASSWORD_CHANGED: 'Changed password',
  STATUS_CHANGED: 'Changed status',
  UPLOAD: 'Uploaded a file',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function extractList<T>(value: unknown, key: string): T[] {
  if (Array.isArray(value)) return value as T[]
  if (isRecord(value) && Array.isArray(value[key])) return value[key] as T[]
  return []
}

function timeAgo(iso: string): string {
  const value = iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z'
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return iso
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

function activityLabel(item: ActivityItem): string {
  const description = item.description?.trim()
  if (description) return description
  return ACTIVITY_LABELS[item.action] ?? item.action
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Notifications popover (fed by the inventory + audit-log endpoints)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifError, setNotifError] = useState('')
  const [alerts, setAlerts] = useState<StockAlert[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [notifLoadedAt, setNotifLoadedAt] = useState(0)
  const notifRef = useRef<HTMLDivElement | null>(null)

  const loadNotifications = useCallback(async () => {
    setNotifLoading(true)
    setNotifError('')
    try {
      const [inventoryResponse, auditResponse] = await Promise.all([
        fetch(`${API_BASE}/admin/rewards/inventory`, { headers: adminHeaders() }),
        fetch(`${API_BASE}/admin/audit-logs?limit=6`, { headers: adminHeaders() }),
      ])
      const inventoryPayload = await readApiPayload(inventoryResponse)
      const auditPayload = await readApiPayload(auditResponse)
      if (!inventoryResponse.ok || !inventoryPayload || inventoryPayload.success !== true) {
        throw new Error(apiErrorMessage(inventoryPayload, 'Failed to load notifications'))
      }
      if (!auditResponse.ok || !auditPayload || auditPayload.success !== true) {
        throw new Error(apiErrorMessage(auditPayload, 'Failed to load notifications'))
      }
      const inventory = isRecord(inventoryPayload.data) ? inventoryPayload.data : {}
      const stockAlerts = extractList<StockAlert>(inventory, 'rewards').filter(
        (reward) => reward.remaining_quantity <= reward.low_stock_threshold
      )
      const audit = isRecord(auditPayload.data) ? auditPayload.data : {}
      setAlerts(stockAlerts)
      setActivity(extractList<ActivityItem>(audit, 'logs'))
      setNotifLoadedAt(Date.now())
    } catch (error) {
      setNotifError(error instanceof Error ? error.message : 'Failed to load notifications')
    } finally {
      setNotifLoading(false)
    }
  }, [])

  const toggleNotifications = () => {
    const next = !notifOpen
    setNotifOpen(next)
    // Refresh on open once data is missing or older than a minute.
    if (next && Date.now() - notifLoadedAt > 60_000) void loadNotifications()
  }

  useEffect(() => {
    if (!notifOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotifOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [notifOpen])

  // Don't show shell on login page
  if (pathname === '/login') {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-surface-canvas">
      {/* Unified topbar (all sizes) */}
      <header className="fixed top-0 right-0 left-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:left-64 lg:px-6">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Toggle navigation"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <h1 className="font-display text-lg font-bold text-ink">{getPageTitle(pathname)}</h1>

        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          <div className="relative hidden sm:block">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search…"
              className="w-56 rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-ink placeholder:text-slate-400 outline-none transition focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold-400/30"
            />
          </div>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={toggleNotifications}
              className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition-colors hover:border-gold hover:text-gold-600"
              aria-label="Notifications"
              aria-haspopup="dialog"
              aria-expanded={notifOpen}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {alerts.length > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                  {alerts.length > 9 ? '9+' : alerts.length}
                </span>
              ) : notifLoadedAt === 0 ? (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-gold ring-2 ring-white" />
              ) : null}
            </button>

            {notifOpen && (
              <div
                role="dialog"
                aria-label="Notifications"
                className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <p className="text-sm font-semibold text-ink">Notifications</p>
                  {alerts.length > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      {alerts.length} low stock
                    </span>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {notifLoading && (
                    <p className="px-4 py-6 text-center text-sm text-slate-500">Loading notifications…</p>
                  )}

                  {!notifLoading && notifError && (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-red-600">{notifError}</p>
                      <button
                        type="button"
                        onClick={() => void loadNotifications()}
                        className="mt-2 text-xs font-semibold text-gold-600 hover:text-gold-700"
                      >
                        Try again
                      </button>
                    </div>
                  )}

                  {!notifLoading && !notifError && (
                    <>
                      {alerts.length === 0 && activity.length === 0 && (
                        <p className="px-4 py-6 text-center text-sm text-slate-500">No new notifications</p>
                      )}

                      {alerts.length > 0 && (
                        <div className="border-b border-slate-100">
                          <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Stock alerts
                          </p>
                          {alerts.map((alert) => (
                            <Link
                              key={alert.id}
                              href="/rewards"
                              role="menuitem"
                              onClick={() => setNotifOpen(false)}
                              className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50"
                            >
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-ink">{alert.name}</span>
                                <span className="block text-xs text-slate-500">
                                  {alert.remaining_quantity} left · threshold {alert.low_stock_threshold}
                                </span>
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}

                      {activity.length > 0 && (
                        <div>
                          <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Recent activity
                          </p>
                          {activity.map((item) => (
                            <Link
                              key={item.id}
                              href="/audit"
                              role="menuitem"
                              onClick={() => setNotifOpen(false)}
                              className="block px-4 py-2.5 transition-colors hover:bg-slate-50"
                            >
                              <span className="block truncate text-sm text-ink">{activityLabel(item)}</span>
                              <span className="block text-xs text-slate-400">{timeAgo(item.created_at)}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="border-t border-slate-100 px-4 py-2.5 text-right">
                  <Link
                    href="/audit"
                    onClick={() => setNotifOpen(false)}
                    className="text-xs font-semibold text-gold-600 hover:text-gold-700"
                  >
                    View audit log
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link
            href="/settings"
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-2 ring-gold/70 transition-opacity hover:opacity-80"
            aria-label="Account settings"
          >
            <Image src="/myanmarbeerstout.png" alt="Admin" width={36} height={36} className="h-full w-full object-cover bg-white/10" />
          </Link>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-navy transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 pb-5 pt-6">
          <div className="relative shrink-0">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-2 ring-gold ring-offset-2 ring-offset-navy">
              <Image src="/myanmarbeerstout.png" alt="Myanmar Beer" width={44} height={44} className="h-full w-full object-cover" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-navy bg-gold" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-[15px] font-bold leading-tight text-white">Myanmar Beer</h1>
            <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-warm">Admin Panel</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
                        isActive
                          ? 'bg-gold/10 text-white'
                          : 'text-slate-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-gold" />
                      )}
                      <svg
                        className={`h-5 w-5 ${isActive ? 'text-gold' : 'text-slate-500 group-hover:text-white'}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                      </svg>
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer profile card */}
        <div className="mx-3 mb-4 rounded-xl border border-white/10 bg-navy-dark p-3">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/10 ring-2 ring-gold/70">
                <span className="text-sm font-semibold text-warm">A</span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-navy-dark bg-success" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">Admin</p>
              <p className="truncate text-xs text-slate-400">admin@myanmarbeer.com</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Signed in
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-h-screen pt-16 lg:pl-64">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}