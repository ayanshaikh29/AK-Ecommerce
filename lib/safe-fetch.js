/**
 * Enterprise Safe Data Fetching Utilities
 * Prevents uncaught exceptions, network crashes, timeouts, and JSON parse errors.
 */

export async function safeFetch(url, options = {}) {
  const { timeout = 12000, headers = {}, ...rest } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(url, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    let data = null
    const contentType = res.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      try {
        data = await res.json()
      } catch (e) {
        data = null
      }
    } else {
      try {
        data = await res.text()
      } catch (e) {
        data = null
      }
    }

    if (!res.ok) {
      const errorMessage =
        (data && typeof data === 'object' && (data.error || data.message)) ||
        `HTTP Error ${res.status}: ${res.statusText}`

      return {
        ok: false,
        status: res.status,
        data: null,
        error: errorMessage
      }
    }

    return {
      ok: true,
      status: res.status,
      data,
      error: null
    }
  } catch (err) {
    clearTimeout(timeoutId)
    const isTimeout = err.name === 'AbortError'
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine

    const errorMessage = isTimeout
      ? 'Request timed out. Please check your internet connection.'
      : isOffline
      ? 'Network connection offline. Please reconnect to the internet.'
      : err.message || 'An unexpected network failure occurred.'

    return {
      ok: false,
      status: 0,
      data: null,
      error: errorMessage
    }
  }
}

export async function safeSupabaseCall(queryFn, fallbackValue = null) {
  try {
    const result = await queryFn()
    if (result && result.error) {
      console.warn('[Supabase Safe Query Note]:', result.error.message)
      return { data: fallbackValue, error: result.error.message, ok: false }
    }
    return { data: result?.data ?? fallbackValue, error: null, ok: true }
  } catch (err) {
    console.error('[Supabase Safe Exception]:', err)
    return { data: fallbackValue, error: err.message || 'Database operation failed', ok: false }
  }
}
