"use client"

import { AdminSidebar } from "./admin-sidebar"

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  
  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <main className="pl-[72px] lg:pl-[240px] transition-[padding] duration-300 min-h-screen">
        {children}
      </main>
    </div>
  )
}
