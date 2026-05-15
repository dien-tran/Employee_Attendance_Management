"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useAuth } from "@/contexts/auth-context"
import { motion } from "framer-motion"

const loginSchema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
})

type LoginValues = z.infer<typeof loginSchema>

interface LoginFormProps {
  isAdmin?: boolean
}

export function LoginForm({ isAdmin = false }: LoginFormProps) {
  const { login } = useAuth()
  const [errorMsg, setErrorMsg] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = async (data: LoginValues) => {
    setErrorMsg("")
    setIsLoading(true)
    try {
      await login(data.email, data.password, isAdmin)
    } catch (error: any) {
      setErrorMsg(error.message || "Invalid credentials")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="login-form-auth">
      {errorMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium border border-destructive/20"
          data-testid="login-error-msg"
        >
          {errorMsg}
        </motion.div>
      )}
      
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Email</label>
        <input
          {...form.register("email")}
          type="email"
          autoComplete="email"
          placeholder={isAdmin ? "admin@company.com" : "user@company.com"}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="login-email-input"
        />
        {form.formState.errors.email && (
          <p className="text-xs text-destructive" data-testid="login-email-error">{form.formState.errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Password</label>
        <input
          {...form.register("password")}
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="login-password-input"
        />
        {form.formState.errors.password && (
          <p className="text-xs text-destructive" data-testid="login-password-error">{form.formState.errors.password.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        data-testid="login-submit-btn"
        className={`inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50
          ${isAdmin ? "bg-foreground text-background hover:bg-foreground/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}
        `}
      >
        {isLoading ? (
          <div className="flex items-center gap-2" data-testid="login-loading-state">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>Signing in...</span>
          </div>
        ) : (
          "Sign In"
        )}
      </button>
    </form>
  )
}
