"use client"

import { useEffect, useState } from "react"
import { Chatbot } from '@/components/features/chatbot'
import { EmployeeAvatar } from '@/components/features/employee-avatar'
import { MotionPage, MotionSection, StaggerContainer, StaggerItem, MotionCard, MotionButton } from '@/components/features/motion'
import { ThemeToggle } from '@/components/features/theme-toggle'
import { useAuthStore } from "@/store/authStore"
import { profileService } from "@/services/profile.service"
import { toast } from "@/hooks/use-toast"
import { attendanceRecords } from "@/lib/mock-data"
import {
  Mail, Building2, Calendar, Clock, TrendingUp, Palette,
  Bell, Shield, User, ChevronRight, X, Save
} from "lucide-react"

export default function ProfilePage() {
  const { user, setUser } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    department: user?.department || "",
  })
  const [saving, setSaving] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      if (!user || profileLoaded) {
        return
      }

      try {
        const profile = await profileService.getMe()

        if (!isMounted) {
          return
        }

        setUser({
          ...user,
          id: profile.id,
          staffId: profile.staffId,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          department: profile.department,
          position: profile.position,
          phone: profile.phone,
        })
        setProfileLoaded(true)
      } catch {
        // Keep the persisted login profile if the detail endpoint is temporarily unavailable.
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [profileLoaded, setUser, user])

  // Use first mock employee as fallback if no user in store
  const currentEmployee = {
    name: user?.name || "Sarah Chen",
    email: user?.email || "sarah.chen@company.com",
    role: user?.role === "ADMIN" ? "System Administrator" : "Senior Developer",
    department: user?.department || "Engineering",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    id: user?.staffId || user?.id || "1",
  }

  const myRecords = attendanceRecords.filter((r) => r.employeeId === currentEmployee.id)
  const totalDays = myRecords.length
  const presentDays = myRecords.filter((r) => r.status === "present" || r.status === "late").length
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0
  const totalHours = myRecords.reduce((sum, r) => sum + (r.hoursWorked || 0), 0)

  const handleEdit = () => {
    setEditForm({
      name: user?.name || currentEmployee.name,
      phone: user?.phone || "",
      department: user?.department || currentEmployee.department,
    })
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!user) {
      return
    }

    setSaving(true)
    try {
      const updatedStaff = await profileService.updateMe({
        name: editForm.name,
        department: editForm.department,
        phone: editForm.phone,
      })

      setUser({
        ...user,
        id: updatedStaff?.id || user.id,
        staffId: updatedStaff?.staffId || user.staffId,
        name: updatedStaff?.name || editForm.name,
        department: updatedStaff?.department || editForm.department,
        phone: updatedStaff?.phone || editForm.phone,
        position: updatedStaff?.position || user.position,
      })

      toast({
        title: "Profile updated successfully",
        testId: "toast-success-msg",
      })
      setIsEditing(false)
    } catch (error) {
      toast({
        title: "Unable to update profile",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
        testId: "toast-error-msg",
      })
    } finally {
      setSaving(false)
    }
  }

  const settingsItems = [
    { icon: Bell, label: "Notifications", description: "Manage your notification preferences" },
    { icon: Shield, label: "Security", description: "Update password and security settings" },
    { icon: User, label: "Personal Info", description: "Edit your personal information" },
  ]

  return (
    <>
      <MotionPage className="p-6 lg:p-8">
        <MotionSection className="mb-8">
          <h1 className="text-2xl font-bold text-foreground lg:text-3xl">My Profile</h1>
          <p className="mt-1 text-muted-foreground">Manage your account settings and preferences</p>
        </MotionSection>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Card */}
          <StaggerContainer className="lg:col-span-1" delayChildren={0.1}>
            <StaggerItem>
              <MotionCard className="p-6">
                <div className="flex flex-col items-center text-center">
                  <EmployeeAvatar name={currentEmployee.name} image={currentEmployee.image} status="online" size="lg" />
                  <h2 className="mt-4 text-xl font-bold text-foreground">{currentEmployee.name}</h2>
                  <p className="text-muted-foreground">{currentEmployee.role}</p>
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" /> {currentEmployee.department}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" /> {currentEmployee.email}
                  </div>
                  <div className="w-full mt-6 pt-6 border-t border-border">
                    <MotionButton variant="outline" className="w-full" onClick={handleEdit} data-testid="profile-edit-btn">
                      Edit Profile
                    </MotionButton>
                  </div>
                </div>
              </MotionCard>
            </StaggerItem>
            <StaggerItem>
              <MotionCard className="p-6 mt-6">
                <h3 className="font-semibold text-foreground mb-4">Quick Stats</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" /> Attendance Rate
                    </div>
                    <span className="font-semibold text-success">{attendanceRate}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" /> Total Days
                    </div>
                    <span className="font-semibold text-foreground">{totalDays}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" /> Hours Worked
                    </div>
                    <span className="font-semibold text-foreground">{totalHours.toFixed(1)}h</span>
                  </div>
                </div>
              </MotionCard>
            </StaggerItem>
          </StaggerContainer>

          {/* Settings Section */}
          <StaggerContainer className="lg:col-span-2 space-y-6" delayChildren={0.2}>
            <StaggerItem>
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                      <Palette className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Appearance</h3>
                      <p className="text-sm text-muted-foreground">Toggle between light and dark mode</p>
                    </div>
                  </div>
                  <ThemeToggle />
                </div>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-6 py-4">
                  <h3 className="font-semibold text-foreground">Employee Information</h3>
                </div>
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between px-6 py-4">
                    <span className="text-sm text-muted-foreground">Employee ID</span>
                    <span className="font-medium text-foreground" data-testid="profile-employee-id">{currentEmployee.id}</span>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4">
                    <span className="text-sm text-muted-foreground">Full Name</span>
                    <span className="font-medium text-foreground" data-testid="profile-name-value">{currentEmployee.name}</span>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="font-medium text-foreground" data-testid="profile-email-value">{currentEmployee.email}</span>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4">
                    <span className="text-sm text-muted-foreground">Role</span>
                    <span className="font-medium text-foreground" data-testid="profile-role-value">{currentEmployee.role}</span>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4">
                    <span className="text-sm text-muted-foreground">Department</span>
                    <span className="font-medium text-foreground" data-testid="profile-department-value">{currentEmployee.department}</span>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4">
                    <span className="text-sm text-muted-foreground">Phone</span>
                    <span className="font-medium text-foreground" data-testid="profile-phone-value">{user?.phone || "Not provided"}</span>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4">
                    <span className="text-sm text-muted-foreground">Working Hours</span>
                    <span className="font-medium text-foreground">9:00 AM - 6:00 PM</span>
                  </div>
                </div>
              </div>
            </StaggerItem>

            <StaggerItem>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-6 py-4">
                  <h3 className="font-semibold text-foreground">Account Settings</h3>
                </div>
                <div className="divide-y divide-border">
                  {settingsItems.map((item) => (
                    <button key={item.label} className="flex w-full items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors text-left">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                          <item.icon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{item.label}</p>
                          <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </MotionPage>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="profile-modal-overlay">
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl" data-testid="profile-edit-modal">
            <button onClick={() => setIsEditing(false)} className="absolute right-4 top-4" data-testid="profile-close-modal"><X className="h-5 w-5" /></button>
            <h2 className="text-xl font-bold mb-6">Edit Profile</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Full Name</label>
                <input type="text" value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  data-testid="profile-name-input" />
              </div>
              <div>
                <label className="text-sm font-medium">Department</label>
                <input type="text" value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  data-testid="profile-department-input" />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <input type="text" value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  data-testid="profile-phone-input" placeholder="Enter phone number" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsEditing(false)}
                className="rounded-lg border border-input bg-background px-4 py-2 text-sm"
                data-testid="profile-cancel-edit">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-white flex items-center gap-2"
                data-testid="profile-save-submit">
                {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Chatbot />
    </>
  )
}
