"use client"

import { motion, type HTMLMotionProps } from "framer-motion"
import { cn } from "@/lib/utils"
import { forwardRef } from "react"
import { cva, type VariantProps } from "class-variance-authority"

const motionButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        success: "bg-success text-success-foreground hover:bg-success/90",
        scanner: "bg-scanner text-scanner-foreground hover:bg-scanner/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface MotionButtonProps
  extends HTMLMotionProps<"button">,
    VariantProps<typeof motionButtonVariants> {
  children: React.ReactNode
  className?: string
  tapScale?: number
}

export const MotionButton = forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ children, className, variant, size, tapScale = 0.97, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        className={cn(motionButtonVariants({ variant, size, className }))}
        whileTap={{ scale: tapScale }}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        {...props}
      >
        {children}
      </motion.button>
    )
  }
)

MotionButton.displayName = "MotionButton"
