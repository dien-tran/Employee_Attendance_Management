"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Camera,
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  RotateCcw,
  ScanFace,
  ShieldCheck,
  VideoOff,
  XCircle,
} from "lucide-react"

import { MotionButton, MotionPage, MotionSection } from "@/components/features/motion"
import {
  CAMERA_FRAME_ASPECT_RATIO,
  CAMERA_FRAME_HEIGHT,
  CAMERA_FRAME_WIDTH,
  canvasToJpegDataUrl,
  createFaceWebSocketUrl,
  drawVideoCoverFrame,
} from "@/lib/camera-frame"
import { cn } from "@/lib/utils"

type AttendanceMode = "checkin" | "checkout"
type ScanPhase = "ready" | "connecting" | "scanning" | "success" | "failed"

interface AttendanceKioskProps {
  mode: AttendanceMode
}

interface AttendanceEmployee {
  employee_id: string
  full_name: string
  department?: string | null
  position?: string | null
}

interface AttendanceResponse {
  status:
    | "PROCESSING"
    | "REJECTED"
    | "UNKNOWN_FACE"
    | "ATTENDANCE_SUCCESS"
    | "ALREADY_RECORDED"
    | "CHECKOUT_WITHOUT_CHECKIN"
    | "EMPLOYEE_INACTIVE"
    | "EMPLOYEE_NOT_FOUND"
    | "ERROR"
  success?: boolean
  reason?: string
  message?: string
  attendance_type?: AttendanceMode
  employee?: AttendanceEmployee | null
  check_time?: string
  check_date?: string
  on_time?: boolean
  attendance_status?: "on_time" | "late" | "early" | "unknown"
  similarity_score?: number | null
}

const terminalStatuses = new Set<AttendanceResponse["status"]>([
  "ATTENDANCE_SUCCESS",
  "ALREADY_RECORDED",
  "CHECKOUT_WITHOUT_CHECKIN",
  "EMPLOYEE_INACTIVE",
  "EMPLOYEE_NOT_FOUND",
  "ERROR",
])

const modeCopy = {
  checkin: {
    title: "Face Check-in",
    action: "Check in",
    activeAction: "Checking in",
    complete: "Check-in recorded",
    icon: LogIn,
    accentClass: "text-scanner",
    buttonVariant: "scanner" as const,
  },
  checkout: {
    title: "Face Checkout",
    action: "Check out",
    activeAction: "Checking out",
    complete: "Checkout recorded",
    icon: LogOut,
    accentClass: "text-success",
    buttonVariant: "success" as const,
  },
}

function formatBackendStatus(response: AttendanceResponse | null) {
  if (!response) return "Ready"

  if (response.status === "ATTENDANCE_SUCCESS") {
    return response.attendance_status === "on_time"
      ? "Recorded on time"
      : response.attendance_status === "late"
        ? "Recorded late"
        : response.attendance_status === "early"
          ? "Recorded early"
          : "Recorded"
  }

  return response.status.replaceAll("_", " ")
}

