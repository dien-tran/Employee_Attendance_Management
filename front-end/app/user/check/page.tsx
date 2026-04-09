"use client"

import { useState, useCallback } from "react"
import { Chatbot } from '@/components/features/chatbot'
import { FaceScanner } from '@/components/features/face-recognition'
import { MotionPage, MotionSection, StaggerContainer, StaggerItem, ToastContainer, type Toast, MotionButton } from '@/components/features/motion'
import { getCurrentEmployee, type Employee } from "@/lib/mock-data"
import { Clock, CheckCircle2, LogOut } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export default function EmployeeCheckInPage() {
  const currentEmployee = getCurrentEmployee()
  const [toasts, setToasts] = useState<Toast[]>([])
  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [checkInTime, setCheckInTime] = useState<Date | null>(null)

  const handleCheckIn = useCallback((employee: Employee) => {
    const now = new Date()
    setIsCheckedIn(true)
    setCheckInTime(now)

    const toast: Toast = {
      id: Date.now().toString(),
      title: "Check-in Successful",
      description: `Welcome, ${employee.name}! Checked in at ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      type: "success",
    }
    setToasts((prev) => [...prev, toast])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id))
    }, 5000)
  }, [])

  const handleCheckOut = useCallback(() => {
    const now = new Date()
    setIsCheckedIn(false)
    
    const hoursWorked = checkInTime 
      ? ((now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)).toFixed(1)
      : "0"

    const toast: Toast = {
      id: Date.now().toString(),
      title: "Check-out Successful",
      description: `Goodbye! You worked ${hoursWorked} hours today.`,
      type: "success",
    }
    setToasts((prev) => [...prev, toast])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id))
    }, 5000)

    setCheckInTime(null)
  }, [checkInTime])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <>
      <MotionPage className="p-6 lg:p-8">
        {/* Header */}
        <MotionSection className="mb-8">
          <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Check In / Check Out</h1>
          <p className="mt-1 text-muted-foreground">
            Use face recognition to clock in or out for the day
          </p>
        </MotionSection>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Scanner or Checked In State */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {!isCheckedIn ? (
                <motion.div
                  key="scanner"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <FaceScanner onCheckIn={handleCheckIn} />
                </motion.div>
              ) : (
                <motion.div
                  key="checked-in"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  <div className="aspect-video relative bg-gradient-to-br from-success/10 to-success/5 flex flex-col items-center justify-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
                      className="flex h-24 w-24 items-center justify-center rounded-full bg-success/20 mb-6"
                    >
                      <CheckCircle2 className="h-12 w-12 text-success" />
                    </motion.div>
                    <motion.h2
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-2xl font-bold text-foreground mb-2"
                    >
                      You&apos;re Checked In!
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-muted-foreground"
                    >
                      Checked in at {checkInTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </motion.p>
                  </div>
                  <div className="p-6 flex justify-center">
                    <MotionButton
                      variant="destructive"
                      size="lg"
                      className="gap-2"
                      onClick={handleCheckOut}
                    >
                      <LogOut className="h-5 w-5" />
                      Check Out
                    </MotionButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Status Card */}
          <StaggerContainer className="rounded-xl border border-border bg-card p-6" delayChildren={0.2}>
            <StaggerItem>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Today&apos;s Status</h2>
                  <p className="text-sm text-muted-foreground">
                    {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </p>
                </div>
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
            </StaggerItem>

            <div className="space-y-4">
              <StaggerItem>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className={`text-sm font-medium ${isCheckedIn ? "text-success" : "text-muted-foreground"}`}>
                    {isCheckedIn ? "Checked In" : "Not Checked In"}
                  </span>
                </div>
              </StaggerItem>

              <StaggerItem>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Check-in Time</span>
                  <span className="text-sm font-medium text-foreground">
                    {checkInTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "-"}
                  </span>
                </div>
              </StaggerItem>

              <StaggerItem>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Expected Hours</span>
                  <span className="text-sm font-medium text-foreground">8h</span>
                </div>
              </StaggerItem>

              <StaggerItem>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">Working Hours</span>
                  <span className="text-sm font-medium text-foreground">9:00 - 18:00</span>
                </div>
              </StaggerItem>
            </div>

            <StaggerItem>
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs text-muted-foreground text-center">
                  {isCheckedIn 
                    ? "Remember to check out when you leave!"
                    : "Position your face in the scanner frame and click Capture & Check In."
                  }
                </p>
              </div>
            </StaggerItem>
          </StaggerContainer>
        </div>

        {/* Instructions Card */}
        {!isCheckedIn && (
          <StaggerContainer className="mt-8" delayChildren={0.4}>
            <StaggerItem>
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-semibold text-foreground mb-4">How to Check In</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-scanner/10 text-scanner font-semibold text-sm">
                      1
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Position</p>
                      <p className="text-sm text-muted-foreground">
                        Center your face within the oval frame
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-scanner/10 text-scanner font-semibold text-sm">
                      2
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Scan</p>
                      <p className="text-sm text-muted-foreground">
                        Click Capture & Check In
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-scanner/10 text-scanner font-semibold text-sm">
                      3
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Verify</p>
                      <p className="text-sm text-muted-foreground">
                        Wait for identity confirmation
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </StaggerItem>
          </StaggerContainer>
        )}
      </MotionPage>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <Chatbot />
    </>
  )
}
