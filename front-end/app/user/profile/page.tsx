"use client"

import { Chatbot } from '@/components/features/chatbot'
import { EmployeeAvatar } from '@/components/features/employee-avatar'
import { MotionPage, MotionSection, StaggerContainer, StaggerItem, MotionCard, MotionButton } from '@/components/features/motion'
import { ThemeToggle } from '@/components/features/theme-toggle'
import { getCurrentEmployee, attendanceRecords } from "@/lib/mock-data"
import { 
  Mail, 
  Building2, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Palette,
  Bell,
  Shield,
  User,
  ChevronRight
} from "lucide-react"

export default function ProfilePage() {
  const currentEmployee = getCurrentEmployee()
  
  // Calculate stats
  const myRecords = attendanceRecords.filter((r) => r.employeeId === currentEmployee.id)
  const totalDays = myRecords.length
  const presentDays = myRecords.filter((r) => r.status === "present" || r.status === "late").length
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0
  const totalHours = myRecords.reduce((sum, r) => sum + (r.hoursWorked || 0), 0)

  const settingsItems = [
    { icon: Bell, label: "Notifications", description: "Manage your notification preferences" },
    { icon: Shield, label: "Security", description: "Update password and security settings" },
    { icon: User, label: "Personal Info", description: "Edit your personal information" },
  ]

  return (
    <>
      <MotionPage className="p-6 lg:p-8">
        {/* Header */}
        <MotionSection className="mb-8">
          <h1 className="text-2xl font-bold text-foreground lg:text-3xl">My Profile</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </MotionSection>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Card */}
          <StaggerContainer className="lg:col-span-1" delayChildren={0.1}>
            <StaggerItem>
              <MotionCard className="p-6">
                <div className="flex flex-col items-center text-center">
                  <EmployeeAvatar
                    name={currentEmployee.name}
                    image={currentEmployee.image}
                    status="online"
                    size="lg"
                  />
                  <h2 className="mt-4 text-xl font-bold text-foreground">{currentEmployee.name}</h2>
                  <p className="text-muted-foreground">{currentEmployee.role}</p>
                  
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    {currentEmployee.department}
                  </div>
                  
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {currentEmployee.email}
                  </div>

                  <div className="w-full mt-6 pt-6 border-t border-border">
                    <MotionButton variant="outline" className="w-full">
                      Edit Profile
                    </MotionButton>
                  </div>
                </div>
              </MotionCard>
            </StaggerItem>

            {/* Quick Stats */}
            <StaggerItem>
              <MotionCard className="p-6 mt-6">
                <h3 className="font-semibold text-foreground mb-4">Quick Stats</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      Attendance Rate
                    </div>
                    <span className="font-semibold text-success">{attendanceRate}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Total Days
                    </div>
                    <span className="font-semibold text-foreground">{totalDays}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Hours Worked
                    </div>
                    <span className="font-semibold text-foreground">{totalHours.toFixed(1)}h</span>
                  </div>
                </div>
              </MotionCard>
            </StaggerItem>
          </StaggerContainer>

          {/* Settings Section */}
          <StaggerContainer className="lg:col-span-2 space-y-6" delayChildren={0.2}>
            {/* Theme Card */}
            <StaggerItem>
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                      <Palette className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Appearance</h3>
                      <p className="text-sm text-muted-foreground">
                        Toggle between light and dark mode
                      </p>
                    </div>
                  </div>
                  <ThemeToggle />
                </div>
              </div>
            </StaggerItem>

            {/* Employee Details */}
            <StaggerItem>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-6 py-4">
                  <h3 className="font-semibold text-foreground">Employee Information</h3>
                </div>
                <div className="divide-y divide-border">
                  <div className="flex items-center justify-between px-6 py-4">
                    <span className="text-sm text-muted-foreground">Employee ID</span>
                    <span className="font-medium text-foreground">{currentEmployee.id}</span>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4">
                    <span className="text-sm text-muted-foreground">Full Name</span>
                    <span className="font-medium text-foreground">{currentEmployee.name}</span>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="font-medium text-foreground">{currentEmployee.email}</span>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4">
                    <span className="text-sm text-muted-foreground">Role</span>
                    <span className="font-medium text-foreground">{currentEmployee.role}</span>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4">
                    <span className="text-sm text-muted-foreground">Department</span>
                    <span className="font-medium text-foreground">{currentEmployee.department}</span>
                  </div>
                  <div className="flex items-center justify-between px-6 py-4">
                    <span className="text-sm text-muted-foreground">Working Hours</span>
                    <span className="font-medium text-foreground">9:00 AM - 6:00 PM</span>
                  </div>
                </div>
              </div>
            </StaggerItem>

            {/* Settings Items */}
            <StaggerItem>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-6 py-4">
                  <h3 className="font-semibold text-foreground">Account Settings</h3>
                </div>
                <div className="divide-y divide-border">
                  {settingsItems.map((item) => (
                    <button
                      key={item.label}
                      className="flex w-full items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors text-left"
                    >
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
      <Chatbot />
    </>
  )
}
