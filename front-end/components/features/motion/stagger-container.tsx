"use client"

import { motion, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/lib/utils"

interface StaggerContainerProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode
  className?: string
  staggerDelay?: number
  delayChildren?: number
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.1,
  delayChildren = 0,
  ...props
}: StaggerContainerProps) {
  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: delayChildren,
          },
        },
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

interface StaggerItemProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode
  className?: string
}

export function StaggerItem({ children, className, ...props }: StaggerItemProps) {
  return (
    <motion.div
      className={cn(className)}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.4,
            ease: [0.25, 0.46, 0.45, 0.94],
          },
        },
      }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
