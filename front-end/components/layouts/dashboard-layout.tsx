"use client"

import { DashboardSidebar } from "./dashboard-sidebar"
import { AnimatePresence } from "framer-motion"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <main className="pl-[72px] lg:pl-[240px] transition-[padding] duration-300">
        <AnimatePresence mode="wait">
          {children}
        </AnimatePresence>
      </main>
    </div>
  )
}
