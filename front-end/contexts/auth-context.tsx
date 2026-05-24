"use client"

import React, { createContext, useContext, useEffect } from "react"
import { authService } from "@/services/auth.service"
import { useAuthStore, type AuthUser } from "@/store/authStore"
import { useRouter, usePathname } from "next/navigation"

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string, isAdmin?: boolean) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isHydrated, setUser, clearAuth } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()

  const isLoading = !isHydrated

  const login = async (username: string, password: string, isAdmin?: boolean) => {
    const result = await authService.login({ username, password })

    if (isAdmin && result.role !== "ADMIN") {
      throw new Error("You do not have administrative privileges")
    }

    const authUser: AuthUser = {
      id: result.staffId,
      staffId: result.staffId,
      name: result.name,
      email: username,
      role: result.role,
    }

    setUser(authUser)

    // Redirect based on role
    if (result.role === "ADMIN") {
      router.push("/admin/dashboard")
    } else {
      router.push("/user/home")
    }
  }

  const logout = async () => {
    try {
      await authService.logout()
    } finally {
      clearAuth()

      // Smart Redirect based on current portal layout
      if (pathname.includes("/admin")) {
        router.push("/admin/login")
      } else {
        router.push("/login")
      }
    }
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}