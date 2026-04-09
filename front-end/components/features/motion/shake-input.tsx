"use client"

import { motion, useAnimation } from "framer-motion"
import { cn } from "@/lib/utils"
import { forwardRef, useImperativeHandle, type InputHTMLAttributes } from "react"

interface ShakeInputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  errorMessage?: string
}

export interface ShakeInputRef {
  shake: () => void
}

const shakeAnimation = {
  x: [0, -10, 10, -10, 10, -5, 5, -2, 2, 0],
  transition: { duration: 0.5 },
}

export const ShakeInput = forwardRef<ShakeInputRef, ShakeInputProps>(
  ({ className, error, errorMessage, ...props }, ref) => {
    const controls = useAnimation()

    useImperativeHandle(ref, () => ({
      shake: () => {
        controls.start(shakeAnimation)
      },
    }))

    return (
      <div className="relative">
        <motion.input
          animate={controls}
          className={cn(
            "flex h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm ring-offset-background",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error
              ? "border-destructive focus-visible:ring-destructive"
              : "border-input",
            className
          )}
          {...(props as any)}
        />
        {error && errorMessage && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-1.5 text-xs text-destructive"
          >
            {errorMessage}
          </motion.p>
        )}
      </div>
    )
  }
)

ShakeInput.displayName = "ShakeInput"
