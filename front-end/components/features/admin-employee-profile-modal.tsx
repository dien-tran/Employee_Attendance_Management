"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Camera,
  Fingerprint,
  IdCard,
  Mail,
  Phone,
  Trash2,
  UserRound,
  VideoOff,
  X,
} from "lucide-react"

import { EmployeeAvatar } from "@/components/features/employee-avatar"
import { MotionButton } from "@/components/features/motion"
import {
  CAMERA_FRAME_ASPECT_RATIO,
  CAMERA_FRAME_HEIGHT,
  CAMERA_FRAME_WIDTH,
  type FaceBoundingBox,
  canvasToJpegDataUrl,
  createFaceWebSocketUrl,
  drawVideoCoverFrame,
  faceBoundingBoxToRect,
  normalizeFaceBoundingBox,
} from "@/lib/camera-frame"
import { cn } from "@/lib/utils"
import type { StaffDTO } from "@/services/staff.service"

interface AdminEmployeeProfileModalProps {
  staff: StaffDTO
  faceRegistered: boolean
  onClose: () => void
  onFaceRegisteredChange: (staffId: string, registered: boolean) => void
}

type EnrollmentPhase = "idle" | "connecting" | "collecting" | "complete" | "error"

interface EnrollmentResponse {
  status: "GOOD_FRAME" | "REJECTED" | "ENROLLMENT_COMPLETE" | "ERROR"
  accepted_count?: number
  required_count?: number
  anti_spoof_score?: number
  face_bbox?: FaceBoundingBox | null
  reason?: string
  message?: string
  details?: {
    face_bbox?: FaceBoundingBox | null
  } | null
  data?: {
    employee_id: string
    full_name: string
    num_frames_used: number
    anti_spoof_score_avg: number
    quality_score_avg: number
  }
}

