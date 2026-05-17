"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

const ADMIN_HOME = "/admin/employees"
const USER_HOME = "/user/home"
const USER_LOGIN = "/login"

function getHomePath(role?: "ADMIN" | "USER") {
  return role === "ADMIN" ? ADMIN_HOME : USER_HOME
}

function AuthRedirectLoading() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background"
      data-testid="auth-redirect-loading"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading application...</p>
      </div>
    </div>
  )
}

export function GuestGuard({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(getHomePath(user?.role))
    }
  }, [isAuthenticated, isLoading, router, user?.role])

  if (isLoading || isAuthenticated) {
    return <AuthRedirectLoading />
  }

  return <>{children}</>
}

export function RootRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      router.replace(isAuthenticated ? getHomePath(user?.role) : USER_LOGIN)
    }
  }, [isAuthenticated, isLoading, router, user?.role])

  return <AuthRedirectLoading />
}
