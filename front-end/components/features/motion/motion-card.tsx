"use client"

import { motion, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/lib/utils"
import { forwardRef } from "react"

interface MotionCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode
  className?: string
  hoverScale?: number
  hoverShadow?: boolean
}

export const MotionCard = forwardRef<HTMLDivElement, MotionCardProps>(
  ({ children, className, hoverScale = 1.02, hoverShadow = true, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(
          "rounded-xl border border-border bg-card p-6 text-card-foreground",
          className
        )}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        whileHover={{
          scale: hoverScale,
          boxShadow: hoverShadow
            ? "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
            : undefined,
        }}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)

MotionCard.displayName = "MotionCard"
