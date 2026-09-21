import { API_BASE } from './config'

/**
 * Cloudflare Turnstile helper.
 *
 * Verification is optional: the server only enforces it when both the site key
 * and the secret are configured. This module asks the API for the public site
 * key, then renders an invisible widget on demand and returns its token. When
 * Turnstile is disabled (or fails to load) the promise resolves to `undefined`
 * and callers simply omit the token.
 */

type TurnstileConfig = { enabled: boolean; siteKey: string | null }

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  execute: (widgetId: string) => void
  remove: (widgetId: string) => void
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let configPromise: Promise<TurnstileConfig> | null = null
let scriptPromise: Promise<void> | null = null

function loadConfig(): Promise<TurnstileConfig> {
  if (!configPromise) {
    configPromise = fetch(`${API_BASE}/public/turnstile`)
      .then((res) => res.json())
      .then((body) => (body?.success ? (body.data as TurnstileConfig) : { enabled: false, siteKey: null }))
      .catch(() => ({ enabled: false, siteKey: null }))
  }
  return configPromise
}

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Turnstile requires a browser'))
      return
    }
    if ((window as unknown as { turnstile?: TurnstileApi }).turnstile) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Turnstile'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * Returns a fresh Turnstile token, or `undefined` when Turnstile is not
 * configured / unavailable (in which case the server does not enforce it).
 */
export async function getTurnstileToken(): Promise<string | undefined> {
  const config = await loadConfig()
  if (!config.enabled || !config.siteKey) return undefined

  try {
    await loadScript()
    const turnstile = (window as unknown as { turnstile?: TurnstileApi }).turnstile
    if (!turnstile) return undefined

    const container = document.createElement('div')
    container.style.display = 'none'
    document.body.appendChild(container)

    return await new Promise<string | undefined>((resolve) => {
      const widget: { id?: string; timeout?: number } = {}
      let settled = false

      const finish = (token: string | undefined) => {
        if (settled) return
        settled = true
        if (widget.timeout !== undefined) window.clearTimeout(widget.timeout)
        try {
          if (widget.id) turnstile.remove(widget.id)
        } catch {
          /* widget already removed */
        }
        container.remove()
        resolve(token)
      }

      widget.id = turnstile.render(container, {
        sitekey: config.siteKey,
        // Invisibility comes from the widget mode configured in the Turnstile
        // dashboard. `appearance: 'interaction-only'` keeps the widget hidden
        // unless a challenge genuinely needs user interaction.
        appearance: 'interaction-only',
        execution: 'execute',
        callback: (token: string) => finish(token),
        'error-callback': () => finish(undefined),
        'timeout-callback': () => finish(undefined),
      })

      widget.timeout = window.setTimeout(() => finish(undefined), 20000)
      turnstile.execute(widget.id)
    })
  } catch {
    return undefined
  }
}
