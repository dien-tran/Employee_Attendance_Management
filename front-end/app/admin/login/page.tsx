"use client"

import { LoginForm } from "@/components/auth/login-form"
import { GuestGuard } from "@/components/auth/auth-redirect"
import { LockKeyhole } from "lucide-react"

export default function AdminLoginPage() {
  return (
    <GuestGuard>
      <div className="flex min-h-screen flex-col items-center justify-center bg-foreground p-4">
        <div className="w-full max-w-sm rounded-xl border border-border/10 bg-background p-8 shadow-2xl">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-foreground/10">
              <LockKeyhole className="h-6 w-6 text-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Admin Portal</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Secure login for administrative access
            </p>
          </div>
          <LoginForm isAdmin={true} />
        </div>
      </div>
    </GuestGuard>
  )
}
