import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PERMANENT_REDIRECT_STATUS, type RedirectStatus } from '@/lib/links-schema'

export function LinkStatusBadge({ status }: { status: RedirectStatus }) {
  if (status === PERMANENT_REDIRECT_STATUS) {
    return (
      <Tooltip>
        <TooltipTrigger render={<Badge variant="outline" className="gap-1 text-muted-foreground" />}>
          <Lock data-icon="inline-start" />
          {status}
        </TooltipTrigger>
        <TooltipContent>Permanent redirect — cannot be edited or deleted</TooltipContent>
      </Tooltip>
    )
  }

  return <Badge variant="secondary">{status}</Badge>
}
