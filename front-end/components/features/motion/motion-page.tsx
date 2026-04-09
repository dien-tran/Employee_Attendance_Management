"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface MotionPageProps {
  children: React.ReactNode
  className?: string
}

const pageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94],
      staggerChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.2 },
  },
}

export function MotionPage({ children, className }: MotionPageProps) {
  return (
    <motion.div
      className={cn("w-full", className)}
      variants={pageVariants as any}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {children}
    </motion.div>
  )
}

// Child component that responds to stagger
export function MotionSection({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.section
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
    >
      {children}
    </motion.section>
  )
}
