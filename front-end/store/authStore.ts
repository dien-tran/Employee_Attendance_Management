/**
 * Zustand Auth Store
 * Quản lý trạng thái đăng nhập toàn cục
 * User info được lưu trong store (không lưu JWT ở localStorage - dùng HttpOnly Cookie)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AuthUser {
  id: string
  staffId: string
  name: string
  email: string
  role: 'ADMIN' | 'USER'
  department?: string
  position?: string
  phone?: string
  image?: string
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isHydrated: boolean

  setUser: (user: AuthUser) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isHydrated: false,

      setUser: (user: AuthUser) =>
        set({
          user,
          isAuthenticated: true,
          isHydrated: true,
        }),

      clearAuth: () =>
        set({
          user: null,
          isAuthenticated: false,
          isHydrated: true,
        }),
    }),
    {
      name: 'attendflow-auth-store',
      // Chỉ persist user info (không lưu token - HttpOnly Cookie)
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      // Hydrate trạng thái từ storage khi app load
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isHydrated = true
        }
      },
    }
  )
)
