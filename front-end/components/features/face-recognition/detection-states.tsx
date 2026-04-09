"use client"

import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { Camera, Scan, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

export type ScanState = "idle" | "scanning" | "detecting" | "success" | "error"

interface DetectionStatesProps {
  state: ScanState
}

const stateConfig = {
  idle: {
    icon: Camera,
    label: "Ready to Scan",
    description: "Position your face within the frame and click Start Scan",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  scanning: {
    icon: Scan,
    label: "Scanning...",
    description: "Hold still while we capture your face",
    color: "text-scanner",
    bgColor: "bg-scanner/10",
  },
  detecting: {
    icon: Loader2,
    label: "Verifying Identity",
    description: "Processing biometric data...",
    color: "text-scanner",
    bgColor: "bg-scanner/10",
    animate: true,
  },
  success: {
    icon: CheckCircle2,
    label: "Verified",
    description: "Check-in successful!",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  error: {
    icon: AlertCircle,
    label: "Not Recognized",
    description: "Please try again or contact HR",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
}

export function DetectionStates({ state }: DetectionStatesProps) {
  const config = stateConfig[state]
  const Icon = config.icon

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "flex items-center gap-4 rounded-xl p-4",
          config.bgColor
        )}
      >
        <motion.div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full",
            config.bgColor,
            config.color
          )}
          animate={
            "animate" in config && config.animate
              ? { rotate: 360 }
              : undefined
          }
          transition={
            "animate" in config && config.animate
              ? { duration: 1, repeat: Infinity, ease: "linear" }
              : undefined
          }
        >
          <Icon className="h-6 w-6" />
        </motion.div>
        <div className="flex-1">
          <p className={cn("font-semibold", config.color)}>{config.label}</p>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
