"use client"

import { useState, useEffect } from "react"
import { Chatbot } from '@/components/features/chatbot'
import { EmployeeAvatar } from '@/components/features/employee-avatar'
import { MotionPage, MotionSection, StaggerContainer, StaggerItem, MotionCard, MotionButton } from '@/components/features/motion'
import { employees, attendanceRecords, getCurrentEmployee } from "@/lib/mock-data"
import { Camera, CalendarDays, Clock, TrendingUp, CheckCircle2, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function EmployeeHomePage() {
  const currentEmployee = getCurrentEmployee()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isCheckedIn, setIsCheckedIn] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Get employee's recent attendance
  const myRecords = attendanceRecords
    .filter((r) => r.employeeId === currentEmployee.id)
    .slice(0, 5)

  // Calculate stats
  const totalDays = myRecords.length
  const presentDays = myRecords.filter((r) => r.status === "present").length
  const lateDays = myRecords.filter((r) => r.status === "late").length
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0

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
                  Welcome back, {currentEmployee.name.split(" ")[0]}!
                </h1>
                <p className="text-muted-foreground">
                  {currentEmployee.role} - {currentEmployee.department}
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
            <Link href="/user/check">
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
                  <p className="text-sm text-muted-foreground">Attendance Rate</p>
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
                  <p className="text-2xl font-bold text-foreground">{lateDays}</p>
                  <p className="text-sm text-muted-foreground">Late Days</p>
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
                  <p className="text-sm text-muted-foreground">Your last 5 check-ins</p>
                </div>
                <Link href="/user/attendance">
                  <MotionButton variant="ghost" size="sm">
                    View All
                  </MotionButton>
                </Link>
              </div>
            </StaggerItem>
            
            <div className="space-y-3">
              {myRecords.length > 0 ? (
                myRecords.map((record) => (
                  <StaggerItem key={record.id}>
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">
                          {new Date(record.date).toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {record.checkIn ? `${record.checkIn} - ${record.checkOut || "Still working"}` : "No check-in"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            record.status === "present"
                              ? "bg-success/10 text-success"
                              : record.status === "late"
                              ? "bg-scanner/10 text-scanner"
                              : record.status === "absent"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </span>
                        {record.hoursWorked && (
                          <p className="text-xs text-muted-foreground mt-1">{record.hoursWorked}h worked</p>
                        )}
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
                <p className="text-sm text-muted-foreground">{currentEmployee.role}</p>
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
