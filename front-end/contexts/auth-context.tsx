"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { authService, type UserInfo, type AuthResponse } from "@/lib/auth-service"
import { useRouter, usePathname } from "next/navigation"

interface AuthContextType {
  user: UserInfo | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (data: AuthResponse, rememberMe: boolean) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // Hydrate auth state from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("attendflow_access_token")
    const storedUser = localStorage.getItem("attendflow_user")

    if (storedToken && storedUser) {
      try {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
      } catch (error) {
        console.error("Failed to parse stored user info", error)
        localStorage.removeItem("attendflow_access_token")
        localStorage.removeItem("attendflow_user")
      }
    }
    setIsLoading(false)
  }, [])

  const login = (data: AuthResponse, rememberMe: boolean) => {
    setToken(data.access_token)
    setUser(data.user_info)

    // Using localStorage for simplicity and persistence, irrespective of 'rememberMe' for standard Next.js prototype. 
    // Usually, rememberMe==false implies sessionStorage.
    if (rememberMe) {
      localStorage.setItem("attendflow_access_token", data.access_token)
      localStorage.setItem("attendflow_user", JSON.stringify(data.user_info))
    } else {
      sessionStorage.setItem("attendflow_access_token", data.access_token)
      sessionStorage.setItem("attendflow_user", JSON.stringify(data.user_info))
    }
  }

  const logout = async () => {
    try {
      await authService.logout()
    } finally {
      localStorage.removeItem("attendflow_access_token")
      localStorage.removeItem("attendflow_user")
      sessionStorage.removeItem("attendflow_access_token")
      sessionStorage.removeItem("attendflow_user")
      setToken(null)
      setUser(null)
      
      // Smart Redirect based on current portal layout
      if (pathname.includes("/admin")) {
        router.push("/admin/login")
      } else {
        router.push("/login")
      }
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user, isLoading, login, logout }}>
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
