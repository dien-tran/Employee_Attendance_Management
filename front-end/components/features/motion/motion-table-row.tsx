"use client"

import { motion, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/lib/utils"

interface MotionTableRowProps extends HTMLMotionProps<"tr"> {
  children: React.ReactNode
  className?: string
  index?: number
}

export function MotionTableRow({
  children,
  className,
  index = 0,
  ...props
}: MotionTableRowProps) {
  return (
    <motion.tr
      className={cn(
        "border-b border-border transition-colors hover:bg-muted/50",
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{ backgroundColor: "var(--muted)" }}
      {...props}
    >
      {children}
    </motion.tr>
  )
}

// For use with AnimatePresence when rows are added/removed
export function MotionTableRowAnimated({
  children,
  className,
  ...props
}: MotionTableRowProps) {
  return (
    <motion.tr
      className={cn(
        "border-b border-border transition-colors hover:bg-muted/50",
        className
      )}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      {...props}
    >
      {children}
    </motion.tr>
  )
}
