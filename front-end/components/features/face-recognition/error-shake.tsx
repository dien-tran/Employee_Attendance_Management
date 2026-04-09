"use client"

import { motion } from "framer-motion"
import { AlertCircle } from "lucide-react"

interface ErrorShakeProps {
  message: string
}

export function ErrorShake({ message }: ErrorShakeProps) {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Error icon with shake */}
      <motion.div
        className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10"
        initial={{ scale: 0 }}
        animate={{
          scale: 1,
          x: [0, -10, 10, -10, 10, -5, 5, -2, 2, 0],
        }}
        transition={{
          scale: { type: "spring", stiffness: 300, damping: 20 },
          x: { delay: 0.2, duration: 0.5 },
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <AlertCircle className="h-10 w-10 text-destructive" />
        </motion.div>
      </motion.div>

      {/* Error message */}
      <motion.div
        className="mt-6 flex flex-col items-center text-center px-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
      >
        <p className="text-lg font-semibold text-destructive">
          Recognition Failed
        </p>
        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          {message}
        </p>
      </motion.div>
    </motion.div>
  )
}
