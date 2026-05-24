"use client"

import { LoginForm } from "@/components/auth/login-form"
import { GuestGuard } from "@/components/auth/auth-redirect"
import { Shield } from "lucide-react"

export default function UserLoginPage() {
  return (
    <GuestGuard>
      <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Employee Login</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to access your attendance workspace
            </p>
          </div>
          <LoginForm isAdmin={false} />
        </div>
      </div>
    </GuestGuard>
  )
}
