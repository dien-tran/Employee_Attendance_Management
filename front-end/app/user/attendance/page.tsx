"use client"

import { useEffect, useMemo, useState } from "react"
import { Chatbot } from '@/components/features/chatbot'
import { MotionPage, MotionSection, MotionTableRow, StaggerContainer, StaggerItem } from '@/components/features/motion'
import { attendanceService, type AttendanceDTO } from '@/services/attendance.service'
import { Calendar, Download, TrendingUp, Clock, CheckCircle2, XCircle } from "lucide-react"
import { MotionButton } from '@/components/features/motion'

export default function MyAttendancePage() {
  const today = new Date().toISOString().split("T")[0]
  const currentMonth = today.substring(0, 7)
  const [dateFilter, setDateFilter] = useState("")
  const [monthFilter, setMonthFilter] = useState(currentMonth)
  const [records, setRecords] = useState<AttendanceDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function loadAttendance() {
      setIsLoading(true)
      setError("")

      try {
        const { startDate, endDate } = getDateRange(dateFilter, monthFilter)
        const data = await attendanceService.getMyAttendance(startDate, endDate)
        if (isMounted) {
          setRecords(data)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load attendance records")
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadAttendance()

    return () => {
      isMounted = false
    }
  }, [dateFilter, monthFilter])

  const stats = useMemo(() => {
    const total = records.length
    const checkIns = records.filter((r) => r.type === "CHECK_IN").length
    const onTime = records.filter((r) => r.onTime === true).length
    const late = records.filter((r) => r.onTime === false).length
    const onTimeRate = total > 0 ? Math.round((onTime / total) * 100) : 0

    return { total, checkIns, onTime, late, onTimeRate }
  }, [records])

  return (
    <>
      <MotionPage className="p-6 lg:p-8">
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

        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StaggerItem>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.onTimeRate}%</p>
                  <p className="text-sm text-muted-foreground">On-time Rate</p>
                </div>
              </div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.checkIns}</p>
                  <p className="text-sm text-muted-foreground">Check-ins</p>
                </div>
              </div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-scanner/10">
                  <Clock className="h-5 w-5 text-scanner" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.late}</p>
                  <p className="text-sm text-muted-foreground">Late Events</p>
                </div>
              </div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Events</p>
                </div>
              </div>
            </div>
          </StaggerItem>
        </StaggerContainer>

        <MotionSection className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                data-testid="attendance-month-filter"
                type="month"
                value={monthFilter}
                onChange={(e) => {
                  setMonthFilter(e.target.value)
                  setDateFilter("")
                }}
                className="rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                data-testid="attendance-date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value)
                  setMonthFilter("")
                }}
                className="rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {(dateFilter || monthFilter) && (
              <button
                data-testid="attendance-clear-filters"
                onClick={() => {
                  setDateFilter("")
                  setMonthFilter(currentMonth)
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        </MotionSection>

        <MotionSection>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="attendance-history-table">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Time</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record, index) => (
                    <MotionTableRow key={record.id} index={index} data-testid={`attendance-row-${record.id}`}>
                      <td className="px-4 py-3 text-sm text-muted-foreground" data-testid={`attendance-date-${record.id}`}>
                        {formatDate(record.date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground" data-testid={`attendance-time-${record.id}`}>
                        {formatTime(record.timestamp)}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground" data-testid={`attendance-type-${record.id}`}>
                        {formatType(record.type)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge record={record} />
                      </td>
                    </MotionTableRow>
                  ))}
                </tbody>
              </table>
            </div>

            {isLoading && (
              <div data-testid="attendance-loading-state" className="py-12 text-center text-muted-foreground">
                Loading attendance records...
              </div>
            )}

            {!isLoading && error && (
              <div data-testid="attendance-error-state" className="py-12 text-center text-destructive">
                {error}
              </div>
            )}

            {!isLoading && !error && records.length === 0 && (
              <div data-testid="attendance-empty-state" className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No attendance records found.</p>
              </div>
            )}
          </div>
        </MotionSection>
      </MotionPage>
      <Chatbot />
    </>
  )
}

function StatusBadge({ record }: { record: AttendanceDTO }) {
  const label = record.onTime === true ? "On Time" : record.onTime === false ? "Late" : "Recorded"
  const className = record.onTime === true
    ? "bg-success/10 text-success"
    : record.onTime === false
      ? "bg-scanner/10 text-scanner"
      : "bg-muted text-muted-foreground"

  return (
    <span
      data-testid={`attendance-status-${record.id}`}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}

function getDateRange(dateFilter: string, monthFilter: string) {
  if (dateFilter) {
    return { startDate: dateFilter, endDate: dateFilter }
  }

  if (monthFilter) {
    const [year, month] = monthFilter.split("-").map(Number)
    const lastDay = new Date(year, month, 0).getDate().toString().padStart(2, "0")
    const endDate = `${monthFilter}-${lastDay}`
    return { startDate: `${monthFilter}-01`, endDate }
  }

  return {}
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(value: string) {
  return value.slice(11, 16)
}

function formatType(value: AttendanceDTO["type"]) {
  return value === "CHECK_IN" ? "Check In" : "Check Out"
}
