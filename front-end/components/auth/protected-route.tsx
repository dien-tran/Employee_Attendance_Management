"use client"

import { useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter, usePathname } from "next/navigation"

interface ProtectedRouteProps {
  children: React.ReactNode
  role?: "ADMIN" | "USER"
}

export function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        if (pathname.startsWith("/admin")) {
          router.push("/admin/login")
        } else {
          router.push("/login")
        }
      } else if (role && user?.role !== role) {
        // Logged in but wrong role
        if (user?.role === "ADMIN") {
          router.push("/admin/dashboard")
        } else {
          router.push("/user/home")
        }
      }
    }
  }, [isAuthenticated, isLoading, user, router, role, pathname])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading application...</p>
        </div>
      </div>
    )
  }

  // Double check before rendering, to avoid flashes of content
  if (!isAuthenticated || (role && user?.role !== role)) {
    return null
  }

  return <>{children}</>
}
