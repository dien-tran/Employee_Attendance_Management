"use client"

import { Chatbot } from '@/components/features/chatbot'
import { StatCard } from '@/components/features/stat-card'
import { EmployeeAvatar } from '@/components/features/employee-avatar'
import { MotionPage, MotionSection, StaggerContainer, StaggerItem } from '@/components/features/motion'
import { getDashboardStats, employees, attendanceRecords } from "@/lib/mock-data"
import { Users, UserCheck, Clock, UserX, TrendingUp, CalendarCheck } from "lucide-react"

export default function AdminDashboardPage() {
  const stats = getDashboardStats()
  const recentActivity = attendanceRecords.slice(0, 5)

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

        {/* Stats Grid */}
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StaggerItem>
            <StatCard
              title="Total Employees"
              value={stats.totalEmployees}
              icon={Users}
              trend={{ value: 5, label: "from last month", positive: true }}
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
              trend={{ value: 2, label: "from yesterday", positive: false }}
              accentColor="scanner"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Absent Today"
              value={stats.absentToday}
              icon={UserX}
              trend={{ value: 1, label: "from yesterday", positive: true }}
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
              {recentActivity.map((record) => {
                const employee = employees.find((e) => e.id === record.employeeId)
                return (
                  <StaggerItem key={record.id}>
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <EmployeeAvatar
                        name={record.employeeName}
                        image={employee?.image}
                        status={employee?.status}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {record.employeeName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {record.checkIn ? `Checked in at ${record.checkIn}` : "Not checked in"}
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
                      </div>
                    </div>
                  </StaggerItem>
                )
              })}
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
                    {employees
                      .filter((e) => e.status === "online")
                      .slice(0, 5)
                      .map((employee) => (
                        <EmployeeAvatar
                          key={employee.id}
                          name={employee.name}
                          image={employee.image}
                          size="sm"
                          className="ring-2 ring-card"
                        />
                      ))}
                    {employees.filter((e) => e.status === "online").length > 5 && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-card">
                        +{employees.filter((e) => e.status === "online").length - 5}
                      </div>
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
