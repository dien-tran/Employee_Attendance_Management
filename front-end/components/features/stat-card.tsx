"use client"

import { motion, useMotionValue, useTransform, animate } from "framer-motion"
import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { type LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: number
  suffix?: string
  prefix?: string
  icon: LucideIcon
  trend?: {
    value: number
    label: string
    positive?: boolean
  }
  className?: string
  accentColor?: "default" | "success" | "scanner" | "destructive"
}

const accentColors = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  scanner: "bg-scanner/10 text-scanner",
  destructive: "bg-destructive/10 text-destructive",
}

export function StatCard({
  title,
  value,
  suffix = "",
  prefix = "",
  icon: Icon,
  trend,
  className,
  accentColor = "default",
}: StatCardProps) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (latest) => Math.round(latest))

  useEffect(() => {
    const controls = animate(count, value, {
      duration: 1,
      ease: [0.25, 0.46, 0.45, 0.94],
    })
    return controls.stop
  }, [count, value])

  return (
    <motion.div
      className={cn(
        "rounded-xl border border-border bg-card p-6",
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ scale: 1.02, boxShadow: "0 10px 40px -15px rgba(0,0,0,0.2)" }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="mt-2 flex items-baseline gap-1">
            {prefix && <span className="text-2xl font-bold text-foreground">{prefix}</span>}
            <motion.span className="text-3xl font-bold text-foreground">
              {rounded}
            </motion.span>
            {suffix && <span className="text-xl font-medium text-muted-foreground">{suffix}</span>}
          </div>
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={cn(
                  "text-xs font-medium",
                  trend.positive ? "text-success" : "text-destructive"
                )}
              >
                {trend.positive ? "+" : ""}{trend.value}%
              </span>
              <span className="text-xs text-muted-foreground">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn("rounded-lg p-2.5", accentColors[accentColor])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  )
}
