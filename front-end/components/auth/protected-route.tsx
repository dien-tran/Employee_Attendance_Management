"use client"

import { useEffect, type ReactNode } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter, usePathname } from "next/navigation"

type AuthRole = "ADMIN" | "USER"

const ADMIN_HOME = "/admin/employees"
const USER_HOME = "/user/home"
const ADMIN_LOGIN = "/admin/login"
const USER_LOGIN = "/login"

interface ProtectedRouteProps {
  children: ReactNode
  role?: AuthRole
}

interface RoleGuardState {
  canRender: boolean
  isLoading: boolean
  redirectPath: string | null
}

function getHomePath(role?: AuthRole | null) {
  return role === "ADMIN" ? ADMIN_HOME : USER_HOME
}

function getLoginPath(pathname: string) {
  return pathname.startsWith("/admin") ? ADMIN_LOGIN : USER_LOGIN
}

function RouteGuardLoading({ message = "Loading application..." }: { message?: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background"
      data-testid="route-guard-loading"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

export function useRoleGuard(requiredRole?: AuthRole): RoleGuardState {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const redirectPath =
    isLoading
      ? null
      : !isAuthenticated
        ? getLoginPath(pathname)
        : requiredRole && user?.role !== requiredRole
          ? getHomePath(user?.role)
          : null

  useEffect(() => {
    if (redirectPath) {
      router.replace(redirectPath)
    }
  }, [redirectPath, router])

  return {
    canRender: !isLoading && isAuthenticated && !redirectPath,
    isLoading,
    redirectPath,
  }
}

export function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { canRender, isLoading, redirectPath } = useRoleGuard(role)

  if (isLoading) {
    return <RouteGuardLoading />
  }

  if (redirectPath) {
    return <RouteGuardLoading message="Redirecting..." />
  }

  if (!canRender) {
    return null
  }

  return <>{children}</>
}

export function AdminGuard({ children }: { children: ReactNode }) {
  return <ProtectedRoute role="ADMIN">{children}</ProtectedRoute>
}

export function UserGuard({ children }: { children: ReactNode }) {
  return <ProtectedRoute role="USER">{children}</ProtectedRoute>
}
