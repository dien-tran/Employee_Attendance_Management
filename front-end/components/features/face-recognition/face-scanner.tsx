"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { ScanningOverlay } from "./scanning-overlay"
import { DetectionStates, type ScanState } from "./detection-states"
import { CheckAnimation } from "./check-animation"
import { ErrorShake } from "./error-shake"
import { MotionButton } from '@/components/features/motion'
import { employees, type Employee } from "@/lib/mock-data"
import { Camera, RotateCcw, VideoOff } from "lucide-react"

interface FaceScannerProps {
  onCheckIn?: (employee: Employee) => void
  className?: string
}

export function FaceScanner({ onCheckIn, className }: FaceScannerProps) {
  const [scanState, setScanState] = useState<ScanState>("idle")
  const [detectedEmployee, setDetectedEmployee] = useState<Employee | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [cameraError, setCameraError] = useState<string>("")
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Initialize Camera
  useEffect(() => {
    let active = true
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" }
        })
        if (active) {
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
        } else {
          // Stop tracks if component unmounted before camera initialization succeeded
          stream.getTracks().forEach(track => track.stop())
        }
      } catch (err: any) {
        if (active) {
          console.error("Camera access error:", err)
          setCameraError("Camera access denied or unavailable. Please allow camera permissions.")
        }
      }
    }

    initCamera()

    return () => {
      active = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const captureAndScan = useCallback(async () => {
    if (!videoRef.current) return

    setScanState("scanning")
    setDetectedEmployee(null)
    setErrorMessage("")
    
    // Freeze video to emulate "capture"
    videoRef.current.pause()

    // Simulate scanning phase (1.5s)
    await new Promise((resolve) => setTimeout(resolve, 1500))

    setScanState("detecting")

    // Simulate detection phase (1s)
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Random success/failure (90% success rate)
    const success = Math.random() > 0.1

    if (success) {
      // Pick a random employee
      const randomEmployee = employees[Math.floor(Math.random() * employees.length)]
      setDetectedEmployee(randomEmployee)
      setScanState("success")
      onCheckIn?.(randomEmployee)
    } else {
      setErrorMessage("Face not recognized. Please try again or contact HR.")
      setScanState("error")
    }
  }, [onCheckIn])

  const reset = useCallback(() => {
    setScanState("idle")
    setDetectedEmployee(null)
    setErrorMessage("")
    
    // Resume video
    if (videoRef.current) {
      videoRef.current.play().catch(e => console.error("Error resuming video:", e))
    }
  }, [])

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      {/* Scanner Container */}
      <div className="relative w-full max-w-md aspect-[4/3] rounded-2xl overflow-hidden bg-black border border-border flex items-center justify-center">
        
        {/* Real Video Feed */}
        {cameraError ? (
          <div className="text-center p-6 flex flex-col items-center justify-center">
            <VideoOff className="h-10 w-10 text-destructive mb-3" />
            <p className="text-sm text-muted-foreground">{cameraError}</p>
          </div>
        ) : (
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity",
              scanState === "success" ? "opacity-30" : "opacity-100",
              scanState === "error" ? "opacity-30 grayscale" : ""
            )}
            style={{ transform: "scaleX(-1)" }} // Mirror effect for user-facing camera
          />
        )}

        {/* Face Frame Overlay */}
        {!cameraError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              className={cn(
                "w-48 h-60 rounded-[60px] border-2",
                scanState === "idle" && "border-white/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]",
                scanState === "scanning" && "border-scanner shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]",
                scanState === "detecting" && "border-scanner shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]",
                scanState === "success" && "border-success shadow-[0_0_0_9999px_rgba(0,0,0,0.8)]",
                scanState === "error" && "border-destructive shadow-[0_0_0_9999px_rgba(0,0,0,0.8)]"
              )}
              animate={{
                scale: scanState === "scanning" ? [1, 1.02, 1] : 1,
              }}
              transition={{
                duration: 1.5,
                repeat: scanState === "scanning" ? Infinity : 0,
                ease: "easeInOut",
              }}
            />
          </div>
        )}

        {/* Scanning Overlay */}
        <AnimatePresence>
          {(scanState === "scanning" || scanState === "detecting") && (
            <ScanningOverlay state={scanState} />
          )}
        </AnimatePresence>

        {/* Success Overlay */}
        <AnimatePresence>
          {scanState === "success" && detectedEmployee && (
            <CheckAnimation employee={detectedEmployee} />
          )}
        </AnimatePresence>

        {/* Error Overlay */}
        <AnimatePresence>
          {scanState === "error" && <ErrorShake message={errorMessage} />}
        </AnimatePresence>
      </div>

      {/* Detection State Indicator */}
      <div className="mt-6 w-full max-w-md">
        <DetectionStates state={scanState} />
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-3">
        <AnimatePresence mode="wait">
          {scanState === "idle" && !cameraError && (
            <motion.div
              key="start"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <MotionButton
                variant="scanner"
                size="lg"
                onClick={captureAndScan}
                className="gap-2"
              >
                <Camera className="h-5 w-5" />
                Capture & Check In
              </MotionButton>
            </motion.div>
          )}

          {(scanState === "success" || scanState === "error") && !cameraError && (
            <motion.div
              key="reset"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <MotionButton
                variant="outline"
                size="lg"
                onClick={reset}
                className="gap-2"
              >
                <RotateCcw className="h-5 w-5" />
                Scan Again
              </MotionButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
