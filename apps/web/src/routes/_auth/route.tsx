import { enforceLogin } from '@/oidc'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth')({ beforeLoad: enforceLogin, component: RouteComponent })

function RouteComponent() {
  return <Outlet />
}
