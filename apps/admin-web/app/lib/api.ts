export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://myanmarbeer.boom.com.mm/api'
type ApiEnvelope = {
  success?: boolean
  message?: string
  error?: { message?: string } | string
  data?: unknown
  url?: string
}

/** Return the server's actionable error message without hiding a successful response. */
export function apiErrorMessage(payload: unknown, fallback = 'Request failed'): string {
  if (payload && typeof payload === 'object') {
    const envelope = payload as ApiEnvelope
    if (typeof envelope.message === 'string' && envelope.message.trim()) return envelope.message
    const error = envelope.error
    if (typeof error === 'string' && error.trim()) return error
    if (typeof error !== 'string' && error && typeof error.message === 'string' && error.message.trim()) {
      return error.message
    }
  }
  return fallback
}

/**
 * Parse the API's `{ success, data, error }` envelope and reject non-success
 * responses. The caller must still decide what data to render after an error;
 * this helper only prevents HTTP/API failures from being mistaken for success.
 */
export async function readApiData<T>(response: Response, fallback = 'Request failed'): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope | null
  if (!response.ok || !payload || payload.success !== true) {
    throw new Error(apiErrorMessage(payload, fallback))
  }
  return (payload.data ?? payload) as T
}

/** Read a response without throwing; useful for optional resources. */
export async function readApiPayload(response: Response): Promise<ApiEnvelope | null> {
  return (await response.json().catch(() => null)) as ApiEnvelope | null
}


export function adminHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}