"use client"

import { useEffect, useMemo, useState } from "react"
import { Chatbot } from '@/components/features/chatbot'
import { MotionPage, MotionSection, MotionTableRow } from '@/components/features/motion'
import { EmployeeAvatar } from '@/components/features/employee-avatar'
import { attendanceService, type AttendanceDTO } from '@/services/attendance.service'
import { staffService, type StaffDTO } from '@/services/staff.service'
import { Calendar, Search, Filter, Download } from "lucide-react"
import { MotionButton } from '@/components/features/motion'

type StatusFilter = "all" | "on-time" | "late" | "recorded"

export default function AdminAttendancePage() {
  const today = new Date().toISOString().split("T")[0]
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [dateFilter, setDateFilter] = useState(today)
  const [records, setRecords] = useState<AttendanceDTO[]>([])
  const [staffList, setStaffList] = useState<StaffDTO[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let isMounted = true

    async function loadAttendance() {
      setIsLoading(true)
      setError("")

      try {
        const [attendance, staff] = await Promise.all([
          attendanceService.getAttendanceByRange(dateFilter, dateFilter),
          staffService.getAll(),
        ])

        if (isMounted) {
          setRecords(attendance)
          setStaffList(staff)
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
  }, [dateFilter])

  const staffByStaffId = useMemo(() => {
    return new Map(staffList.map((staff) => [staff.staffId, staff]))
  }, [staffList])

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const staff = staffByStaffId.get(record.staffId)
      const searchable = `${staff?.name ?? ""} ${staff?.email ?? ""} ${record.staffId}`.toLowerCase()
      const matchesSearch = searchable.includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "on-time" && record.onTime === true)
        || (statusFilter === "late" && record.onTime === false)
        || (statusFilter === "recorded" && record.onTime == null)

      return matchesSearch && matchesStatus
    })
  }, [records, searchQuery, statusFilter, staffByStaffId])

  const statusCounts = useMemo(() => {
    return {
      onTime: records.filter((r) => r.onTime === true).length,
      late: records.filter((r) => r.onTime === false).length,
      recorded: records.filter((r) => r.onTime == null).length,
    }
  }, [records])

  return (
    <>
      <MotionPage className="p-6 lg:p-8">
        <MotionSection className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Attendance Records</h1>
              <p className="mt-1 text-muted-foreground">
                View and manage all employee attendance history
              </p>
            </div>
            <MotionButton variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </MotionButton>
          </div>
        </MotionSection>

        <MotionSection className="mb-6">
          <div className="flex flex-wrap gap-3">
            <button
              data-testid="admin-attendance-filter-all"
              onClick={() => setStatusFilter("all")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              All Records
            </button>
            <button
              data-testid="admin-attendance-filter-on-time"
              onClick={() => setStatusFilter("on-time")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === "on-time"
                  ? "bg-success text-success-foreground"
                  : "bg-success/10 text-success hover:bg-success/20"
              }`}
            >
              On Time ({statusCounts.onTime})
            </button>
            <button
              data-testid="admin-attendance-filter-late"
              onClick={() => setStatusFilter("late")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === "late"
                  ? "bg-scanner text-scanner-foreground"
                  : "bg-scanner/10 text-scanner hover:bg-scanner/20"
              }`}
            >
              Late ({statusCounts.late})
            </button>
          </div>
        </MotionSection>

        <MotionSection className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                data-testid="admin-attendance-search-input"
                type="text"
                placeholder="Search by employee name, email, or staff id..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                data-testid="admin-attendance-date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button className="flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
              <Filter className="h-4 w-4" />
              More Filters
            </button>
          </div>
        </MotionSection>

        <MotionSection>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="admin-attendance-table">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Employee</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Staff ID</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Time</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.slice(0, 20).map((record, index) => {
                    const staff = staffByStaffId.get(record.staffId)
                    const employeeName = staff?.name ?? record.staffId

                    return (
                      <MotionTableRow key={record.id} index={index} data-testid={`admin-attendance-row-${record.id}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <EmployeeAvatar name={employeeName} size="sm" />
                            <span className="font-medium text-foreground" data-testid={`admin-attendance-employee-${record.id}`}>
                              {employeeName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground" data-testid={`admin-attendance-staff-id-${record.id}`}>
                          {record.staffId}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground" data-testid={`admin-attendance-date-${record.id}`}>
                          {formatDate(record.date)}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground" data-testid={`admin-attendance-time-${record.id}`}>
                          {formatTime(record.timestamp)}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground" data-testid={`admin-attendance-type-${record.id}`}>
                          {formatType(record.type)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge record={record} />
                        </td>
                      </MotionTableRow>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {isLoading && (
              <div data-testid="admin-attendance-loading-state" className="py-12 text-center text-muted-foreground">
                Loading attendance records...
              </div>
            )}

            {!isLoading && error && (
              <div data-testid="admin-attendance-error-state" className="py-12 text-center text-destructive">
                {error}
              </div>
            )}

            {!isLoading && !error && filteredRecords.length === 0 && (
              <div data-testid="admin-attendance-empty-state" className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">No records found matching your filters.</p>
              </div>
            )}

            {filteredRecords.length > 20 && (
              <div className="border-t border-border p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Showing 20 of {filteredRecords.length} records
                </p>
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
      data-testid={`admin-attendance-status-${record.id}`}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
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
