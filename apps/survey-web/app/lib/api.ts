import { API_BASE } from './config'

export { API_BASE }

export const RESUME_TOKEN_KEY = 'survey_resume_token'
export const AUTH_RECOVERY_KEY = 'survey_auth_recovery'

// Keys must match what `guestSchema` accepts (`stateCode`, not `nrcState`) —
// `/info` writes this shape, and mismatches silently drop the NRC fields.
export interface Profile {
  fullName: string
  phone: string
  dob: string
  stateCode?: string
  /** Legacy profile key accepted only as a read fallback. */
  nrcState?: string
  nrcTownship?: string
  nrcType?: string
  nrcNumber?: string
}

export interface GuestResponseData {
  token?: unknown
  user?: unknown
  resumeToken?: unknown
}

type ApiEnvelope = {
  success?: boolean
  data?: GuestResponseData | null
  error?: { code?: string; message?: string } | null
}

function storage(kind: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    // Private browsing and embedded WebViews can expose storage but throw on
    // access. Authentication should still be able to fail gracefully.
    return null
  }
}

function readStorage(kind: 'local' | 'session', key: string): string | null {
  try {
    return storage(kind)?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeStorage(kind: 'local' | 'session', key: string, value: string): boolean {
  try {
    storage(kind)?.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function removeStorage(kind: 'local' | 'session', key: string): void {
  try {
    storage(kind)?.removeItem(key)
  } catch {
    // Ignore unavailable storage; the in-memory state still controls this tab.
  }
}

function normalizeAsciiDigits(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const digits = '၀၁၂၃၄၅၆၇၈၉'
  return value
    .split('')
    .map(character => {
      const index = digits.indexOf(character)
      return index >= 0 ? String(index) : character
    })
    .join('')
    .trim()
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
  if (typeof claims.exp === 'number' && claims.exp <= Math.floor(Date.now() / 1000)) return false
  return true
}

export function getResumeToken(): string | null {
  return readStorage('local', RESUME_TOKEN_KEY)
}

/** Persist the token returned by the guest endpoint for a later refresh. */
export function storeResumeToken(token: unknown): void {
  if (typeof token === 'string' && token.trim()) {
    writeStorage('local', RESUME_TOKEN_KEY, token)
  } else {
    // Never keep a token that the API did not confirm for this identity.
    removeStorage('local', RESUME_TOKEN_KEY)
  }
}

export function storeGuestSession(data: GuestResponseData | null | undefined): boolean {
  if (!data || typeof data.token !== 'string' || !data.token) return false
  writeStorage('local', 'survey_token', data.token)
  if (data.user !== undefined) {
    try {
      writeStorage('local', 'survey_user', JSON.stringify(data.user))
    } catch {
      // The user object is only a convenience cache; auth still works without it.
    }
  }
  storeResumeToken(data.resumeToken)
  return true
}

export function storeGuestProfile(profile: Profile): void {
  try {
    writeStorage('local', 'survey_profile', JSON.stringify(profile))
  } catch {
    // A full/disabled storage backend must not prevent the form from submitting.
  }
}

let resumeRecoveryPending = false

/** Mark a session that must be re-established from the personal-info form. */
export function markResumeTokenRecovery(): void {
  resumeRecoveryPending = true
  writeStorage('session', AUTH_RECOVERY_KEY, 'RESUME_TOKEN_REQUIRED')
}

/** Read and consume the recovery notice once a page has mounted. */
export function consumeResumeTokenRecovery(): boolean {
  const stored = readStorage('session', AUTH_RECOVERY_KEY) === 'RESUME_TOKEN_REQUIRED'
  const pending = stored || resumeRecoveryPending
  resumeRecoveryPending = false
  removeStorage('session', AUTH_RECOVERY_KEY)
  return pending
}

const LOCAL_IDENTITY_KEYS = ['survey_token', 'survey_user', 'survey_profile', RESUME_TOKEN_KEY]
// Keep the in-progress survey answers/current question. They are local progress,
// not an authenticated server session, and are useful after re-authentication.
const SESSION_IDENTITY_KEYS = [
  'survey_submitting',
  'survey_submission_request_id',
  'survey_response_id',
  'survey_campaign_id',
  'survey_product_id',
  'spin_idempotency_key',
  'pending_reward_id',
  'pending_user_reward_id',
  'pending_reward',
  'user_reward_id',
  'reward_name',
]

/**
 * Clear data that can be attributed to a stale identity after the API rejects a
 * resume token. Survey progress is deliberately retained so a user can recover
 * without retyping answers.
 */
export function clearIdentitySession(): void {
  LOCAL_IDENTITY_KEYS.forEach(key => removeStorage('local', key))
  SESSION_IDENTITY_KEYS.forEach(key => removeStorage('session', key))
}

let refreshPromise: Promise<string | null> | null = null

async function refreshGuestToken(): Promise<string | null> {
  const rawProfile = readStorage('local', 'survey_profile')
  let profile: Profile | null = null
  try {
    profile = rawProfile ? (JSON.parse(rawProfile) as Profile) : null
  } catch {
    profile = null
  }

  if (!profile?.phone || !profile.dob) return null

  const resumeToken = getResumeToken()
  const body: Record<string, unknown> = {
    fullName: profile.fullName,
    phone: profile.phone,
    dob: profile.dob,
    stateCode: normalizeAsciiDigits(profile.stateCode || profile.nrcState),
    nrcTownship: typeof profile.nrcTownship === 'string' ? profile.nrcTownship.trim().toUpperCase() : undefined,
    nrcType: typeof profile.nrcType === 'string' ? profile.nrcType.trim().toUpperCase() : undefined,
    nrcNumber: normalizeAsciiDigits(profile.nrcNumber),
  }
  if (resumeToken) body.resumeToken = resumeToken

  try {
    const res = await fetch(`${API_BASE}/users/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => null)) as ApiEnvelope | null
    const errorCode = data?.error?.code

    if (errorCode === 'RESUME_TOKEN_REQUIRED') {
      markResumeTokenRecovery()
      clearIdentitySession()
      return null
    }

    if (data?.success && storeGuestSession(data.data)) {
      return (data.data as { token: string }).token
    }
  } catch {
    // A failed refresh is reported to the caller as no usable token.
  }

  return null
}

// Returns a usable survey_token, refreshing it from the stored profile when it
// is missing or expired. Guards against the API's "Invalid token" failure that
// surfaces only on auth-protected steps (spin, delivery).
export async function getValidToken(forceRefresh = false): Promise<string | null> {
  const token = readStorage('local', 'survey_token')
  if (!forceRefresh && isTokenValid(token)) return token

  if (typeof window === 'undefined') return null
  if (refreshPromise) return refreshPromise

  refreshPromise = refreshGuestToken().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

export function surveyHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = readStorage('local', 'survey_token')
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

// ============================================================
// Multi-shop reward system helpers (v1)
// ============================================================

export interface Shop {
  id: string
  name: string
  slug: string
  description?: string | null
  logoUrl?: string | null
  address?: string | null
  contactInformation?: string | null
  status: string
  displayOrder?: number
  createdAt?: string
}

export interface RewardResult {
  hasReward: boolean
  reward: {
    winId: string
    rewardName: string
    shopId: string | null
    shopRewardId: string | null
    rewardImageUrl: string | null
    assignedAt: string
  } | null
  session?: {
    sessionId: string
    status: string
    selectedShopId: string | null
  }
}

export async function fetchShops(language: string = 'my'): Promise<Shop[]> {
  try {
    const res = await fetch(`${API_BASE}/v1/shops?lang=${language}`)
    const data = await res.json().catch(() => null)
    if (data?.success && Array.isArray(data.data?.shops)) {
      return data.data.shops
    }
    return []
  } catch {
    return []
  }
}

export async function selectShopForSession(sessionId: string, shopId: string): Promise<{ success: boolean; error?: string }> {
  const token = readStorage('local', 'survey_token')
  try {
    const res = await fetch(`${API_BASE}/v1/survey/sessions/${sessionId}/select-shop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ shopId }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.success) return { success: true }
    return { success: false, error: data?.error?.message || 'Failed to select shop' }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Connection error' }
  }
}

export async function getSessionStatus(sessionId: string): Promise<{
  status: string
  selectedShopId: string | null
  nextAction: string
  existingReward: { winId: string; rewardName: string; shopId: string | null } | null
} | null> {
  const token = readStorage('local', 'survey_token')
  try {
    const res = await fetch(`${API_BASE}/v1/survey/sessions/${sessionId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.success && data.data) {
      return {
        status: data.data.status,
        selectedShopId: data.data.selectedShopId,
        nextAction: data.data.nextAction,
        existingReward: data.data.existingReward,
      }
    }
    return null
  } catch {
    return null
  }
}

export async function allocateReward(
  sessionId: string,
  idempotencyKey: string,
  selectedCardId?: string,
): Promise<{ kind: string; rewardName?: string; rewardImageUrl?: string; shopId?: string; winId?: string; error?: string }> {
  const token = readStorage('local', 'survey_token')
  try {
    const res = await fetch(`${API_BASE}/v1/rewards/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ sessionId, selectedCardId, idempotencyKey }),
    })
    const data = await res.json().catch(() => null)
    if (data?.success && data.data) {
      return {
        kind: data.data.kind,
        rewardName: data.data.rewardName,
        rewardImageUrl: data.data.rewardImageUrl,
        shopId: data.data.shopId,
        winId: data.data.rewardWinId || data.data.winId,
      }
    }
    if (data?.error) {
      return { kind: 'ERROR', error: data.error.message || 'Allocation failed' }
    }
    return { kind: 'ERROR', error: 'Unknown error' }
  } catch (err) {
    return { kind: 'ERROR', error: err instanceof Error ? err.message : 'Connection error' }
  }
}

export async function fetchRewardResult(sessionId: string): Promise<RewardResult | null> {
  const token = readStorage('local', 'survey_token')
  try {
    const res = await fetch(`${API_BASE}/v1/rewards/result/${sessionId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    const data = await res.json().catch(() => null)
    if (res.ok && data?.success && data.data) {
      return data.data as RewardResult
    }
    return null
  } catch {
    return null
  }
}
