"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Camera,
  CalendarDays,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Scan,
} from "lucide-react"
import { ThemeToggle } from "@/components/features/theme-toggle"

const navItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Check-in",
    href: "/check-in",
    icon: Camera,
  },
  {
    title: "Attendance",
    href: "/attendance",
    icon: CalendarDays,
  },
  {
    title: "Employees",
    href: "/employees",
    icon: Users,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
]

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <motion.aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar",
        "transition-[width] duration-300 ease-in-out"
      )}
      animate={{ width: collapsed ? 72 : 240 }}
      initial={false}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-scanner text-scanner-foreground">
                <Scan className="h-4 w-4" />
              </div>
              <span className="font-semibold text-sidebar-foreground">AttendFlow</span>
            </motion.div>
          )}
        </AnimatePresence>
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-scanner text-scanner-foreground mx-auto">
            <Scan className="h-4 w-4" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute inset-0 rounded-lg bg-sidebar-accent"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <item.icon className="relative z-10 h-5 w-5 shrink-0" />
              <AnimatePresence>
          {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    className="relative z-10 truncate"
                  >
                    {item.title}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && <ThemeToggle />}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
            <span className="sr-only">
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </span>
          </button>
        </div>
      </div>
    </motion.aside>
  )
}
