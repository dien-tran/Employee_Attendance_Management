"use client"

import { EmployeeLayout } from "@/components/layouts/employee-layout"
import { UserGuard } from "@/components/auth/protected-route"
import { usePathname } from "next/navigation"

export default function UserRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  if (pathname === "/user/login") {
    return <>{children}</>
  }

  return (
    <UserGuard>
      <EmployeeLayout>{children}</EmployeeLayout>
    </UserGuard>
  )
}
