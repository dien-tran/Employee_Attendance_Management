import { AdminLayout } from "@/components/layouts/admin-layout"
import { AdminGuard } from "@/components/auth/protected-route"

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminGuard>
      <AdminLayout>{children}</AdminLayout>
    </AdminGuard>
  )
}
