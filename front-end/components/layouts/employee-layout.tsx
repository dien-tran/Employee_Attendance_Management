"use client"

import { EmployeeSidebar } from "./employee-sidebar"

interface EmployeeLayoutProps {
  children: React.ReactNode
}

export function EmployeeLayout({ children }: EmployeeLayoutProps) {
  
  return (
    <div className="min-h-screen bg-background">
      <EmployeeSidebar />
      <main className="pl-[72px] lg:pl-[240px] transition-[padding] duration-300 min-h-screen">
        {children}
      </main>
    </div>
  )
}
