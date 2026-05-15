/**
 * Centralized API Client
 * - Sends HttpOnly Cookie (access_token) automatically via withCredentials
 * - All requests go through API Gateway: http://localhost:8080
 * - Supports both Axios and native Fetch
 */

// API Gateway base URL for Docker internal network
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://api-gateway:8080'

// Standard API response wrapper from backend
export interface ApiResponse<T = any> {
  code: number
  message: string
  result: T
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
}