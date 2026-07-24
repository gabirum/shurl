import { createFileRoute, Link } from '@tanstack/react-router'
import { LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({ component: RouteComponent })

function RouteComponent() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex items-center gap-2 font-heading text-2xl font-medium">
        <LinkIcon className="size-6 text-primary" />
        shurl
      </div>
      <p className="max-w-sm text-sm text-muted-foreground">
        Short links for your team — create, retarget, and track them in one place.
      </p>
      <Button nativeButton={false} render={<Link to="/links">Open dashboard</Link>} />
    </div>
  )
}
