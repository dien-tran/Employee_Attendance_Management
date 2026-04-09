import { EmployeeLayout } from "@/components/layouts/employee-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"

export default function UserRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute role="USER">
      <EmployeeLayout>{children}</EmployeeLayout>
    </ProtectedRoute>
  )
}
