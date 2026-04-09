import { AdminLayout } from "@/components/layouts/admin-layout"
import { ProtectedRoute } from "@/components/auth/protected-route"

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute role="ADMIN">
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  )
}
