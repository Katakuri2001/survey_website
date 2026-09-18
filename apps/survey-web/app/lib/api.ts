export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://myanmarbeer.com.mm/api'

interface Profile {
  fullName: string
  phone: string
  dob: string
  nrcState?: string
  nrcType?: string
  nrcNumber?: string
}

function decodeClaims(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function isTokenValid(token: string | null | undefined): token is string {
  if (!token) return false
  const claims = decodeClaims(token)
  if (!claims?.sub) return false
  if (typeof claims.exp === 'number' && claims.exp < Math.floor(Date.now() / 1000)) return false
  return true
}

// Returns a usable survey_token, refreshing it from the stored profile when it
// is missing or expired. Guards against the API's "Invalid token" failure that
// surfaces only on auth-protected steps (spin, delivery).
export async function getValidToken(forceRefresh = false): Promise<string | null> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('survey_token') : null
  if (!forceRefresh && isTokenValid(token)) return token

  if (typeof window === 'undefined') return null

  let profile: Profile | null = null
  try {
    profile = JSON.parse(localStorage.getItem('survey_profile') || 'null')
  } catch { /* no profile */ }

  if (!profile?.phone || !profile.dob) return null

  try {
    const res = await fetch(`${API_BASE}/users/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: profile.fullName,
        phone: profile.phone,
        dob: profile.dob,
        nrcState: profile.nrcState,
        nrcType: profile.nrcType,
        nrcNumber: profile.nrcNumber,
      }),
    })
    const data = await res.json()
    if (data.success && data.data?.token) {
      localStorage.setItem('survey_token', data.data.token)
      localStorage.setItem('survey_user', JSON.stringify(data.data.user))
      return data.data.token
    }
  } catch { /* refresh failed */ }

  return null
}

export function surveyHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('survey_token') : null
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}