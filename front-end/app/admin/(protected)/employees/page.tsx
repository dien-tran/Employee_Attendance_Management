"use client"

import { useState, useMemo } from "react"
import { Chatbot } from '@/components/features/chatbot'
import { MotionPage, MotionSection, StaggerContainer, StaggerItem, MotionCard } from '@/components/features/motion'
import { EmployeeAvatar } from '@/components/features/employee-avatar'
import { employees } from "@/lib/mock-data"
import { Search, UserPlus, Mail, Building2, LayoutGrid, List } from "lucide-react"
import { MotionButton } from '@/components/features/motion'

type ViewMode = "grid" | "list"

export default function AdminEmployeesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")

  const departments = useMemo(() => {
    const depts = new Set(employees.map((e) => e.department))
    return ["all", ...Array.from(depts)]
  }, [])

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const matchesSearch =
        employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.role.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesDepartment =
        departmentFilter === "all" || employee.department === departmentFilter

      return matchesSearch && matchesDepartment
    })
  }, [searchQuery, departmentFilter])

  return (
    <>
      <MotionPage className="p-6 lg:p-8">
        {/* Header */}
        <MotionSection className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Employees</h1>
              <p className="mt-1 text-muted-foreground">
                Manage your team members and their information
              </p>
            </div>
            <MotionButton variant="default" className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add Employee
            </MotionButton>
          </div>
        </MotionSection>

        {/* Filters */}
        <MotionSection className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="rounded-lg border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === "all" ? "All Departments" : dept}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-input p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center justify-center rounded-md p-2 transition-colors ${
                  viewMode === "grid"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center justify-center rounded-md p-2 transition-colors ${
                  viewMode === "list"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </MotionSection>

        {/* Employee Grid/List */}
        {viewMode === "grid" ? (
          <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredEmployees.map((employee) => (
              <StaggerItem key={employee.id}>
                <MotionCard className="p-0 overflow-hidden">
                  <div className="p-6">
                    <div className="flex flex-col items-center text-center">
                      <EmployeeAvatar
                        name={employee.name}
                        image={employee.image}
                        status={employee.status}
                        size="lg"
                      />
                      <h3 className="mt-4 font-semibold text-foreground">{employee.name}</h3>
                      <p className="text-sm text-muted-foreground">{employee.role}</p>
                      <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        {employee.department}
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-border bg-muted/30 px-6 py-3">
                    <a
                      href={`mailto:${employee.email}`}
                      className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{employee.email}</span>
                    </a>
                  </div>
                </MotionCard>
              </StaggerItem>
            ))}
          </StaggerContainer>
        ) : (
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
                        Role
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                        Department
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((employee) => (
                      <tr
                        key={employee.id}
                        className="border-b border-border hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <EmployeeAvatar
                              name={employee.name}
                              image={employee.image}
                              size="sm"
                            />
                            <span className="font-medium text-foreground">
                              {employee.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {employee.role}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {employee.department}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {employee.email}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              employee.status === "online"
                                ? "bg-success/10 text-success"
                                : employee.status === "away"
                                ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500"
                                : employee.status === "busy"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                employee.status === "online"
                                  ? "bg-success"
                                  : employee.status === "away"
                                  ? "bg-yellow-500"
                                  : employee.status === "busy"
                                  ? "bg-destructive"
                                  : "bg-muted-foreground"
                              }`}
                            />
                            {employee.status.charAt(0).toUpperCase() + employee.status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </MotionSection>
        )}

        {filteredEmployees.length === 0 && (
          <MotionSection>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">No employees found matching your search.</p>
            </div>
          </MotionSection>
        )}
      </MotionPage>
      <Chatbot />
    </>
  )
}
