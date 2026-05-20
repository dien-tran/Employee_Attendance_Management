"use client"

import { useEffect, useMemo, useState } from "react"
import { Chatbot } from '@/components/features/chatbot'
import { EmployeeAvatar } from '@/components/features/employee-avatar'
import { MotionPage, MotionSection, StaggerContainer, StaggerItem, MotionCard, MotionButton } from '@/components/features/motion'
import { attendanceService, type AttendanceDTO } from "@/services/attendance.service"
import { profileService } from "@/services/profile.service"
import { useAuthStore } from "@/store/authStore"
import { Camera, CalendarDays, Clock, TrendingUp, CheckCircle2, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function EmployeeHomePage() {
  const { user, setUser } = useAuthStore()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceDTO[]>([])
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [attendanceLoading, setAttendanceLoading] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      if (!user || profileLoaded) {
        return
      }

      try {
        const profile = await profileService.getMe()

        if (!isMounted) {
          return
        }

        setUser({
          ...user,
          id: profile.id,
          staffId: profile.staffId,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          department: profile.department,
          position: profile.position,
          phone: profile.phone,
        })
        setProfileLoaded(true)
      } catch {
        // Keep the login payload if the profile endpoint is temporarily unavailable.
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [profileLoaded, setUser, user])

  useEffect(() => {
    let isMounted = true

    async function loadAttendance() {
      setAttendanceLoading(true)

      try {
        const endDate = toDateInputValue(new Date())
        const startDate = toDateInputValue(addDays(new Date(), -30))
        const records = await attendanceService.getMyAttendance(startDate, endDate)

        if (isMounted) {
          setAttendanceRecords(records)
        }
      } catch {
        if (isMounted) {
          setAttendanceRecords([])
        }
      } finally {
        if (isMounted) {
          setAttendanceLoading(false)
        }
      }
    }

    loadAttendance()

    return () => {
      isMounted = false
    }
  }, [])

  const currentEmployee = {
    name: user?.name || "Employee",
    email: user?.email || "-",
    role: formatRole(user?.role),
    department: user?.department || "Unassigned",
    position: user?.position || formatRole(user?.role),
    image: user?.image,
    id: user?.staffId || user?.id || "-",
  }

  const recentRecords = useMemo(
    () =>
      [...attendanceRecords]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 5),
    [attendanceRecords]
  )

  const totalEvents = attendanceRecords.length
  const onTimeEvents = attendanceRecords.filter((r) => r.onTime === true).length
  const lateEvents = attendanceRecords.filter((r) => r.onTime === false).length
  const attendanceRate = totalEvents > 0 ? Math.round((onTimeEvents / totalEvents) * 100) : 0
  const isCheckedIn = isCurrentlyCheckedIn(attendanceRecords)

  return (
    <>
      <MotionPage className="p-6 lg:p-8">
        {/* Welcome Header */}
        <MotionSection className="mb-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <EmployeeAvatar
                name={currentEmployee.name}
                image={currentEmployee.image}
                status={isCheckedIn ? "online" : "offline"}
                size="lg"
              />
              <div>
                <h1 className="text-2xl font-bold text-foreground lg:text-3xl">
                  Welcome back, {getFirstName(currentEmployee.name)}!
                </h1>
                <p className="text-muted-foreground">
                  {currentEmployee.position} - {currentEmployee.department}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="text-sm text-muted-foreground">
                {currentTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
        </MotionSection>

        {/* Quick Actions */}
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StaggerItem>
            <Link href="/checkin">
              <MotionCard className="p-6 cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${isCheckedIn ? "bg-success/10" : "bg-scanner/10"}`}>
                    {isCheckedIn ? (
                      <CheckCircle2 className="h-6 w-6 text-success" />
                    ) : (
                      <Camera className="h-6 w-6 text-scanner" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">
                      {isCheckedIn ? "Checked In" : "Check In Now"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isCheckedIn ? "You're clocked in" : "Start your day"}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </MotionCard>
            </Link>
          </StaggerItem>
          <StaggerItem>
            <Link href="/user/attendance">
              <MotionCard className="p-6 cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <CalendarDays className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">My Attendance</p>
                    <p className="text-sm text-muted-foreground">View history</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </MotionCard>
            </Link>
          </StaggerItem>
          <StaggerItem>
            <MotionCard className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                  <TrendingUp className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{attendanceRate}%</p>
                  <p className="text-sm text-muted-foreground">On-time Rate</p>
                </div>
              </div>
            </MotionCard>
          </StaggerItem>
          <StaggerItem>
            <MotionCard className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-scanner/10">
                  <Clock className="h-6 w-6 text-scanner" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{lateEvents}</p>
                  <p className="text-sm text-muted-foreground">Late Events</p>
                </div>
              </div>
            </MotionCard>
          </StaggerItem>
        </StaggerContainer>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Activity */}
          <StaggerContainer className="lg:col-span-2 rounded-xl border border-border bg-card p-6" delayChildren={0.3}>
            <StaggerItem>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Recent Attendance</h2>
                  <p className="text-sm text-muted-foreground">Your last 5 attendance events</p>
                </div>
                <Link href="/user/attendance">
                  <MotionButton variant="ghost" size="sm">
                    View All
                  </MotionButton>
                </Link>
              </div>
            </StaggerItem>
            
            <div className="space-y-3">
              {attendanceLoading ? (
                <StaggerItem>
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">Loading attendance records...</p>
                  </div>
                </StaggerItem>
              ) : recentRecords.length > 0 ? (
                recentRecords.map((record) => (
                  <StaggerItem key={record.id}>
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">
                          {formatDate(record.date)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatAttendanceType(record.type)} at {formatTime(record.timestamp)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            record.onTime === true
                              ? "bg-success/10 text-success"
                              : record.onTime === false
                              ? "bg-scanner/10 text-scanner"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {formatAttendanceStatus(record)}
                        </span>
                      </div>
                    </div>
                  </StaggerItem>
                ))
              ) : (
                <StaggerItem>
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No attendance records yet</p>
                  </div>
                </StaggerItem>
              )}
            </div>
          </StaggerContainer>

          {/* Profile Card */}
          <StaggerContainer className="rounded-xl border border-border bg-card p-6" delayChildren={0.4}>
            <StaggerItem>
              <div className="flex flex-col items-center text-center">
                <EmployeeAvatar
                  name={currentEmployee.name}
                  image={currentEmployee.image}
                  status={isCheckedIn ? "online" : "offline"}
                  size="lg"
                />
                <h3 className="mt-4 text-lg font-semibold text-foreground">{currentEmployee.name}</h3>
                <p className="text-sm text-muted-foreground">{currentEmployee.position}</p>
                <p className="text-xs text-muted-foreground mt-1">{currentEmployee.department}</p>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="mt-6 pt-6 border-t border-border space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="text-sm font-medium text-foreground truncate ml-4">{currentEmployee.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Employee ID</span>
                  <span className="text-sm font-medium text-foreground">{currentEmployee.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className={`text-sm font-medium ${isCheckedIn ? "text-success" : "text-muted-foreground"}`}>
                    {isCheckedIn ? "Checked In" : "Not Checked In"}
                  </span>
                </div>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="mt-6">
                <Link href="/user/profile">
                  <MotionButton variant="outline" className="w-full">
                    View Full Profile
                  </MotionButton>
                </Link>
              </div>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </MotionPage>
      <Chatbot />
    </>
  )
}

function getFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there"
}

function formatRole(role?: "ADMIN" | "USER") {
  if (role === "ADMIN") {
    return "System Administrator"
  }

  if (role === "USER") {
    return "Employee"
  }

  return "Employee"
}

function isCurrentlyCheckedIn(records: AttendanceDTO[]) {
  const today = toDateInputValue(new Date())
  const latestTodayRecord = records
    .filter((record) => record.date === today)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]

  return latestTodayRecord?.type === "CHECK_IN"
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function toDateInputValue(date: Date) {
  return date.toISOString().split("T")[0]
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
}

function formatTime(value: string) {
  return value.slice(11, 16)
}

function formatAttendanceType(value: AttendanceDTO["type"]) {
  return value === "CHECK_IN" ? "Check in" : "Check out"
}

function formatAttendanceStatus(record: AttendanceDTO) {
  if (record.onTime === true) {
    return "On Time"
  }

  if (record.onTime === false) {
    return "Late"
  }

  return "Recorded"
}