function formatTime(value?: string) {
  if (!value) return "-"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function AttendanceKiosk({ mode }: AttendanceKioskProps) {
  const copy = modeCopy[mode]
  const ModeIcon = copy.icon
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const sendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const manualCloseRef = useRef(false)
  const [cameraError, setCameraError] = useState("")
  const [scanPhase, setScanPhase] = useState<ScanPhase>("ready")
  const [lastResponse, setLastResponse] = useState<AttendanceResponse | null>(null)
  const [now, setNow] = useState(() => new Date())

  const stopSending = useCallback(() => {
    if (sendIntervalRef.current) {
      window.clearInterval(sendIntervalRef.current)
      sendIntervalRef.current = null
    }
  }, [])

  const closeSocket = useCallback((silent = false) => {
    stopSending()
    const socket = socketRef.current
    socketRef.current = null
    if (socket && socket.readyState <= WebSocket.OPEN) {
      manualCloseRef.current = silent
      socket.close()
    } else {
      manualCloseRef.current = false
    }
  }, [stopSending])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    let active = true

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: CAMERA_FRAME_WIDTH },
            height: { ideal: CAMERA_FRAME_HEIGHT },
            aspectRatio: { ideal: CAMERA_FRAME_ASPECT_RATIO },
            frameRate: { ideal: 24, max: 30 },
          },
          audio: false,
        })

        if (!active) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => undefined)
        }
      } catch {
        if (active) {
          setCameraError("Camera unavailable")
        }
      }
    }

    startCamera()

    return () => {
      active = false
      closeSocket(true)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [closeSocket])

  useEffect(() => {
    let animationId = 0

    const renderFrame = () => {
      drawVideoCoverFrame(videoRef.current, canvasRef.current)
      animationId = window.requestAnimationFrame(renderFrame)
    }

    renderFrame()
    return () => window.cancelAnimationFrame(animationId)
  }, [])

  const statusLabel = useMemo(() => {
    if (cameraError) return cameraError
    if (scanPhase === "connecting") return "Connecting"
    if (scanPhase === "scanning") return lastResponse?.message || "Scanning"
    if (scanPhase === "success") return lastResponse?.message || copy.complete
    if (scanPhase === "failed") return lastResponse?.message || "Unable to record attendance"
    return "Ready"
  }, [cameraError, copy.complete, lastResponse?.message, scanPhase])

  const sendFrame = useCallback(
    (socket: WebSocket) => {
      if (socket.readyState !== WebSocket.OPEN) return
      if (!drawVideoCoverFrame(videoRef.current, canvasRef.current)) return

      const image = canvasToJpegDataUrl(canvasRef.current)
      if (!image) return

      socket.send(
        JSON.stringify({
          action: "attendance_frame",
          type: mode,
          image,
        }),
      )
    },
    [mode],
  )

  const startScan = useCallback(() => {
    if (cameraError || scanPhase === "connecting" || scanPhase === "scanning") return

    closeSocket(true)
    setLastResponse(null)
    setScanPhase("connecting")

    const socket = new WebSocket(createFaceWebSocketUrl("/api/face/checkin/ws"))
    let terminalReached = false
    manualCloseRef.current = false
    socketRef.current = socket

    socket.onopen = () => {
      setScanPhase("scanning")
      sendFrame(socket)
      sendIntervalRef.current = window.setInterval(() => sendFrame(socket), 300)
    }

    socket.onmessage = (event) => {
      let response: AttendanceResponse
      try {
        response = JSON.parse(event.data) as AttendanceResponse
      } catch {
        response = {
          status: "ERROR",
          reason: "INVALID_RESPONSE",
          message: "Face service returned an invalid response",
        }
      }

      setLastResponse(response)

      if (response.status === "ATTENDANCE_SUCCESS") {
        terminalReached = true
        stopSending()
        setScanPhase("success")
        socket.close()
        return
      }

      if (terminalStatuses.has(response.status)) {
        terminalReached = true
        stopSending()
        setScanPhase("failed")
        socket.close()
        return
      }

      setScanPhase("scanning")
    }

    socket.onerror = () => {
      terminalReached = true
      stopSending()
      setLastResponse({
        status: "ERROR",
        reason: "CONNECTION_ERROR",
        message: "Unable to connect to face service",
      })
      setScanPhase("failed")
    }

    socket.onclose = () => {
      if (socketRef.current === socket) {
        socketRef.current = null
      }
      stopSending()

      if (!terminalReached && !manualCloseRef.current) {
        setLastResponse({
          status: "ERROR",
          reason: "CONNECTION_CLOSED",
          message: "Face service connection closed",
        })
        setScanPhase("failed")
      }
      manualCloseRef.current = false
    }
  }, [cameraError, closeSocket, scanPhase, sendFrame, stopSending])

  const reset = useCallback(() => {
    closeSocket(true)
    setLastResponse(null)
    setScanPhase("ready")
    videoRef.current?.play().catch(() => undefined)
  }, [closeSocket])

  const formattedTime = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  const formattedDate = now.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  const statusTone =
    scanPhase === "success"
      ? "bg-success"
      : scanPhase === "failed"
        ? "bg-destructive"
        : scanPhase === "connecting" || scanPhase === "scanning"
          ? "bg-scanner"
          : "bg-muted-foreground"

  return (
    <MotionPage className="min-h-screen bg-background px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <MotionSection className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
              <ModeIcon className={cn("size-5", copy.accentClass)} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-normal text-foreground sm:text-3xl">
                {copy.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{formattedDate}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <Clock3 className="size-4 text-muted-foreground" />
            <span className="tabular-nums text-lg font-semibold text-foreground">{formattedTime}</span>
          </div>
        </MotionSection>

        <main className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="relative aspect-[4/3] min-h-[320px] bg-black">
              {cameraError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <VideoOff className="size-10 text-destructive" />
                  <p className="text-sm font-medium text-white">{cameraError}</p>
                </div>
              ) : (
                <>
                  <video ref={videoRef} autoPlay muted playsInline className="hidden" />
                  <canvas ref={canvasRef} className="block h-full w-full scale-x-[-1]" />
                </>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3 text-sm text-muted-foreground">
                <ScanFace className="size-4 shrink-0 text-scanner" />
                <span className={cn("size-2 shrink-0 rounded-full", statusTone)} />
                <span className="truncate">{scanPhase === "scanning" ? copy.activeAction : formatBackendStatus(lastResponse)}</span>
              </div>

              <div className="flex gap-2">
                {(scanPhase === "success" || scanPhase === "failed" || scanPhase === "scanning" || scanPhase === "connecting") && (
                  <MotionButton variant="outline" onClick={reset} className="gap-2">
                    <RotateCcw className="size-4" />
                    {scanPhase === "scanning" || scanPhase === "connecting" ? "Stop" : "Reset"}
                  </MotionButton>
                )}
                <MotionButton
                  variant={copy.buttonVariant}
                  onClick={startScan}
                  disabled={Boolean(cameraError) || scanPhase === "connecting" || scanPhase === "scanning"}
                  className="gap-2"
                >
                  <Camera className="size-4" />
                  {copy.action}
                </MotionButton>
              </div>
            </div>
          </section>

          <aside className="grid gap-5">
            <section className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Session</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{mode === "checkin" ? "Morning entry" : "End of shift"}</p>
                </div>
                {scanPhase === "failed" ? (
                  <XCircle className="size-5 text-destructive" />
                ) : scanPhase === "success" ? (
                  <CheckCircle2 className="size-5 text-success" />
                ) : (
                  <ShieldCheck className="size-5 text-success" />
                )}
              </div>

              <div className="mt-5 grid gap-3 text-sm">
                <InfoRow label="Action" value={copy.action} />
                <InfoRow label="Status" value={formatBackendStatus(lastResponse)} />
                <InfoRow label="Message" value={lastResponse?.message || statusLabel} />
                <InfoRow label="Recorded" value={formatTime(lastResponse?.check_time)} />
                <InfoRow label="Punctuality" value={lastResponse?.attendance_status || "-"} />
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">Employee</h2>
              <div className="mt-5 grid gap-3 text-sm">
                <InfoRow label="Name" value={lastResponse?.employee?.full_name || "-"} />
                <InfoRow label="Staff ID" value={lastResponse?.employee?.employee_id || "-"} />
                <InfoRow label="Department" value={lastResponse?.employee?.department || "-"} />
                <InfoRow
                  label="Similarity"
                  value={
                    typeof lastResponse?.similarity_score === "number"
                      ? `${Math.round(lastResponse.similarity_score * 100)}%`
                      : "-"
                  }
                />
              </div>
            </section>
          </aside>
        </main>
      </div>
    </MotionPage>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium text-foreground">{value}</span>
    </div>
  )
}
