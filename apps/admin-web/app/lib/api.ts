export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://myanmarbeer.boom.com.mm/api'

export function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}