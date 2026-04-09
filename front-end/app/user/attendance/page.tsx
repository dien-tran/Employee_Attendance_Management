"use client"

import { useState, useMemo } from "react"
import { Chatbot } from '@/components/features/chatbot'
import { MotionPage, MotionSection, MotionTableRow, StaggerContainer, StaggerItem } from '@/components/features/motion'
import { attendanceRecords, getCurrentEmployee } from "@/lib/mock-data"
import { Calendar, Download, TrendingUp, Clock, CheckCircle2, XCircle } from "lucide-react"
import { MotionButton } from '@/components/features/motion'

export default function MyAttendancePage() {
  const currentEmployee = getCurrentEmployee()
  const [dateFilter, setDateFilter] = useState("")
  const [monthFilter, setMonthFilter] = useState("")

  const myRecords = useMemo(() => {
    return attendanceRecords
      .filter((r) => r.employeeId === currentEmployee.id)
      .filter((r) => {
        if (dateFilter && r.date !== dateFilter) return false
        if (monthFilter) {
          const recordMonth = r.date.substring(0, 7) // YYYY-MM
          if (recordMonth !== monthFilter) return false
        }
        return true
      })
  }, [currentEmployee.id, dateFilter, monthFilter])

  const stats = useMemo(() => {
    const total = myRecords.length
    const present = myRecords.filter((r) => r.status === "present").length
    const late = myRecords.filter((r) => r.status === "late").length
    const absent = myRecords.filter((r) => r.status === "absent").length
    const totalHours = myRecords.reduce((sum, r) => sum + (r.hoursWorked || 0), 0)
    const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 0

    return { total, present, late, absent, totalHours, attendanceRate }
  }, [myRecords])

  return (
    <>
      <MotionPage className="p-6 lg:p-8">
        {/* Header */}
        <MotionSection className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl">My Attendance</h1>
              <p className="mt-1 text-muted-foreground">
                View your personal attendance history and statistics
              </p>
            </div>
            <MotionButton variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Download Report
            </MotionButton>
          </div>
        </MotionSection>

        {/* Stats Cards */}
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StaggerItem>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.attendanceRate}%</p>
                  <p className="text-sm text-muted-foreground">Attendance Rate</p>
                </div>
              </div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.present}</p>
                  <p className="text-sm text-muted-foreground">Days Present</p>
                </div>
              </div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-scanner/10">
                  <Clock className="h-5 w-5 text-scanner" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.late}</p>
                  <p className="text-sm text-muted-foreground">Late Arrivals</p>
                </div>
              </div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.absent}</p>
                  <p className="text-sm text-muted-foreground">Days Absent</p>
                </div>
              </div>
            </div>
          </StaggerItem>
        </StaggerContainer>

        {/* Filters */}
        <MotionSection className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="month"
                value={monthFilter}
                onChange={(e) => {
                  setMonthFilter(e.target.value)
                  setDateFilter("") // Clear specific date when filtering by month
                }}
                placeholder="Filter by month"
                className="rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value)
                  setMonthFilter("") // Clear month when filtering by specific date
                }}
                className="rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {(dateFilter || monthFilter) && (
              <button
                onClick={() => {
                  setDateFilter("")
                  setMonthFilter("")
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </MotionSection>

        {/* Summary Card */}
        <StaggerContainer className="mb-6">
          <StaggerItem>
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">Total Hours Worked</h3>
                  <p className="text-sm text-muted-foreground">Based on {stats.total} recorded days</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-foreground">{stats.totalHours.toFixed(1)}h</p>
                  <p className="text-sm text-muted-foreground">
                    Avg: {stats.total > 0 ? (stats.totalHours / stats.total).toFixed(1) : 0}h/day
                  </p>
                </div>
              </div>
            </div>
          </StaggerItem>
        </StaggerContainer>

        {/* Table */}
        <MotionSection>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Check In
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Check Out
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Hours
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {myRecords.map((record, index) => (
                    <MotionTableRow key={record.id} index={index}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {new Date(record.date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(record.date).getFullYear()}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {record.checkIn || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {record.checkOut || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {record.hoursWorked ? `${record.hoursWorked}h` : "-"}
                      </td>
                      <td className="px-4 py-3">
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
                      </td>
                    </MotionTableRow>
                  ))}
                </tbody>
              </table>
            </div>

            {myRecords.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No attendance records found.</p>
                {(dateFilter || monthFilter) && (
                  <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters.</p>
                )}
              </div>
            )}
          </div>
        </MotionSection>
      </MotionPage>
      <Chatbot />
    </>
  )
}
