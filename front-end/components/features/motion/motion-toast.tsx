"use client"

import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react"

export interface Toast {
  id: string
  title: string
  description?: string
  type?: "success" | "error" | "info"
}

interface MotionToastProps {
  toast: Toast
  onDismiss: (id: string) => void
}

const toastVariants = {
  hidden: { opacity: 0, x: 100, y: 0 },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    x: 100,
    transition: { duration: 0.2 },
  },
}

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

const iconColors = {
  success: "text-success",
  error: "text-destructive",
  info: "text-scanner",
}

export function MotionToast({ toast, onDismiss }: MotionToastProps) {
  const Icon = icons[toast.type || "info"]
  const iconColor = iconColors[toast.type || "info"]

  return (
    <motion.div
      layout
      variants={toastVariants as any}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="pointer-events-auto w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-lg"
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", iconColor)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{toast.title}</p>
          {toast.description && (
            <p className="mt-1 text-sm text-muted-foreground">{toast.description}</p>
          )}
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </button>
      </div>
    </motion.div>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onDismiss: (id: string) => void
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <MotionToast key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
}
