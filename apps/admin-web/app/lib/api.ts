export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8787'

export function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}