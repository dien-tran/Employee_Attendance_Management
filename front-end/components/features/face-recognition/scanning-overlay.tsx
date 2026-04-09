"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface ScanningOverlayProps {
  state: "scanning" | "detecting"
}

export function ScanningOverlay({ state }: ScanningOverlayProps) {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Pulsing border glow */}
      <motion.div
        className="absolute inset-0 rounded-2xl"
        style={{
          boxShadow: "inset 0 0 60px rgba(var(--scanner-glow))",
        }}
        animate={{
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Scanning line */}
      {state === "scanning" && (
        <motion.div
          className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-scanner to-transparent"
          initial={{ top: "10%" }}
          animate={{ top: ["10%", "90%", "10%"] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Corner brackets */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-52 h-64">
          {/* Top-left */}
          <motion.div
            className={cn(
              "absolute top-0 left-0 w-8 h-8 border-l-2 border-t-2 rounded-tl-lg",
              "border-scanner"
            )}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [1, 0.7, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          {/* Top-right */}
          <motion.div
            className={cn(
              "absolute top-0 right-0 w-8 h-8 border-r-2 border-t-2 rounded-tr-lg",
              "border-scanner"
            )}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [1, 0.7, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.2,
            }}
          />
          {/* Bottom-left */}
          <motion.div
            className={cn(
              "absolute bottom-0 left-0 w-8 h-8 border-l-2 border-b-2 rounded-bl-lg",
              "border-scanner"
            )}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [1, 0.7, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.4,
            }}
          />
          {/* Bottom-right */}
          <motion.div
            className={cn(
              "absolute bottom-0 right-0 w-8 h-8 border-r-2 border-b-2 rounded-br-lg",
              "border-scanner"
            )}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [1, 0.7, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.6,
            }}
          />
        </div>
      </div>

      {/* Shimmer effect for detecting state */}
      {state === "detecting" && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-scanner/20 to-transparent"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      )}
    </motion.div>
  )
}
