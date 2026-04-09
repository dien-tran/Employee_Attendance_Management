"use client"

import { useState } from "react"
import { Chatbot } from '@/components/features/chatbot'
import { MotionPage, MotionSection, ToastContainer, type Toast } from '@/components/features/motion'
import { employees, type Employee } from "@/lib/mock-data"
import { Search, Upload, Trash2, Check, X, FileImage, UserCircle2 } from "lucide-react"

type EmployeeWithFaceData = Employee & { hasFaceData: boolean }

export default function AdminFaceDataPage() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  // Mock initial face data status (deterministic but varied)
  const [employeeData, setEmployeeData] = useState<EmployeeWithFaceData[]>(
    employees.map((e, idx) => ({ ...e, hasFaceData: idx % 3 !== 0 }))
  )

  const filteredEmployees = employeeData.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.role.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const showToast = (title: string, description: string, type: Toast["type"]) => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, title, description, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const handleUploadFake = (id: string) => {
    // In reality, this would open a file picker
    setEmployeeData(prev => prev.map(e => e.id === id ? { ...e, hasFaceData: true } : e))
    showToast("Face Data Registered", "Successfully uploaded & trained new face profile.", "success")
  }

  const handleDelete = (id: string) => {
    setEmployeeData(prev => prev.map(e => e.id === id ? { ...e, hasFaceData: false } : e))
    showToast("Face Data Deleted", "Removed face profile successfully. Employee must re-register.", "info")
  }

  const registeredCount = employeeData.filter(e => e.hasFaceData).length
  const pendingCount = employeeData.length - registeredCount

  return (
    <>
      <MotionPage className="p-6 lg:p-8">
        {/* Header */}
        <MotionSection className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Manage Face Data</h1>
              <p className="mt-1 text-muted-foreground">
                Register or remove facial recognition profiles
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm bg-muted/30 px-4 py-2 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span>{registeredCount} Yes</span>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-2">
                <X className="h-4 w-4 text-muted-foreground" />
                <span>{pendingCount} No</span>
              </div>
            </div>
          </div>
        </MotionSection>

        {/* Filters */}
        <MotionSection className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </MotionSection>

        {/* Simple Table */}
        <MotionSection>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-muted-foreground">Employee</th>
                    <th className="px-6 py-4 font-semibold text-muted-foreground">Role</th>
                    <th className="px-6 py-4 font-semibold text-muted-foreground">Has Data</th>
                    <th className="px-6 py-4 font-semibold text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                            {employee.image ? (
                              <img src={employee.image} alt={employee.name} className="h-full w-full object-cover" />
                            ) : (
                              <UserCircle2 className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{employee.name}</p>
                            <p className="text-xs text-muted-foreground">{employee.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {employee.role}
                      </td>
                      <td className="px-6 py-4">
                        {employee.hasFaceData ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/15 text-success text-xs font-semibold">
                            <Check className="h-3.5 w-3.5" /> Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-xs font-semibold">
                            <X className="h-3.5 w-3.5" /> No
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleUploadFake(employee.id)}
                            title="Upload Face Data"
                            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors disabled:opacity-50"
                          >
                            <Upload className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(employee.id)}
                            disabled={!employee.hasFaceData}
                            title="Delete Face Data"
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground disabled:hover:bg-transparent"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  
                  {filteredEmployees.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <FileImage className="h-10 w-10 text-muted-foreground mb-4 opacity-50 mx-auto" />
                        <p className="text-muted-foreground">No employees found matching your search.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </MotionSection>
      </MotionPage>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <Chatbot />
    </>
  )
}
