"use client"

import { useEffect, useMemo, useState } from "react"
import { Chatbot } from '@/components/features/chatbot'
import { StatCard } from '@/components/features/stat-card'
import { EmployeeAvatar } from '@/components/features/employee-avatar'
import { MotionPage, MotionSection, StaggerContainer, StaggerItem } from '@/components/features/motion'
import { attendanceService, type AttendanceDTO } from "@/services/attendance.service"
import { staffService, type StaffDTO } from "@/services/staff.service"
import { Users, UserCheck, Clock, UserX, TrendingUp, CalendarCheck } from "lucide-react"

type ActivityStatus = "present" | "late" | "checkout"

interface ActivityItem {
  id: string
  employeeName: string
  message: string
  status: ActivityStatus
}

const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)

const toDateInputValue = (date: Date) => {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return offsetDate.toISOString().slice(0, 10)
}

const startOfWeek = (date: Date) => {
  const start = new Date(date)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  return start
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export default function AdminDashboardPage() {
  const today = useMemo(() => toDateInputValue(new Date()), [])
  const weekStart = useMemo(() => toDateInputValue(startOfWeek(new Date())), [])
  const [staffList, setStaffList] = useState<StaffDTO[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function loadDashboardData() {
      setIsLoading(true)
      setError("")

      try {
        const [staff, attendance] = await Promise.all([
          staffService.getAll(),
          attendanceService.getAttendanceByRange(weekStart, today),
        ])

        if (isMounted) {
          setStaffList(staff)
          setAttendanceRecords(attendance)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load dashboard data")
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadDashboardData()

    return () => {
      isMounted = false
    }
  }, [today, weekStart])

  const staffByStaffId = useMemo(() => {
    return new Map(staffList.map((staff) => [staff.staffId, staff]))
  }, [staffList])

  const activeStaff = useMemo(() => {
    return staffList.filter((staff) => staff.status === "ACTIVE")
  }, [staffList])

  const todayRecords = useMemo(() => {
    return attendanceRecords.filter((record) => record.date === today)
  }, [attendanceRecords, today])

  const todayCheckIns = useMemo(() => {
    return todayRecords.filter((record) => record.type === "CHECK_IN")
  }, [todayRecords])

  const checkedInStaffIds = useMemo(() => {
    return new Set(todayCheckIns.map((record) => record.staffId))
  }, [todayCheckIns])

  const checkedOutStaffIds = useMemo(() => {
    return new Set(todayRecords.filter((record) => record.type === "CHECK_OUT").map((record) => record.staffId))
  }, [todayRecords])

  const onlineStaff = useMemo(() => {
    return activeStaff.filter((staff) => checkedInStaffIds.has(staff.staffId) && !checkedOutStaffIds.has(staff.staffId))
  }, [activeStaff, checkedInStaffIds, checkedOutStaffIds])

  const stats = useMemo(() => {
    const totalEmployees = staffList.length
    const activeEmployees = activeStaff.length
    const presentToday = checkedInStaffIds.size
    const lateToday = todayCheckIns.filter((record) => record.onTime === false).length
    const onTimeToday = todayCheckIns.filter((record) => record.onTime === true).length
    const weekCheckIns = attendanceRecords.filter((record) => record.type === "CHECK_IN")
    const weekOnTime = weekCheckIns.filter((record) => record.onTime === true).length

    return {
      totalEmployees,
      activeEmployees,
      presentToday,
      lateToday,
      absentToday: Math.max(activeEmployees - presentToday, 0),
      attendanceRate: percent(presentToday, activeEmployees),
      onTimePercentage: percent(weekOnTime, weekCheckIns.length),
      todayOnTimePercentage: percent(onTimeToday, todayCheckIns.length),
    }
  }, [activeStaff.length, attendanceRecords, checkedInStaffIds.size, staffList.length, todayCheckIns])

  const recentActivity = useMemo<ActivityItem[]>(() => {
    return [...attendanceRecords]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5)
      .map((record) => {
        const staff = staffByStaffId.get(record.staffId)
        const isCheckIn = record.type === "CHECK_IN"
        const status: ActivityStatus = isCheckIn
          ? record.onTime === false
            ? "late"
            : "present"
          : "checkout"

        return {
          id: record.id,
          employeeName: staff?.name || record.staffId,
          message: `${isCheckIn ? "Checked in" : "Checked out"} at ${formatTime(record.timestamp)}`,
          status,
        }
      })
  }, [attendanceRecords, staffByStaffId])

  return (
    <>
      <MotionPage className="p-6 lg:p-8">
        {/* Header */}
        <MotionSection className="mb-8">
          <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Admin Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Overview of today&apos;s attendance and employee activity
          </p>
        </MotionSection>

        {error && (
          <MotionSection className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </MotionSection>
        )}

        {/* Stats Grid */}
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StaggerItem>
            <StatCard
              title="Total Employees"
              value={stats.totalEmployees}
              icon={Users}
              accentColor="default"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Present Today"
              value={stats.presentToday}
              icon={UserCheck}
              trend={{ value: stats.attendanceRate, label: "attendance rate", positive: true }}
              accentColor="success"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Late Arrivals"
              value={stats.lateToday}
              icon={Clock}
              trend={{ value: stats.todayOnTimePercentage, label: "on-time today", positive: true }}
              accentColor="scanner"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Absent Today"
              value={stats.absentToday}
              icon={UserX}
              trend={{ value: percent(stats.absentToday, stats.activeEmployees), label: "absence rate", positive: false }}
              accentColor="destructive"
            />
          </StaggerItem>
        </StaggerContainer>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Activity */}
          <StaggerContainer className="lg:col-span-2 rounded-xl border border-border bg-card p-6" delayChildren={0.3}>
            <StaggerItem>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
                  <p className="text-sm text-muted-foreground">Latest check-ins and check-outs</p>
                </div>
                <CalendarCheck className="h-5 w-5 text-muted-foreground" />
              </div>
            </StaggerItem>
            
            <div className="space-y-4">
              {isLoading && (
                <div className="py-10 text-center text-sm text-muted-foreground">Loading real attendance data...</div>
              )}

              {!isLoading && recentActivity.length === 0 && (
                <div className="py-10 text-center text-sm text-muted-foreground">No attendance activity found for this week.</div>
              )}

              {!isLoading && recentActivity.map((record) => (
                <StaggerItem key={record.id}>
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <EmployeeAvatar
                      name={record.employeeName}
                      status={record.status === "checkout" ? "offline" : record.status === "late" ? "away" : "online"}
                      size="md"
                    />
                      <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {record.employeeName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {record.message}
                      </p>
                    </div>
                      <div className="text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          record.status === "present"
                            ? "bg-success/10 text-success"
                            : record.status === "late"
                            ? "bg-scanner/10 text-scanner"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {record.status === "checkout" ? "Checkout" : record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>

          {/* Quick Stats / On-Time Rate */}
          <StaggerContainer className="rounded-xl border border-border bg-card p-6" delayChildren={0.4}>
            <StaggerItem>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Performance</h2>
                  <p className="text-sm text-muted-foreground">This week&apos;s metrics</p>
                </div>
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
            </StaggerItem>

            <div className="space-y-6">
              <StaggerItem>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">On-Time Rate</span>
                    <span className="text-sm font-medium text-foreground">{stats.onTimePercentage}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-success rounded-full transition-all duration-1000"
                      style={{ width: `${stats.onTimePercentage}%` }}
                    />
                  </div>
                </div>
              </StaggerItem>

              <StaggerItem>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Attendance Rate</span>
                    <span className="text-sm font-medium text-foreground">{stats.attendanceRate}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-scanner rounded-full transition-all duration-1000"
                      style={{ width: `${stats.attendanceRate}%` }}
                    />
                  </div>
                </div>
              </StaggerItem>

              <StaggerItem>
                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-medium text-foreground mb-3">Online Now</h3>
                  <div className="flex -space-x-2">
                    {onlineStaff
                      .slice(0, 5)
                      .map((employee) => (
                        <EmployeeAvatar
                          key={employee.id}
                          name={employee.name}
                          size="sm"
                          status="online"
                          className="ring-2 ring-card"
                        />
                      ))}
                    {onlineStaff.length > 5 && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-card">
                        +{onlineStaff.length - 5}
                      </div>
                    )}
                    {!isLoading && onlineStaff.length === 0 && (
                      <span className="text-sm text-muted-foreground">No one is checked in right now.</span>
                    )}
                  </div>
                </div>
              </StaggerItem>
            </div>
          </StaggerContainer>
        </div>
      </MotionPage>
      <Chatbot />
    </>
  )
}
