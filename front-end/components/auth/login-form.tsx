"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useAuth } from "@/contexts/auth-context"
import { authService } from "@/lib/auth-service"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().default(false),
})

type LoginValues = z.infer<typeof loginSchema>

interface LoginFormProps {
  isAdmin?: boolean
}

export function LoginForm({ isAdmin = false }: LoginFormProps) {
  const { login } = useAuth()
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
    },
  })

  const onSubmit = async (data: LoginValues) => {
    setErrorMsg("")
    setIsLoading(true)
    try {
      const response = await authService.login(data.username, data.password)
      
      if (isAdmin && response.role !== "ADMIN") {
        throw new Error("You do not have administrative privileges")
      }
      
      login(response, data.rememberMe)
      
      if (response.role === "ADMIN") {
        router.push("/admin/dashboard")
      } else {
        router.push("/user/home")
      }
    } catch (error: any) {
      setErrorMsg(error.message || "Invalid credentials")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {errorMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-md bg-destructive/15 p-3 text-sm text-destructive font-medium border border-destructive/20"
        >
          {errorMsg}
        </motion.div>
      )}
      
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Username</label>
        <input
          {...form.register("username")}
          type="text"
          placeholder={isAdmin ? "admin" : "user"}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        {form.formState.errors.username && (
          <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Password</label>
        <input
          {...form.register("password")}
          type="password"
          placeholder="••••••••"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        {form.formState.errors.password && (
          <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <input 
          type="checkbox" 
          id="rememberMe" 
          {...form.register("rememberMe")} 
          className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-ring ring-offset-background"
        />
        <label htmlFor="rememberMe" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground">
          Remember me
        </label>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className={`inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50
          ${isAdmin ? "bg-foreground text-background hover:bg-foreground/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}
        `}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
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
