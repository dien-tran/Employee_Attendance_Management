"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Chatbot } from '@/components/features/chatbot'
import { MotionPage, MotionSection, StaggerContainer, StaggerItem, MotionCard } from '@/components/features/motion'
import { EmployeeAvatar } from '@/components/features/employee-avatar'
import { staffService, type StaffDTO, type StaffCreationRequest } from "@/services/staff.service"
import { toast } from "@/hooks/use-toast"
import { Search, UserPlus, Mail, Building2, LayoutGrid, List, X, Shield } from "lucide-react"
import { MotionButton } from '@/components/features/motion'

type ViewMode = "grid" | "list"

export default function AdminEmployeesPage() {
  const [staffList, setStaffList] = useState<StaffDTO[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [newStaff, setNewStaff] = useState<StaffCreationRequest>({
    name: "", email: "", dob: "", department: "", position: "", phone: "",
    identityCard: "", bankAccount: "", bankName: "", role: "USER",
  })

  const loadStaff = useCallback(async () => {
    setIsLoading(true)
    try { const data = await staffService.getAll(); setStaffList(data) }
    catch (err) { console.error("Failed to load staff:", err) }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { loadStaff() }, [loadStaff])

  const departments = useMemo(() => {
    const depts = new Set(staffList.map((e) => e.department))
    return ["all", ...Array.from(depts)]
  }, [staffList])

  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      const q = searchQuery.toLowerCase()
      return (
        (staff.name.toLowerCase().includes(q) || staff.email.toLowerCase().includes(q) ||
         (staff.staffId?.toLowerCase().includes(q)) || (staff.position?.toLowerCase().includes(q))) &&
        (departmentFilter === "all" || staff.department === departmentFilter)
      )
    })
  }, [searchQuery, departmentFilter, staffList])

  const handleToggleStatus = async (staff: StaffDTO) => {
    const ns = staff.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    try {
      await staffService.updateStatus(staff.id, ns)
      setStaffList((prev) => prev.map((s) => s.id === staff.id ? { ...s, status: ns } : s))
    } catch (err) { console.error("Failed to update status:", err) }
  }

  const handleAddStaff = async () => {
    setErrorMsg("")
    if (!newStaff.name || !newStaff.email || !newStaff.department) {
      setErrorMsg("Name, Email, and Department are required"); return
    }
    try {
      const created = await staffService.create(newStaff)
      setStaffList((prev) => [created, ...prev])
      toast({
        title: "Employee created successfully",
        description: `${created.name} has been added to the employee list.`,
        testId: "toast-success-msg",
      })
      setShowAddModal(false)
      setNewStaff({ name: "", email: "", dob: "", department: "", position: "", phone: "",
        identityCard: "", bankAccount: "", bankName: "", role: "USER" })
    } catch (err: any) { setErrorMsg(err.message || "Failed to create staff") }
  }

  const updateField = (field: keyof StaffCreationRequest, value: string) => {
    setNewStaff((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <>
      <MotionPage className="p-6 lg:p-8">
        <MotionSection className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Employees</h1>
              <p className="mt-1 text-muted-foreground">Manage your team members and their information</p>
            </div>
            <MotionButton variant="default" className="gap-2" onClick={() => setShowAddModal(true)} data-testid="employee-add-btn">
              <UserPlus className="h-4 w-4" /> Add Employee
            </MotionButton>
          </div>
        </MotionSection>

        <MotionSection className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder="Search employees..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-72 rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm"
                  data-testid="employee-search-input" />
              </div>
              <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}
                className="rounded-lg border border-input bg-background px-4 py-2 text-sm"
                data-testid="employee-filter-department">
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept === "all" ? "All Departments" : dept}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-input p-1">
              <button onClick={() => setViewMode("grid")}
                className={`p-2 rounded-md ${viewMode === "grid" ? "bg-muted" : ""}`}
                data-testid="employee-view-grid"><LayoutGrid className="h-4 w-4" /></button>
              <button onClick={() => setViewMode("list")}
                className={`p-2 rounded-md ${viewMode === "list" ? "bg-muted" : ""}`}
                data-testid="employee-view-list"><List className="h-4 w-4" /></button>
            </div>
          </div>
        </MotionSection>

        {isLoading ? (
          <div className="flex items-center justify-center py-20" data-testid="employee-loading-state">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {viewMode === "grid" ? (
              <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredStaff.map((staff) => (
                  <StaggerItem key={staff.id}>
                    <MotionCard className="p-0 overflow-hidden" data-testid={`staff-card-${staff.staffId || staff.id}`}>
                      <div className="p-6">
                        <div className="flex flex-col items-center text-center">
                          <EmployeeAvatar name={staff.name} status={staff.status === "ACTIVE" ? "online" : "offline"} size="lg" />
                          <h3 className="mt-4 font-semibold" data-testid={`staff-name-${staff.staffId || staff.id}`}>{staff.name}</h3>
                          <p className="text-sm text-muted-foreground">{staff.position || "N/A"}</p>
                          <p className="text-xs text-muted-foreground mt-1">{staff.department} - {staff.staffId}</p>
                        </div>
                      </div>
                      <div className="border-t border-border bg-muted/30 px-6 py-3 space-y-2">
                        <a href={`mailto:${staff.email}`} className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" /><span className="truncate">{staff.email}</span>
                        </a>
                        <button onClick={() => handleToggleStatus(staff)}
                          data-testid={`staff-toggle-status-${staff.staffId || staff.id}`}
                          className={`w-full flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium ${
                            staff.status === "ACTIVE" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                          <Shield className="h-3 w-3" />
                          {staff.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </MotionCard>
                  </StaggerItem>
                ))}
              </StaggerContainer>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-3 text-left text-sm font-medium">Employee</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Staff ID</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Position</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Department</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStaff.map((staff) => (
                        <tr key={staff.id} className="border-b border-border hover:bg-muted/50" data-testid={`staff-row-${staff.staffId || staff.id}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <EmployeeAvatar name={staff.name} size="sm" />
                              <span className="font-medium" data-testid={`staff-name-${staff.staffId || staff.id}`}>{staff.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{staff.staffId}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{staff.position || "N/A"}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{staff.department}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{staff.email}</td>
                          <td className="px-4 py-3">
                            <span data-testid={`status-badge-${staff.status}`} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              staff.status === "ACTIVE" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${staff.status === "ACTIVE" ? "bg-success" : "bg-destructive"}`} />
                              {staff.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleToggleStatus(staff)}
                              data-testid={`staff-toggle-status-${staff.staffId || staff.id}`}
                              className={`text-xs font-medium px-2 py-1 rounded ${
                                staff.status === "ACTIVE" ? "text-destructive" : "text-success"}`}>
                              {staff.status === "ACTIVE" ? "Deactivate" : "Activate"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </MotionPage>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="employee-modal-overlay">
          <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl" data-testid="employee-create-modal">
            <button onClick={() => { setShowAddModal(false); setErrorMsg("") }}
              className="absolute right-4 top-4" data-testid="employee-close-modal"><X className="h-5 w-5" /></button>
            <h2 className="text-xl font-bold mb-6">Add New Employee</h2>
            {errorMsg && <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive" data-testid="employee-error-msg">{errorMsg}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm font-medium">Full Name *</label>
                <input type="text" value={newStaff.name} onChange={(e) => updateField("name", e.target.value)}
                  data-testid="employee-name-input"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Nguyen Van A" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Email *</label>
                <input type="email" value={newStaff.email} onChange={(e) => updateField("email", e.target.value)}
                  data-testid="employee-email-input"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="a.nguyen@company.com" />
              </div>
              <div>
                <label className="text-sm font-medium">Department *</label>
                <select value={newStaff.department} onChange={(e) => updateField("department", e.target.value)}
                  data-testid="employee-department-select"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select</option>
                  {["IT","HR","Sales","Marketing","Design","Finance","Product","Analytics"].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Position</label>
                <input type="text" value={newStaff.position} onChange={(e) => updateField("position", e.target.value)}
                  data-testid="employee-position-input"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Developer" />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <input type="text" value={newStaff.phone} onChange={(e) => updateField("phone", e.target.value)}
                  data-testid="employee-phone-input"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="0912345678" />
              </div>
              <div>
                <label className="text-sm font-medium">Date of Birth</label>
                <input type="date" value={newStaff.dob} onChange={(e) => updateField("dob", e.target.value)}
                  data-testid="employee-dob-input"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium">Identity Card</label>
                <input type="text" value={newStaff.identityCard} onChange={(e) => updateField("identityCard", e.target.value)}
                  data-testid="employee-identity-card-input"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="079098001234" />
              </div>
              <div>
                <label className="text-sm font-medium">Bank Account</label>
                <input type="text" value={newStaff.bankAccount} onChange={(e) => updateField("bankAccount", e.target.value)}
                  data-testid="employee-bank-account-input"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="9876543210" />
              </div>
              <div>
                <label className="text-sm font-medium">Bank Name</label>
                <input type="text" value={newStaff.bankName} onChange={(e) => updateField("bankName", e.target.value)}
                  data-testid="employee-bank-name-input"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" placeholder="Techcombank" />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <select value={newStaff.role} onChange={(e) => updateField("role", e.target.value)}
                  data-testid="employee-role-select"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                  <option value="USER">User</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setShowAddModal(false); setErrorMsg("") }}
                className="rounded-lg border border-input bg-background px-4 py-2 text-sm"
                data-testid="employee-cancel-create">Cancel</button>
              <button onClick={handleAddStaff}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-white"
                data-testid="employee-create-submit">Create Employee</button>
            </div>
          </div>
        </div>
      )}
      <Chatbot />
    </>
  )
}
