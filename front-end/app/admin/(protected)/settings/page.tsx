"use client"

import { Chatbot } from '@/components/features/chatbot'
import { MotionPage, MotionSection, StaggerContainer, StaggerItem, MotionButton } from '@/components/features/motion'
import { ThemeToggle } from '@/components/features/theme-toggle'
import { 
  Settings, 
  Bell, 
  Shield, 
  Database, 
  Palette,
  Clock,
  Building2,
  ChevronRight
} from "lucide-react"

const settingsGroups = [
  {
    title: "General",
    description: "Basic application settings",
    icon: Settings,
    items: [
      { label: "Company Information", description: "Update company name, logo, and details" },
      { label: "Working Hours", description: "Set default working hours and timezone" },
      { label: "Language & Region", description: "Configure language and date formats" },
    ],
  },
  {
    title: "Notifications",
    description: "Configure alert preferences",
    icon: Bell,
    items: [
      { label: "Email Notifications", description: "Attendance alerts and daily reports" },
      { label: "Push Notifications", description: "Real-time check-in/out alerts" },
      { label: "Slack Integration", description: "Connect with your Slack workspace" },
    ],
  },
  {
    title: "Security",
    description: "Privacy and access controls",
    icon: Shield,
    items: [
      { label: "Face Recognition Settings", description: "Sensitivity and verification options" },
      { label: "Two-Factor Authentication", description: "Add extra security to accounts" },
      { label: "Access Permissions", description: "Manage user roles and permissions" },
    ],
  },
  {
    title: "Data Management",
    description: "Backup and export options",
    icon: Database,
    items: [
      { label: "Export Data", description: "Download attendance records as CSV" },
      { label: "Backup Settings", description: "Configure automatic backups" },
      { label: "Data Retention", description: "Set how long to keep records" },
    ],
  },
]

export default function AdminSettingsPage() {
  return (
    <>
      <MotionPage className="p-6 lg:p-8">
        {/* Header */}
        <MotionSection className="mb-8">
          <h1 className="text-2xl font-bold text-foreground lg:text-3xl">Settings</h1>
          <p className="mt-1 text-muted-foreground">
            Manage system preferences and configurations
          </p>
        </MotionSection>

        {/* Theme Toggle Card */}
        <StaggerContainer className="mb-8" delayChildren={0.1}>
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
        </StaggerContainer>

        {/* Quick Stats */}
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8" delayChildren={0.2}>
          <StaggerItem>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-scanner/10">
                  <Building2 className="h-5 w-5 text-scanner" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Company</p>
                  <p className="font-semibold text-foreground">Acme Inc.</p>
                </div>
              </div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <Clock className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Working Hours</p>
                  <p className="font-semibold text-foreground">9:00 - 18:00</p>
                </div>
              </div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Security</p>
                  <p className="font-semibold text-foreground">2FA Enabled</p>
                </div>
              </div>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Database className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Storage</p>
                  <p className="font-semibold text-foreground">2.4 GB used</p>
                </div>
              </div>
            </div>
          </StaggerItem>
        </StaggerContainer>

        {/* Settings Groups */}
        <StaggerContainer className="space-y-6" delayChildren={0.3}>
          {settingsGroups.map((group) => (
            <StaggerItem key={group.title}>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center gap-4 border-b border-border bg-muted/30 px-6 py-4">
                  <group.icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h2 className="font-semibold text-foreground">{group.title}</h2>
                    <p className="text-sm text-muted-foreground">{group.description}</p>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {group.items.map((item) => (
                    <button
                      key={item.label}
                      className="flex w-full items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div>
                        <p className="font-medium text-foreground">{item.label}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Save Button */}
        <MotionSection className="mt-8 flex justify-end">
          <MotionButton variant="default" size="lg">
            Save Changes
          </MotionButton>
        </MotionSection>
      </MotionPage>
      <Chatbot />
    </>
  )
}
