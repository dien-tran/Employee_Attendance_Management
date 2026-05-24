/**
 * Centralized API Client
 * - Sends HttpOnly Cookie (access_token) automatically via credentials: 'include'
 * - Uses same-origin /api proxy by default so cookies and CORS stay aligned
 * - Set NEXT_PUBLIC_API_URL only when running without the nginx /api proxy
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

// Standard API response wrapper from backend
export interface ApiResponse<T = any> {
  code: number
  message: string
  result: T
}

export interface StreamHandlers {
  onToken: (token: string) => void
  onDone?: () => void
}

function extractErrorMessage(payload: any, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback
  return payload.message || payload.error || payload.detail || fallback
}

function extractTokenFromPayload(payload: any): string {
  if (typeof payload === 'string') return payload
  if (!payload || typeof payload !== 'object') return ''

  if (typeof payload.token === 'string') return payload.token
  if (typeof payload.delta === 'string') return payload.delta
  if (typeof payload.content === 'string') return payload.content
  if (typeof payload.reply === 'string') return payload.reply
  if (typeof payload.text === 'string') return payload.text
  if (typeof payload.result?.reply === 'string') return payload.result.reply
  if (typeof payload.result?.token === 'string') return payload.result.token
  if (typeof payload.result?.delta === 'string') return payload.result.delta
  if (typeof payload.result?.content === 'string') return payload.result.content

  return ''
}

function processStreamLine(
  line: string,
  handlers: StreamHandlers,
  markDone: () => void
): void {
  const trimmed = line.trim()
  if (!trimmed) return
  if (trimmed === '[DONE]') {
    markDone()
    return
  }

  let payload: any = trimmed
  try {
    payload = JSON.parse(trimmed)
  } catch {
    handlers.onToken(trimmed)
    return
  }

  const done = payload?.done === true || payload?.finish_reason === 'stop'
  const token = extractTokenFromPayload(payload)
  if (token) handlers.onToken(token)
  if (done) markDone()
}

/**
 * Fetch-based API client with credentials (HttpOnly Cookie)
 * Sends all requests to API Gateway with credentials: 'include'
 */
export const apiClient = {
  async get<T = any>(path: string): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
      throw new Error(error.message || `Request failed with status ${res.status}`)
    }
    return res.json()
  },

  async post<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
      throw new Error(error.message || `Request failed with status ${res.status}`)
    }
    return res.json()
  },

  async put<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
      throw new Error(error.message || `Request failed with status ${res.status}`)
    }
    return res.json()
  },

  async patch<T = any>(path: string, body?: any): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
      throw new Error(error.message || `Request failed with status ${res.status}`)
    }
    return res.json()
  },

  async delete<T = any>(path: string): Promise<ApiResponse<T>> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: `HTTP ${res.status}` }))
      throw new Error(error.message || `Request failed with status ${res.status}`)
    }
    return res.json()
  },

  async postStream(path: string, body: any, handlers: StreamHandlers): Promise<void> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/x-ndjson, application/json, text/plain',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      let payload: any = null
      payload = await res.json().catch(async () => ({ message: await res.text().catch(() => '') }))
      const fallback = `Request failed with status ${res.status}`
      throw new Error(extractErrorMessage(payload, fallback))
    }

    const contentType = res.headers.get('content-type') || ''
    let doneCalled = false
    const markDone = () => {
      if (doneCalled) return
      doneCalled = true
      handlers.onDone?.()
    }

    if (contentType.includes('application/json')) {
      const payload = await res.json()
      const token = extractTokenFromPayload(payload).trim()
      if (token) handlers.onToken(token)
      markDone()
      return
    }

    if (!res.body) {
      markDone()
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const rawLine of lines) {
        const line = rawLine.trimEnd()
        if (line.startsWith('data:')) {
          processStreamLine(line.slice(5).trim(), handlers, markDone)
          continue
        }
        if (line.startsWith('event:') || line.startsWith(':')) {
          continue
        }
        processStreamLine(line, handlers, markDone)
      }
    }

    const tail = buffer.trim()
    if (tail) {
      if (tail.startsWith('data:')) {
        processStreamLine(tail.slice(5).trim(), handlers, markDone)
      } else {
        processStreamLine(tail, handlers, markDone)
      }
    }

    markDone()
  },
}
