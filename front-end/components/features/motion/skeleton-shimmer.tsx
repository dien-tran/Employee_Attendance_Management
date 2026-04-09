"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface SkeletonShimmerProps {
  className?: string
  variant?: "text" | "circular" | "rectangular"
  width?: string | number
  height?: string | number
}

export function SkeletonShimmer({
  className,
  variant = "rectangular",
  width,
  height,
}: SkeletonShimmerProps) {
  const baseClasses = cn(
    "relative overflow-hidden bg-muted",
    variant === "circular" && "rounded-full",
    variant === "text" && "rounded h-4",
    variant === "rectangular" && "rounded-lg",
    className
  )

  return (
    <div
      className={baseClasses}
      style={{
        width: width ?? "100%",
        height: height ?? (variant === "text" ? 16 : 100),
      }}
    >
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent"
        animate={{
          translateX: ["var(--tw-translate-x)", "100%"],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear",
        }}
      />
    </div>
  )
}

// Skeleton for common layouts
export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <SkeletonShimmer variant="text" width="60%" />
      <SkeletonShimmer variant="text" width="80%" />
      <SkeletonShimmer variant="rectangular" height={120} />
    </div>
  )
}

export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <SkeletonShimmer
          key={i}
          variant="text"
          width={i === 0 ? "30%" : "20%"}
          className="flex-1"
        />
      ))}
    </div>
  )
}

export function AvatarSkeleton({ size = 40 }: { size?: number }) {
  return <SkeletonShimmer variant="circular" width={size} height={size} />
}