export function AdminEmployeeProfileModal({
  staff,
  faceRegistered,
  onClose,
  onFaceRegisteredChange,
}: AdminEmployeeProfileModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const sendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const manualCloseRef = useRef(false)
  const [cameraError, setCameraError] = useState("")
  const [cameraReady, setCameraReady] = useState(false)
  const [enrollmentPhase, setEnrollmentPhase] = useState<EnrollmentPhase>("idle")
  const [enrollmentMessage, setEnrollmentMessage] = useState("Camera is ready for face registration")
  const [acceptedCount, setAcceptedCount] = useState(0)
  const [requiredCount, setRequiredCount] = useState(0)
  const [livenessScore, setLivenessScore] = useState<number | null>(null)
  const [faceBox, setFaceBox] = useState<FaceBoundingBox | null>(null)

  const hasValidDob = /^\d{4}-\d{2}-\d{2}$/.test(staff.dob || "")
  const faceBoxRect = faceBoundingBoxToRect(faceBox)

  const stopSending = useCallback(() => {
    if (sendIntervalRef.current) {
      window.clearInterval(sendIntervalRef.current)
      sendIntervalRef.current = null
    }
  }, [])

  const closeEnrollmentSocket = useCallback((silent = false) => {
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

  const stopCamera = useCallback(() => {
    closeEnrollmentSocket(true)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraReady(false)
  }, [closeEnrollmentSocket])

  useEffect(() => stopCamera, [stopCamera])

  useEffect(() => {
    let animationId = 0

    if (cameraReady && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => undefined)

      const renderFrame = () => {
        drawVideoCoverFrame(videoRef.current, canvasRef.current)
        animationId = window.requestAnimationFrame(renderFrame)
      }

      renderFrame()
    }

    return () => window.cancelAnimationFrame(animationId)
  }, [cameraReady])

  const openCamera = useCallback(async () => {
    setCameraError("")
    setEnrollmentMessage("Opening camera...")

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

      streamRef.current = stream
      setCameraReady(true)
      setEnrollmentMessage("Camera is ready for face registration")
      setFaceBox(null)
    } catch {
      setCameraError("Camera unavailable")
      setCameraReady(false)
      setEnrollmentMessage("Camera unavailable")
    }
  }, [])

  const sendEnrollmentFrame = useCallback(
    (socket: WebSocket) => {
      if (socket.readyState !== WebSocket.OPEN) return
      if (!drawVideoCoverFrame(videoRef.current, canvasRef.current)) return

      const image = canvasToJpegDataUrl(canvasRef.current)
      if (!image) return

      socket.send(
        JSON.stringify({
          action: "capture",
          employee_id: staff.staffId,
          full_name: staff.name,
          date_of_birth: staff.dob,
          image,
        }),
      )
    },
    [staff.dob, staff.name, staff.staffId],
  )

  const registerFace = () => {
    if (!cameraReady || !hasValidDob || enrollmentPhase === "connecting" || enrollmentPhase === "collecting") return

    closeEnrollmentSocket(true)
    setEnrollmentPhase("connecting")
    setEnrollmentMessage("Connecting to face service...")
    setAcceptedCount(0)
    setRequiredCount(0)
    setLivenessScore(null)
    setFaceBox(null)

    const socket = new WebSocket(createFaceWebSocketUrl("/api/face/enroll/ws"))
    let terminalReached = false
    manualCloseRef.current = false
    socketRef.current = socket

    socket.onopen = () => {
      setEnrollmentPhase("collecting")
      setEnrollmentMessage("Collecting face frames...")
      sendEnrollmentFrame(socket)
      sendIntervalRef.current = window.setInterval(() => sendEnrollmentFrame(socket), 300)
    }

    socket.onmessage = (event) => {
      let response: EnrollmentResponse
      try {
        response = JSON.parse(event.data) as EnrollmentResponse
      } catch {
        response = {
          status: "ERROR",
          reason: "INVALID_RESPONSE",
          message: "Face service returned an invalid response",
        }
      }

      if (response.status === "GOOD_FRAME") {
        const nextFaceBox = normalizeFaceBoundingBox(response.face_bbox ?? response.details?.face_bbox)
        if (nextFaceBox) setFaceBox(nextFaceBox)
        setEnrollmentPhase("collecting")
        setEnrollmentMessage(response.message || "Good frame accepted")
        setAcceptedCount(response.accepted_count ?? acceptedCount)
        setRequiredCount(response.required_count ?? requiredCount)
        setLivenessScore(response.anti_spoof_score ?? null)
        return
      }

      if (response.status === "REJECTED") {
        const nextFaceBox = normalizeFaceBoundingBox(response.face_bbox ?? response.details?.face_bbox)
        if (nextFaceBox) setFaceBox(nextFaceBox)
        setEnrollmentPhase("collecting")
        setEnrollmentMessage(response.message || response.reason || "Frame rejected")
        if (typeof response.accepted_count === "number") setAcceptedCount(response.accepted_count)
        if (typeof response.required_count === "number") setRequiredCount(response.required_count)
        return
      }

      terminalReached = true
      stopSending()

      if (response.status === "ENROLLMENT_COMPLETE") {
        setEnrollmentPhase("complete")
        setEnrollmentMessage(response.message || "Face registration completed")
        setAcceptedCount(response.data?.num_frames_used ?? response.accepted_count ?? acceptedCount)
        setRequiredCount(response.data?.num_frames_used ?? response.required_count ?? requiredCount)
        setLivenessScore(response.data?.anti_spoof_score_avg ?? response.anti_spoof_score ?? null)
        onFaceRegisteredChange(staff.id, true)
      } else {
        setEnrollmentPhase("error")
        setEnrollmentMessage(response.message || response.reason || "Unable to register face")
        setFaceBox(null)
      }

      socket.close()
    }

    socket.onerror = () => {
      terminalReached = true
      stopSending()
      setEnrollmentPhase("error")
      setEnrollmentMessage("Unable to connect to face service")
      setFaceBox(null)
    }

    socket.onclose = () => {
      if (socketRef.current === socket) {
        socketRef.current = null
      }
      stopSending()

      if (!terminalReached) {
        if (!manualCloseRef.current) {
          setEnrollmentPhase("error")
          setEnrollmentMessage("Face enrollment connection closed")
        }
      }
      manualCloseRef.current = false
    }
  }

  const removeFace = () => {
    closeEnrollmentSocket(true)
    onFaceRegisteredChange(staff.id, false)
    setEnrollmentPhase("idle")
    setEnrollmentMessage("Face profile removed")
    setAcceptedCount(0)
    setRequiredCount(0)
    setLivenessScore(null)
    setFaceBox(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" data-testid="employee-profile-overlay">
      <div className="relative grid max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-lg border border-border bg-card shadow-2xl lg:grid-cols-[360px_minmax(0,1fr)]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          data-testid="employee-profile-close"
        >
          <X className="size-5" />
        </button>

        <aside className="border-b border-border bg-muted/30 p-6 lg:border-b-0 lg:border-r">
          <div className="flex flex-col items-center text-center">
            <EmployeeAvatar name={staff.name} status={staff.status === "ACTIVE" ? "online" : "offline"} size="lg" />
            <h2 className="mt-4 text-xl font-semibold text-foreground" data-testid="employee-profile-name">
              {staff.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{staff.position || "N/A"}</p>
            <span
              className={cn(
                "mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                staff.status === "ACTIVE" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              <span className={cn("size-1.5 rounded-full", staff.status === "ACTIVE" ? "bg-success" : "bg-destructive")} />
              {staff.status}
            </span>
          </div>

          <div className="mt-6 grid gap-3 text-sm">
            <ProfileRow icon={IdCard} label="Staff ID" value={staff.staffId || staff.id} />
            <ProfileRow icon={Mail} label="Email" value={staff.email} />
            <ProfileRow icon={Building2} label="Department" value={staff.department || "N/A"} />
            <ProfileRow icon={BriefcaseBusiness} label="Position" value={staff.position || "N/A"} />
            <ProfileRow icon={Phone} label="Phone" value={staff.phone || "Not provided"} />
            <ProfileRow icon={UserRound} label="Role" value={staff.role} />
          </div>
        </aside>

        <main className="overflow-y-auto p-6">
          <div className="pr-12">
            <h3 className="text-lg font-semibold text-foreground">Employee Profile</h3>
            <p className="mt-1 text-sm text-muted-foreground">Personal details and face registration</p>
          </div>

          <section className="mt-6 rounded-lg border border-border bg-background">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-scanner/10 text-scanner">
                  <Fingerprint className="size-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Face Registration</h4>
                  <p className="text-sm text-muted-foreground">{enrollmentMessage}</p>
                </div>
              </div>
              <span
                className={cn(
                  "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                  faceRegistered ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
                )}
              >
                <BadgeCheck className="size-3.5" />
                {faceRegistered ? "Ready" : "Pending"}
              </span>
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-black">
                {cameraError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                    <VideoOff className="size-9 text-destructive" />
                    <p className="text-sm font-medium">{cameraError}</p>
                  </div>
                ) : cameraReady ? (
                  <>
                    <video ref={videoRef} autoPlay muted playsInline className="hidden" />
                    <canvas ref={canvasRef} className="block h-full w-full scale-x-[-1]" />
                    {faceBoxRect && (
                      <svg
                        className="pointer-events-none absolute inset-0 h-full w-full scale-x-[-1]"
                        viewBox={`0 0 ${CAMERA_FRAME_WIDTH} ${CAMERA_FRAME_HEIGHT}`}
                        preserveAspectRatio="xMidYMid meet"
                      >
                        <rect
                          x={faceBoxRect.x}
                          y={faceBoxRect.y}
                          width={faceBoxRect.width}
                          height={faceBoxRect.height}
                          fill="none"
                          stroke="var(--scanner)"
                          strokeWidth="3"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    )}
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Camera className="size-12 text-white/45" />
                  </div>
                )}

              </div>

              <div className="flex flex-col justify-between gap-3">
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Employee</p>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">{staff.name}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Face profile</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{faceRegistered ? "Registered" : "Pending"}</p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Progress</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {requiredCount > 0 ? `${acceptedCount}/${requiredCount}` : "-"}
                  </p>
                </div>
                <div className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">Liveness</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {typeof livenessScore === "number" ? `${Math.round(livenessScore * 100)}%` : "-"}
                  </p>
                </div>
                {!hasValidDob && (
                  <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                    Date of birth must use YYYY-MM-DD before enrollment.
                  </div>
                )}
                {enrollmentPhase === "error" && (
                  <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                    {enrollmentMessage}
                  </div>
                )}
                {enrollmentPhase === "complete" && (
                  <div className="rounded-md bg-success/10 p-3 text-xs text-success">
                    {enrollmentMessage}
                  </div>
                )}
                {(enrollmentPhase === "connecting" || enrollmentPhase === "collecting") && (
                  <div className="rounded-md bg-scanner/10 p-3 text-xs text-scanner">
                    {enrollmentMessage}
                  </div>
                )}
                <div className="grid gap-2">
                  {(enrollmentPhase === "connecting" || enrollmentPhase === "collecting") && (
                    <MotionButton
                      variant="outline"
                      onClick={() => {
                        closeEnrollmentSocket(true)
                        setEnrollmentPhase("idle")
                        setEnrollmentMessage("Enrollment stopped")
                      }}
                      className="w-full"
                    >
                      Stop enrollment
                    </MotionButton>
                  )}
                  {!cameraReady && (
                    <MotionButton variant="outline" onClick={openCamera} className="w-full">
                      <Camera className="size-4" />
                      Open camera
                    </MotionButton>
                  )}
                  <MotionButton
                    variant="scanner"
                    onClick={registerFace}
                    disabled={
                      !cameraReady ||
                      !hasValidDob ||
                      enrollmentPhase === "connecting" ||
                      enrollmentPhase === "collecting"
                    }
                    className="w-full"
                    data-testid="employee-register-face"
                  >
                    <Fingerprint className="size-4" />
                    Register face
                  </MotionButton>
                  {faceRegistered && (
                    <MotionButton variant="destructive" onClick={removeFace} className="w-full">
                      <Trash2 className="size-4" />
                      Remove face
                    </MotionButton>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

function ProfileRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof IdCard
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-md bg-background px-3 py-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}
