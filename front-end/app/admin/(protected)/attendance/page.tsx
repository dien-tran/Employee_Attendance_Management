"use client"

import { useState, useMemo } from "react"
import { Chatbot } from '@/components/features/chatbot'
import { MotionPage, MotionSection, MotionTableRow } from '@/components/features/motion'
import { EmployeeAvatar } from '@/components/features/employee-avatar'
import { attendanceRecords, employees } from "@/lib/mock-data"
import { Calendar, Search, Filter, Download } from "lucide-react"
import { MotionButton } from '@/components/features/motion'

type StatusFilter = "all" | "present" | "late" | "absent" | "half-day"

export default function AdminAttendancePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [dateFilter, setDateFilter] = useState("")

  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter((record) => {
      const matchesSearch = record.employeeName
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || record.status === statusFilter
      const matchesDate = !dateFilter || record.date === dateFilter

      return matchesSearch && matchesStatus && matchesDate
    })
  }, [searchQuery, statusFilter, dateFilter])

  const statusCounts = useMemo(() => {
    const today = new Date().toISOString().split("T")[0]
    const todayRecords = attendanceRecords.filter((r) => r.date === today)
    return {
      present: todayRecords.filter((r) => r.status === "present").length,
      late: todayRecords.filter((r) => r.status === "late").length,
      absent: todayRecords.filter((r) => r.status === "absent").length,
      halfDay: todayRecords.filter((r) => r.status === "half-day").length,
    }
  }, [])

  return (
    <>
      <MotionPage className="p-6 lg:p-8">
        {/* Header */}
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

        {/* Quick Stats */}
        <MotionSection className="mb-6">
          <div className="flex flex-wrap gap-3">
            <button
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
              onClick={() => setStatusFilter("present")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === "present"
                  ? "bg-success text-success-foreground"
                  : "bg-success/10 text-success hover:bg-success/20"
              }`}
            >
              Present ({statusCounts.present})
            </button>
            <button
              onClick={() => setStatusFilter("late")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === "late"
                  ? "bg-scanner text-scanner-foreground"
                  : "bg-scanner/10 text-scanner hover:bg-scanner/20"
              }`}
            >
              Late ({statusCounts.late})
            </button>
            <button
              onClick={() => setStatusFilter("absent")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === "absent"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-destructive/10 text-destructive hover:bg-destructive/20"
              }`}
            >
              Absent ({statusCounts.absent})
            </button>
          </div>
        </MotionSection>

        {/* Filters */}
        <MotionSection className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by employee name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
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

        {/* Table */}
        <MotionSection>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                      Employee
                    </th>
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
                  {filteredRecords.slice(0, 20).map((record, index) => {
                    const employee = employees.find((e) => e.id === record.employeeId)
                    return (
                      <MotionTableRow key={record.id} index={index}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <EmployeeAvatar
                              name={record.employeeName}
                              image={employee?.image}
                              size="sm"
                            />
                            <span className="font-medium text-foreground">
                              {record.employeeName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {new Date(record.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
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
                    )
                  })}
                </tbody>
              </table>
            </div>

            {filteredRecords.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
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
