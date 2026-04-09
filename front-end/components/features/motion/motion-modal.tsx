"use client"

import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface MotionModalProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  title?: string
  description?: string
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: { duration: 0.15 },
  },
}

export function MotionModal({
  isOpen,
  onClose,
  children,
  className,
  title,
  description,
}: MotionModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            variants={overlayVariants as any}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
          />
          <motion.div
            className={cn(
              "relative z-50 w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl",
              className
            )}
            variants={modalVariants as any}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
            {title && (
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                {description && (
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                )}
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
